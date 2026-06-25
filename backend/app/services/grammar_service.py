"""Gemini 문법 항목/연습문제 생성·추출 서비스.

- extract_grammar_from_images: 문법 노트 사진(들) → 구조화 문법 항목 + 연습문제
- generate_grammar: 텍스트 프롬프트(학습언어/레벨/주제/개수) → 문법 항목 + 연습문제

검증된 스키마(ARRAY of item):
  item = {point, explanation, example, level, category, problems[]}
  problem = {kind('choice'|'typing'), prompt, answer, options[], explanation}

- 자동 커밋하지 않는다 — 후보 리스트(dict)만 반환한다.
- API 키/이미지 bytes 는 절대 로그로 출력하지 않는다.
- 호출 실패/쿼터/파싱 실패는 GrammarError(한국어 메시지)로 매핑한다.
"""
from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)


class GrammarError(Exception):
    """문법 생성/추출 실패 — message 는 사용자에게 보여줄 한국어 메시지."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# Gemini 구조화 출력 스키마 — 연습문제
_PROBLEM_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "kind": types.Schema(
            type=types.Type.STRING,
            description="문제 유형: 'choice'(객관식) 또는 'typing'(주관식)",
        ),
        "prompt": types.Schema(
            type=types.Type.STRING,
            description="빈칸(___)을 포함한 문제 문장",
        ),
        "answer": types.Schema(
            type=types.Type.STRING,
            description="정답",
        ),
        "options": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING),
            description="choice 일 때 선택지 4개(정답 포함). typing 이면 빈 배열",
        ),
        "explanation": types.Schema(
            type=types.Type.STRING,
            description="해설 (없으면 빈 문자열)",
        ),
    },
    required=["kind", "prompt", "answer"],
)

# Gemini 구조화 출력 스키마 — 문법 항목
_ITEM_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "point": types.Schema(
            type=types.Type.STRING,
            description="문법 포인트 (예: '은/는', '~ている')",
        ),
        "explanation": types.Schema(
            type=types.Type.STRING,
            description="문법 설명 (lang_def 언어로)",
        ),
        "example": types.Schema(
            type=types.Type.STRING,
            description="예문 (없으면 빈 문자열)",
        ),
        "level": types.Schema(
            type=types.Type.STRING,
            description="난이도 라벨 (초급/중급/고급 등, 일관되게)",
        ),
        "category": types.Schema(
            type=types.Type.STRING,
            description="세부 분류 (조사/어미/시제 등)",
        ),
        "problems": types.Schema(
            type=types.Type.ARRAY,
            items=_PROBLEM_SCHEMA,
            description="연습문제 2~3개 (choice/typing 섞어서)",
        ),
    },
    required=["point", "explanation"],
)

_RESPONSE_SCHEMA = types.Schema(type=types.Type.ARRAY, items=_ITEM_SCHEMA)

# 허용 이미지 MIME (gemini_service 와 동일 셋)
SUPPORTED_IMAGE_MIME = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
}


def _generate(contents: list) -> list:
    """공통 Gemini 호출 + 구조화 응답 파싱. 실패는 GrammarError 로 매핑."""
    if not settings.GEMINI_API_KEY:
        raise GrammarError("Gemini API 키가 설정되지 않았습니다. 관리자에게 문의하세요.")

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
        # 키/이미지가 섞일 수 있으므로 원문은 로그에만, 사용자에겐 일반 메시지
        logger.error("Gemini grammar call failed: %s", exc)
        msg = str(exc).lower()
        if "quota" in msg or "resource_exhausted" in msg or "429" in msg:
            raise GrammarError(
                "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
            ) from exc
        if "permission" in msg or "api key" in msg or "401" in msg or "403" in msg:
            raise GrammarError(
                "AI 인증에 실패했습니다. API 키 설정을 확인해주세요."
            ) from exc
        raise GrammarError(
            "문법을 생성하지 못했습니다. 잠시 후 다시 시도해주세요."
        ) from exc

    return _parse_response(response)


def _parse_response(response) -> list:
    """Gemini 응답에서 JSON 배열을 추출. parsed 우선, 실패 시 text JSON 파싱."""
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, list):
        return parsed

    text = getattr(response, "text", None)
    if not text:
        raise GrammarError("AI 응답이 비어 있습니다. 다시 시도해주세요.")
    try:
        data = json.loads(text)
    except (ValueError, TypeError) as exc:
        logger.error("Gemini grammar JSON parse failed: %s", exc)
        raise GrammarError("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.") from exc

    if isinstance(data, list):
        return data
    raise GrammarError("AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.")


def _clean(value) -> str:
    """문자열 정규화 — None/공백 처리. 비문자열은 빈 문자열."""
    if not isinstance(value, str):
        return ""
    return value.strip()


def _normalize_problem(raw: dict) -> dict | None:
    """문제 dict 정규화. 유효하지 않으면 None.

    choice 인데 options 가 비었거나 정답 미포함이면 버린다(신뢰하되 가벼운 검증).
    """
    if not isinstance(raw, dict):
        return None
    kind = _clean(raw.get("kind")).lower()
    if kind not in ("choice", "typing"):
        kind = "choice"
    prompt = _clean(raw.get("prompt"))
    answer = _clean(raw.get("answer"))
    if not prompt or not answer:
        return None

    options_raw = raw.get("options")
    options: list[str] | None = None
    if isinstance(options_raw, list):
        options = [_clean(o) for o in options_raw if _clean(o)]
        options = options or None

    if kind == "choice":
        # 객관식인데 선택지가 부실하면 버린다
        if not options or answer not in options:
            return None

    return {
        "kind": kind,
        "prompt": prompt,
        "answer": answer,
        "options": options,
        "explanation": _clean(raw.get("explanation")) or None,
    }


def _normalize_items(parsed: list) -> list[dict]:
    """Gemini 응답 → 후보 항목 dict 리스트 (검증/정규화)."""
    items: list[dict] = []
    for raw in parsed:
        if not isinstance(raw, dict):
            continue
        point = _clean(raw.get("point"))
        explanation = _clean(raw.get("explanation"))
        if not point or not explanation:
            # point/explanation 둘 다 있어야 유효
            continue

        problems_raw = raw.get("problems")
        problems: list[dict] = []
        if isinstance(problems_raw, list):
            for p in problems_raw:
                norm = _normalize_problem(p)
                if norm is not None:
                    problems.append(norm)

        items.append(
            {
                "point": point,
                "explanation": explanation,
                "example": _clean(raw.get("example")) or None,
                "level": _clean(raw.get("level")),
                "category": _clean(raw.get("category")),
                "problems": problems,
            }
        )
    return items


def extract_grammar_from_images(
    images: list[bytes],
    image_mimes: list[str],
    lang_term: str,
    lang_def: str,
) -> list[dict]:
    """문법 노트 사진(들)에서 문법 항목 + 연습문제 후보를 추출한다.

    explanation 은 lang_def 언어로 생성한다.
    """
    if not images:
        raise GrammarError("업로드된 이미지가 없습니다.")

    prompt = (
        f"이 문법 노트 사진에서 학습용 문법 항목을 모두 추출하라.\n"
        f"학습 언어 코드: '{lang_term}'. 설명은 반드시 '{lang_def}' 언어로 작성하라.\n"
        "각 항목은 다음을 가진다:\n"
        "- point: 문법 포인트(원문 그대로)\n"
        f"- explanation: 문법 설명('{lang_def}' 언어로)\n"
        "- example: 예문(있으면, 없으면 빈 문자열)\n"
        "- level: 난이도 라벨(초급/중급/고급 등, 일관되게)\n"
        "- category: 세부 분류(조사/어미/시제 등)\n"
        "- problems: 각 문법당 연습문제 2~3개. choice/typing 섞어서.\n"
        "  problem: kind('choice'|'typing'), prompt(빈칸 ___ 포함 문장), answer, "
        "options(choice면 정답 포함 4개·typing이면 빈 배열), explanation.\n"
        "손글씨도 최선을 다해 읽고, 추측 불가한 칸은 비워도 되지만 point/explanation 은 반드시 채워라. "
        "항목이 없으면 빈 배열을 반환하라."
    )

    contents: list = []
    for data, mime in zip(images, image_mimes):
        contents.append(types.Part.from_bytes(data=data, mime_type=mime))
    contents.append(prompt)

    parsed = _generate(contents)
    return _normalize_items(parsed)


def generate_grammar(
    lang_term: str,
    lang_def: str,
    level: str,
    topic: str | None,
    count: int,
) -> list[dict]:
    """텍스트 프롬프트로 문법 항목 + 연습문제를 생성한다.

    explanation 은 lang_def 언어로 생성한다.
    """
    topic_hint = (
        f"주제 '{topic}' 와 관련된 문법을 우선하라.\n" if topic else ""
    )
    prompt = (
        f"학습 언어 '{lang_term}', 난이도 '{level}' 수준의 문법 항목을 {count}개 생성하라.\n"
        f"{topic_hint}"
        f"설명(explanation)은 반드시 '{lang_def}' 언어로 작성하라.\n"
        "각 항목은 다음을 가진다:\n"
        "- point: 문법 포인트\n"
        f"- explanation: 문법 설명('{lang_def}' 언어로)\n"
        "- example: 학습 언어 예문\n"
        f"- level: 난이도 라벨(주어진 '{level}' 기준으로 일관되게)\n"
        "- category: 세부 분류(조사/어미/시제 등, 일관된 태그)\n"
        "- problems: 각 문법당 연습문제 2~3개. choice 와 typing 을 섞어라.\n"
        "  problem: kind('choice'|'typing'), prompt(빈칸 ___ 포함한 학습 언어 문장), "
        "answer(정답), options(choice면 정답 포함 4개·typing이면 빈 배열), "
        f"explanation(해설, '{lang_def}' 언어로).\n"
        "객관식 선택지는 그럴듯한 오답을 포함하되 정답을 반드시 넣어라."
    )

    parsed = _generate([prompt])
    return _normalize_items(parsed)
