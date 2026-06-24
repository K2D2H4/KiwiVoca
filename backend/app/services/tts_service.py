"""Gemini TTS 발음 합성 서비스.

학습 카드의 term/표현을 Gemini TTS 모델로 음성 합성한다.
브라우저 내장 Web Speech API(기기마다 음질 편차) 대신 일관된 고품질 발음을 제공.

- 출력: Gemini 는 PCM(L16 24kHz mono)을 반환 → 브라우저 재생용 WAV 컨테이너로 감싼다.
- 캐싱: (모델·음성·언어·텍스트) 해시 기반 파일 캐시. 같은 단어 반복 재생 시 재과금/지연 방지.
  캐시는 best-effort — 디렉터리 쓰기 실패(비도커 로컬 등) 시 캐시 없이 매번 합성한다.
- API 키/오디오 bytes 는 절대 로그로 출력하지 않는다.
- 호출 실패/쿼터/파싱 실패는 TTSError(한국어 메시지 + http_status)로 매핑한다.
"""
from __future__ import annotations

import hashlib
import io
import logging
import os
import time
import wave

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Gemini TTS 출력 포맷 (L16 PCM)
_PCM_RATE = 24000
_PCM_WIDTH = 2  # 16-bit
_PCM_CHANNELS = 1

# 합성 허용 텍스트 최대 길이 (남용/과금 방지) — 단어·짧은 표현용
MAX_TEXT_LEN = 200

# preview TTS 모델은 간헐적으로 빈 응답(FinishReason.OTHER)/500 INTERNAL 을 반환한다.
# 일시적 실패는 짧게 재시도해 성공률을 끌어올린다(쿼터/인증은 재시도하지 않음).
_MAX_ATTEMPTS = 3
_RETRY_BACKOFF_S = 0.4

# 덱 언어 코드(짧은 형태) → 프롬프트용 언어명. 미지정 시 자동 감지에 맡긴다.
_LANG_NAMES = {
    "en": "English",
    "ko": "Korean",
    "ja": "Japanese",
    "zh": "Chinese",
    "ru": "Russian",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
}


class TTSError(Exception):
    """합성 실패 — message 는 사용자에게 보여줄 한국어 메시지, http_status 는 응답 코드."""

    def __init__(self, message: str, http_status: int = 502):
        super().__init__(message)
        self.message = message
        self.http_status = http_status


class _RetryableTTS(Exception):
    """일시적 실패 — 재시도 대상 (빈 응답 / 5xx 등). 내부용."""


def _normalize_lang(lang_code: str | None) -> str | None:
    """"en", "en-US", "EN_US" 등 → 짧은 언어 코드(en). 미지원/미지정이면 None."""
    if not lang_code:
        return None
    base = lang_code.replace("_", "-").split("-")[0].lower()
    return base or None


def _build_contents(text: str, lang_base: str | None) -> str:
    """합성 지시문 생성. 접두 지시문은 음성으로 읽히지 않고 발화 스타일만 제어한다."""
    name = _LANG_NAMES.get(lang_base or "")
    if name:
        # 단어 단위는 언어 자동 감지가 흔들릴 수 있어 언어를 명시해 발음을 안정화.
        return f"Pronounce this {name} word or phrase clearly and naturally: {text}"
    return text


def _cache_path(text: str, lang_base: str | None) -> str | None:
    """캐시 파일 경로. 캐시 디렉터리 준비 실패 시 None(캐시 비활성)."""
    cache_dir = settings.TTS_CACHE_DIR
    try:
        os.makedirs(cache_dir, exist_ok=True)
    except OSError:
        return None
    raw = f"{settings.GEMINI_TTS_MODEL}|{settings.GEMINI_TTS_VOICE}|{lang_base or ''}|{text}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return os.path.join(cache_dir, f"{digest}.wav")


def _pcm_to_wav(pcm: bytes) -> bytes:
    """raw PCM(L16 24kHz mono) → WAV 컨테이너 bytes (브라우저 <audio> 재생용)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(_PCM_CHANNELS)
        wav.setsampwidth(_PCM_WIDTH)
        wav.setframerate(_PCM_RATE)
        wav.writeframes(pcm)
    return buf.getvalue()


def _extract_pcm(response) -> bytes:
    """Gemini 응답에서 오디오(inline_data) bytes 추출. 없으면 _RetryableTTS(재시도 대상)."""
    candidates = getattr(response, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return inline.data
    # 오디오 없음 — preview 모델의 간헐적 빈 응답(FinishReason.OTHER). 재시도하면 대개 성공.
    raise _RetryableTTS("empty audio")


def _raise_if_permanent(exc: Exception) -> None:
    """API 예외 분류. 영구 오류(쿼터/인증)면 TTSError 발생, 그 외(5xx 등)는 반환(재시도)."""
    msg = str(exc).lower()
    if "quota" in msg or "resource_exhausted" in msg or "429" in msg:
        raise TTSError(
            "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", http_status=429
        ) from exc
    if "permission" in msg or "api key" in msg or "401" in msg or "403" in msg:
        raise TTSError("AI 인증에 실패했습니다. API 키 설정을 확인해주세요.") from exc
    # 500 INTERNAL / 503 UNAVAILABLE / overloaded 등은 일시적 → 재시도 대상


def synthesize(text: str, lang_code: str | None) -> bytes:
    """텍스트를 발음 WAV bytes 로 합성한다.

    Args:
        text: 읽을 단어/표현 (앞뒤 공백 제거 후 1자 이상, MAX_TEXT_LEN 이하)
        lang_code: 덱 학습 언어 코드 (예: 'en', 'ja'). None 이면 자동 감지.

    Returns:
        WAV 오디오 bytes.

    Raises:
        TTSError: 빈 입력/길이 초과/키 미설정/모델 호출 실패 등.
    """
    text = (text or "").strip()
    if not text:
        raise TTSError("읽을 내용이 없습니다.", http_status=400)
    if len(text) > MAX_TEXT_LEN:
        raise TTSError(f"텍스트가 너무 깁니다. {MAX_TEXT_LEN}자 이하로 입력해주세요.", http_status=400)
    if not settings.GEMINI_API_KEY:
        raise TTSError("Gemini API 키가 설정되지 않았습니다. 관리자에게 문의하세요.")

    lang_base = _normalize_lang(lang_code)

    # 1) 캐시 조회
    path = _cache_path(text, lang_base)
    if path and os.path.exists(path):
        try:
            with open(path, "rb") as f:
                return f.read()
        except OSError:
            pass  # 캐시 읽기 실패 시 재합성

    # 2) Gemini TTS 합성 (일시적 빈 응답/5xx 는 짧게 재시도)
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=settings.GEMINI_TTS_VOICE
                )
            )
        ),
    )
    contents = _build_contents(text, lang_base)

    pcm: bytes | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_TTS_MODEL, contents=contents, config=config
            )
            pcm = _extract_pcm(response)  # 빈 응답이면 _RetryableTTS
            break
        except TTSError:
            raise  # 영구 오류(쿼터/인증) — 즉시 전파
        except _RetryableTTS:
            logger.warning("Gemini TTS empty/transient, attempt %d/%d", attempt, _MAX_ATTEMPTS)
        except Exception as exc:  # noqa: BLE001
            # 키/오디오가 메시지에 섞일 수 있어 원문은 로그에 타입만
            logger.warning("Gemini TTS error %s, attempt %d/%d", type(exc).__name__, attempt, _MAX_ATTEMPTS)
            _raise_if_permanent(exc)  # 영구면 TTSError, 일시적이면 통과(재시도)
        if attempt < _MAX_ATTEMPTS:
            time.sleep(_RETRY_BACKOFF_S)

    if pcm is None:
        raise TTSError("발음을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.")

    wav = _pcm_to_wav(pcm)

    # 3) 캐시 저장 (best-effort) — 임시 파일로 쓰고 원자적 교체
    if path:
        try:
            tmp = f"{path}.tmp"
            with open(tmp, "wb") as f:
                f.write(wav)
            os.replace(tmp, path)
        except OSError:
            pass  # 캐시 저장 실패는 무시 (합성 결과는 그대로 반환)

    return wav
