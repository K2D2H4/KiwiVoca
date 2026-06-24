"""Google Cloud Text-to-Speech (Chirp 3 HD) 발음 합성 서비스.

학습 카드의 term/표현을 GCTTS Chirp 3 HD 음성으로 합성한다(언어별 네이티브 음성).
브라우저 내장 Web Speech API(기기마다 음질 편차) 대신 일관된 고품질 발음을 제공.

- REST(text:synthesize) + API 키 인증. 출력 MP3(audio/mpeg).
- 캐싱: (voice·언어·텍스트) 해시 기반 파일 캐시. 같은 단어 반복 재생 시 재합성/재과금 방지.
  캐시는 best-effort — 디렉터리 쓰기 실패(비도커 로컬 등) 시 캐시 없이 매번 합성한다.
- 타임아웃 + 일시적(5xx/네트워크) 재시도. 영구 오류(4xx)는 즉시 실패 → 프론트가 Web Speech 폴백.
- API 키/오디오 bytes 는 절대 로그로 출력하지 않는다.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# 합성 허용 텍스트 최대 길이 (남용/과금 방지) — 단어·짧은 표현용
MAX_TEXT_LEN = 200

_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize"
_TIMEOUT_S = 8.0           # GCTTS 는 보통 ~0.6s. stall 방지용 상한.
_MAX_ATTEMPTS = 2          # 일시적 5xx/네트워크만 재시도(GCTTS 는 안정적)
_RETRY_BACKOFF_S = 0.4

# 덱 언어 코드(짧은 형태) → Chirp 3 HD languageCode(BCP-47). 미지정/미지원이면 en-US.
_LANG_TO_BCP47 = {
    "en": "en-US",
    "ko": "ko-KR",
    "ja": "ja-JP",
    "zh": "cmn-CN",
    "fr": "fr-FR",
    "de": "de-DE",
    "es": "es-ES",
    "it": "it-IT",
    "pt": "pt-BR",
    "ru": "ru-RU",
}


class TTSError(Exception):
    """합성 실패 — message 는 사용자에게 보여줄 한국어 메시지, http_status 는 응답 코드."""

    def __init__(self, message: str, http_status: int = 502):
        super().__init__(message)
        self.message = message
        self.http_status = http_status


def _to_bcp47(lang_code: str | None) -> str:
    """"en", "en-US", "EN_US" 등 → Chirp 3 HD languageCode. 미지원/미지정이면 en-US."""
    if not lang_code:
        return "en-US"
    norm = lang_code.replace("_", "-")
    if "-" in norm:
        lang, region = norm.split("-", 1)
        return f"{lang.lower()}-{region.upper()}"
    return _LANG_TO_BCP47.get(norm.lower(), "en-US")


def _voice_name(bcp47: str) -> str:
    """Chirp 3 HD 음성 이름. 예: en-US-Chirp3-HD-Achernar (별 이름은 언어 공통)."""
    return f"{bcp47}-Chirp3-HD-{settings.GOOGLE_TTS_VOICE}"


def _cache_path(text: str, bcp47: str) -> str | None:
    """캐시 파일 경로(mp3). 캐시 디렉터리 준비 실패 시 None(캐시 비활성)."""
    cache_dir = settings.TTS_CACHE_DIR
    try:
        os.makedirs(cache_dir, exist_ok=True)
    except OSError:
        return None
    raw = f"chirp3hd|{settings.GOOGLE_TTS_VOICE}|{bcp47}|{text}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return os.path.join(cache_dir, f"{digest}.mp3")


def _handle_error_status(resp: httpx.Response) -> None:
    """비200 응답 분류. 영구 오류(4xx)면 TTSError 발생, 일시적(5xx)이면 반환(재시도)."""
    code = resp.status_code
    if code == 429:
        raise TTSError(
            "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", http_status=429
        )
    if code in (401, 403):
        raise TTSError("TTS 인증에 실패했습니다. API 키 설정을 확인해주세요.")
    if 400 <= code < 500:
        # 잘못된 음성/언어 등 — 재시도해도 무의미
        logger.warning("GCTTS client error %s", code)
        raise TTSError("발음 생성 요청이 거부되었습니다. (지원되지 않는 언어/음성일 수 있음)")
    # 5xx → 일시적, 재시도 대상
    logger.warning("GCTTS server error %s", code)


def synthesize(text: str, lang_code: str | None) -> bytes:
    """텍스트를 발음 MP3 bytes 로 합성한다.

    Args:
        text: 읽을 단어/표현 (앞뒤 공백 제거 후 1자 이상, MAX_TEXT_LEN 이하)
        lang_code: 덱 학습 언어 코드 (예: 'en', 'ja'). None 이면 en-US.

    Returns:
        MP3 오디오 bytes.

    Raises:
        TTSError: 빈 입력/길이 초과/키 미설정/호출 실패 등.
    """
    text = (text or "").strip()
    if not text:
        raise TTSError("읽을 내용이 없습니다.", http_status=400)
    if len(text) > MAX_TEXT_LEN:
        raise TTSError(f"텍스트가 너무 깁니다. {MAX_TEXT_LEN}자 이하로 입력해주세요.", http_status=400)
    if not settings.GOOGLE_TTS_API_KEY:
        raise TTSError("TTS API 키가 설정되지 않았습니다. 관리자에게 문의하세요.")

    bcp47 = _to_bcp47(lang_code)

    # 1) 캐시 조회
    path = _cache_path(text, bcp47)
    if path and os.path.exists(path):
        try:
            with open(path, "rb") as f:
                return f.read()
        except OSError:
            pass  # 캐시 읽기 실패 시 재합성

    # 2) GCTTS Chirp 3 HD 합성 (일시적 5xx/네트워크는 짧게 재시도)
    body = {
        "input": {"text": text},
        "voice": {"languageCode": bcp47, "name": _voice_name(bcp47)},
        "audioConfig": {"audioEncoding": "MP3"},
    }
    params = {"key": settings.GOOGLE_TTS_API_KEY}

    audio: bytes | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            resp = httpx.post(_ENDPOINT, params=params, json=body, timeout=_TIMEOUT_S)
        except httpx.HTTPError as exc:  # 타임아웃/연결 실패 등 → 일시적
            logger.warning(
                "GCTTS network error %s, attempt %d/%d", type(exc).__name__, attempt, _MAX_ATTEMPTS
            )
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_BACKOFF_S)
            continue

        if resp.status_code == 200:
            content = resp.json().get("audioContent")
            if content:
                audio = base64.b64decode(content)
                break
            logger.warning("GCTTS 200 but empty audioContent, attempt %d/%d", attempt, _MAX_ATTEMPTS)
        else:
            _handle_error_status(resp)  # 영구면 TTSError 전파, 5xx면 통과(재시도)

        if attempt < _MAX_ATTEMPTS:
            time.sleep(_RETRY_BACKOFF_S)

    if audio is None:
        raise TTSError("발음을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.")

    # 3) 캐시 저장 (best-effort) — 임시 파일로 쓰고 원자적 교체
    if path:
        try:
            tmp = f"{path}.tmp"
            with open(tmp, "wb") as f:
                f.write(audio)
            os.replace(tmp, path)
        except OSError:
            pass  # 캐시 저장 실패는 무시

    return audio
