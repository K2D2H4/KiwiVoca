"""Gemini 단어장/문법 이미지 추출 서비스.

이미지(들) + 구조화 프롬프트를 Gemini 멀티모달 모델에 보내고,
response_schema 로 JSON 배열(term/reading/definition/example)을 강제 추출한다.

- 자동 커밋하지 않는다 — 후보 카드 리스트(dict)만 반환한다.
- API 키/이미지 bytes 는 절대 로그로 출력하지 않는다.
- 호출 실패/쿼터/파싱 실패는 ExtractionError(한국어 메시지)로 매핑한다.
"""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# 허용 이미지 MIME (Gemini Vision 입력)
SUPPORTED_IMAGE_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"}


class ExtractionError(Exception):
    """추출 실패 — message 는 사용자에게 보여줄 한국어 메시지."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# Gemini 구조화 출력용 JSON 스키마 (카드 1개 = 객체, 응답 = 배열)
_CARD_ITEM_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "term": types.Schema(
            type=types.Type.STRING,
            description="학습 대상 단어/표현/문법 포인트 (원문 그대로)",
        ),
        "reading": types.Schema(
            type=types.Type.STRING,
            description="발음/요미가나/병음 등. 없으면 빈 문자열",
        ),
        "definition": types.Schema(
            type=types.Type.STRING,
            description="뜻/설명 (lang_def 언어로)",
        ),
        "example": types.Schema(
            type=types.Type.STRING,
            description="예문. 없으면 빈 문자열",
        ),
    },
    required=["term", "definition"],
)

_RESPONSE_SCHEMA = types.Schema(type=types.Type.ARRAY, items=_CARD_ITEM_SCHEMA)


def _build_prompt(lang_term: str, lang_def: str, kind: str) -> str:
    """추출 지시 프롬프트 생성 (한국어/영어 혼용). kind 에 따라 강조점 변경."""
    target = "문법 포인트/표현" if kind == "grammar" else "단어/표현"
    kind_hint = (
        "이 노트는 문법 학습용이다. term 에는 문법 포인트(예: 'は/が', '~ている'), "
        "definition 에는 문법 설명을 넣어라."
        if kind == "grammar"
        else "이 노트는 단어 학습용이다. term 에는 학습 대상 단어/표현을 넣어라."
    )
    return (
        f"이 단어장/문법 노트 사진에서 학습용 {target} 항목을 모두 추출하라.\n"
        f"{kind_hint}\n"
        "각 항목은 다음 필드를 가진다:\n"
        f"- term: 학습 대상 단어/표현/문법 (학습 언어 코드 '{lang_term}', 원문 그대로)\n"
        "- reading: 발음/요미가나/병음 등 (있을 때만, 없으면 빈 문자열)\n"
        f"- definition: 뜻/설명 ('{lang_def}' 언어로)\n"
        "- example: 예문 (있을 때만, 없으면 빈 문자열)\n"
        "표·줄 구조를 최대한 보존하고, 손글씨도 최선을 다해 읽어라. "
        "추측이 불가능한 칸은 비워도 되지만 term 과 definition 은 반드시 채워라. "
        "사진에 항목이 없으면 빈 배열을 반환하라."
    )


def extract_cards_from_images(
    images: list[bytes],
    image_mimes: list[str],
    lang_term: str,
    lang_def: str,
    kind: str,
) -> list[dict]:
    """이미지(들)에서 학습 카드 후보를 추출한다.

    Args:
        images: 이미지 바이트 리스트 (1장 이상)
        image_mimes: 각 이미지의 MIME 타입 (images 와 같은 순서/길이)
        lang_term: 학습 언어 코드 (예: 'en', 'ja')
        lang_def: 모국어 코드 (예: 'ko')
        kind: 'vocab' | 'grammar'

    Returns:
        후보 카드 dict 리스트. 각 dict: {term, reading, definition, example}.
        reading/example 은 빈 값이면 None.

    Raises:
        ExtractionError: 모델 호출/쿼터/파싱 실패 또는 빈 입력.
    """
    if not images:
        raise ExtractionError("업로드된 이미지가 없습니다.")
    if not settings.GEMINI_API_KEY:
        raise ExtractionError("Gemini API 키가 설정되지 않았습니다. 관리자에게 문의하세요.")

    # 이미지 Part + 프롬프트 텍스트 구성
    contents: list = []
    for data, mime in zip(images, image_mimes):
        contents.append(types.Part.from_bytes(data=data, mime_type=mime))
    contents.append(_build_prompt(lang_term, lang_def, kind))

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
            ),
        )
    except Exception as exc:  # noqa: BLE001
        # 키/이미지 bytes 가 메시지에 섞일 수 있으므로 원문은 로그에만, 사용자에겐 일반 메시지
        logger.error("Gemini call failed: %s", exc)
        msg = str(exc).lower()
        if "quota" in msg or "resource_exhausted" in msg or "429" in msg:
            raise ExtractionError(
                "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
            ) from exc
        if "permission" in msg or "api key" in msg or "401" in msg or "403" in msg:
            raise ExtractionError(
                "AI 인증에 실패했습니다. API 키 설정을 확인해주세요."
            ) from exc
        raise ExtractionError(
            "이미지에서 단어를 추출하지 못했습니다. 잠시 후 다시 시도해주세요."
        ) from exc

    # 구조화 출력 파싱 (SDK 가 parsed 를 제공하면 사용, 아니면 text JSON 파싱)
    parsed = _parse_response(response)

    cards: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        term = _clean(item.get("term"))
        definition = _clean(item.get("definition"))
        if not term or not definition:
            # term/definition 둘 다 있어야 유효한 카드
            continue
        cards.append(
            {
                "term": term,
                "reading": _clean(item.get("reading")) or None,
                "definition": definition,
                "example": _clean(item.get("example")) or None,
            }
        )
    return cards


def generate_vocab(
    lang_term: str,
    lang_def: str,
    theme: str,
    level: str | None,
    count: int,
) -> list[dict]:
    """테마 기반으로 단어 카드 후보를 생성한다 (자동 커밋 X, 검수용).

    Args:
        lang_term: 학습 언어 코드 (예: 'en', 'ja')
        lang_def: 모국어 코드 (예: 'ko')
        theme: 단어 주제 (예: '여행', '음식')
        level: 난이도 라벨 (선택, 예: '초급')
        count: 생성할 단어 수

    Returns:
        후보 카드 dict 리스트. 각 dict: {term, reading, definition, example}.
        reading/example 은 빈 값이면 None.

    Raises:
        ExtractionError: 모델 호출/쿼터/파싱 실패.
    """
    if not settings.GEMINI_API_KEY:
        raise ExtractionError("Gemini API 키가 설정되지 않았습니다. 관리자에게 문의하세요.")

    level_hint = f"난이도 '{level}' 수준으로. " if level else ""
    prompt = (
        f"학습 언어 '{lang_term}' 에서 주제 '{theme}' 와 관련된 단어/표현을 {count}개 생성하라.\n"
        f"{level_hint}각 항목은 다음 필드를 가진다:\n"
        f"- term: 학습 대상 단어/표현 (학습 언어 '{lang_term}')\n"
        "- reading: 발음/요미가나/병음 등 (있을 때만, 없으면 빈 문자열)\n"
        f"- definition: 뜻/설명 ('{lang_def}' 언어로)\n"
        f"- example: 학습 언어 예문 (없으면 빈 문자열)\n"
        "서로 중복되지 않는 실용적인 단어로 구성하라."
    )

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Gemini vocab generate failed: %s", exc)
        msg = str(exc).lower()
        if "quota" in msg or "resource_exhausted" in msg or "429" in msg:
            raise ExtractionError(
                "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
            ) from exc
        if "permission" in msg or "api key" in msg or "401" in msg or "403" in msg:
            raise ExtractionError(
                "AI 인증에 실패했습니다. API 키 설정을 확인해주세요."
            ) from exc
        raise ExtractionError(
            "단어를 생성하지 못했습니다. 잠시 후 다시 시도해주세요."
        ) from exc

    parsed = _parse_response(response)

    cards: list[dict] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        term = _clean(item.get("term"))
        definition = _clean(item.get("definition"))
        if not term or not definition:
            continue
        cards.append(
            {
                "term": term,
                "reading": _clean(item.get("reading")) or None,
                "definition": definition,
                "example": _clean(item.get("example")) or None,
            }
        )
    return cards


def _parse_response(response) -> list:
    """Gemini 응답에서 JSON 배열을 추출. parsed 우선, 실패 시 text JSON 파싱."""
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, list):
        return parsed

    text = getattr(response, "text", None)
    if not text:
        raise ExtractionError("AI 응답이 비어 있습니다. 다시 시도해주세요.")

    import json

    try:
        data = json.loads(text)
    except (ValueError, TypeError) as exc:
        logger.error("Gemini JSON parse failed: %s", exc)
        raise ExtractionError("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.") from exc

    if isinstance(data, list):
        return data
    raise ExtractionError("AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.")


def _clean(value) -> str:
    """문자열 정규화 — None/공백 처리. 비문자열은 빈 문자열."""
    if not isinstance(value, str):
        return ""
    return value.strip()
