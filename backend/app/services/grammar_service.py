"""Gemini 문법 항목 추출·생성 + 연습문제 즉석 생성 서비스.

- extract_grammar_from_images: 문법 노트 사진(들) → 구조화 문법 "항목"만
- generate_grammar: 텍스트 프롬프트(학습언어/레벨/주제/개수) → 문법 "항목"만
- generate_problems_for_items: 문법 항목 리스트 → 연습문제 즉석 배치 생성

설계 변경(2026-06): 추출/생성은 문법 항목만 뽑는다(문제 미저장). 연습문제는
저장하지 않고 "연습 시작 때" 선택된 항목들로부터 즉석 생성한다. 사진/AI 두 경로
결과 형태를 동일하게 통일한다.

검증된 스키마:
  item = {point, explanation, example, level, category}
  (연습문제는 generate_problems_for_items 가 별도로 즉석 생성)

- 자동 커밋하지 않는다 — 후보 리스트(dict)만 반환한다.
- API 키/이미지 bytes 는 절대 로그로 출력하지 않는다.
- 호출 실패/쿼터/파싱 실패는 GrammarError(한국어 메시지)로 매핑한다.
"""
from __future__ import annotations

import json
import logging
import math
import random

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)


class GrammarError(Exception):
    """문법 생성/추출 실패 — message 는 사용자에게 보여줄 한국어 메시지."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# Gemini 구조화 출력 스키마 — 문법 항목(문제 없음)
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
    },
    required=["point", "explanation"],
)

_ITEMS_RESPONSE_SCHEMA = types.Schema(type=types.Type.ARRAY, items=_ITEM_SCHEMA)

# Gemini 구조화 출력 스키마 — 연습문제(즉석 생성)
_PROBLEM_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "item_index": types.Schema(
            type=types.Type.INTEGER,
            description="이 문제가 속한 문법 항목의 입력 인덱스(0부터)",
        ),
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
            description="빈칸에 들어갈 정답(활용형)",
        ),
        "options": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING),
            description="choice 일 때 선택지 4개(정답 포함). typing 이면 빈 배열",
        ),
        "base_form": types.Schema(
            type=types.Type.STRING,
            description="빈칸에 들어갈 표현의 기본형/원형 (예: 동사 '먹다'). 컨텍스트 제공용",
        ),
        "explanation": types.Schema(
            type=types.Type.STRING,
            description="해설 (없으면 빈 문자열)",
        ),
    },
    required=["item_index", "kind", "prompt", "answer", "base_form"],
)

_PROBLEMS_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.ARRAY, items=_PROBLEM_SCHEMA
)

# 허용 이미지 MIME (gemini_service 와 동일 셋)
SUPPORTED_IMAGE_MIME = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
}


def _generate(contents: list, response_schema: types.Schema) -> list:
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
                response_schema=response_schema,
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


def _normalize_items(parsed: list) -> list[dict]:
    """Gemini 응답 → 후보 문법 항목 dict 리스트 (검증/정규화). 문제는 포함하지 않는다."""
    items: list[dict] = []
    for raw in parsed:
        if not isinstance(raw, dict):
            continue
        point = _clean(raw.get("point"))
        explanation = _clean(raw.get("explanation"))
        if not point or not explanation:
            # point/explanation 둘 다 있어야 유효
            continue

        items.append(
            {
                "point": point,
                "explanation": explanation,
                "example": _clean(raw.get("example")) or None,
                "level": _clean(raw.get("level")),
                "category": _clean(raw.get("category")),
            }
        )
    return items


def extract_grammar_from_images(
    images: list[bytes],
    image_mimes: list[str],
    lang_term: str,
    lang_def: str,
) -> list[dict]:
    """문법 노트 사진(들)에서 문법 "항목"만 추출한다 (연습문제 없음).

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
        "연습문제는 만들지 마라(문법 항목만 추출). "
        "손글씨도 최선을 다해 읽고, 추측 불가한 칸은 비워도 되지만 point/explanation 은 반드시 채워라. "
        "항목이 없으면 빈 배열을 반환하라."
    )

    contents: list = []
    for data, mime in zip(images, image_mimes):
        contents.append(types.Part.from_bytes(data=data, mime_type=mime))
    contents.append(prompt)

    parsed = _generate(contents, _ITEMS_RESPONSE_SCHEMA)
    return _normalize_items(parsed)


def generate_grammar(
    lang_term: str,
    lang_def: str,
    level: str,
    topic: str | None,
    count: int,
) -> list[dict]:
    """텍스트 프롬프트로 문법 "항목"만 생성한다 (연습문제 없음).

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
        "연습문제는 만들지 마라(문법 항목만 생성)."
    )

    parsed = _generate([prompt], _ITEMS_RESPONSE_SCHEMA)
    return _normalize_items(parsed)


# 빈칸 표식
_BLANK = "___"
# 빈칸 뒤 잉여 텍스트에서 무시할 양끝 공백/문장부호
_TRAILING_IGNORE = " 　.,!?。、…​\t\n"
# 한국어 종결어미 후보 — answer 가 이걸로 끝나면 빈칸 뒤 짧은 잉여 토큰은 garbage 의심
_KO_ENDINGS = (
    "이에요", "예요", "어요", "아요", "여요", "해요",
    "습니다", "ㅂ니다", "니다", "요", "다",
)


def _common_suffix_len(a: str, b: str) -> int:
    """a 와 b 의 공통 접미사(말미부터 동일한 글자 수)."""
    n = 0
    while n < len(a) and n < len(b) and a[-1 - n] == b[-1 - n]:
        n += 1
    return n


def _is_broken_blank(prompt: str, answer: str) -> bool:
    """빈칸 채우기 문제가 깨졌으면 True (보수적: 명백한 경우만 폐기).

    빈칸('___')에 answer 를 채웠을 때 중복/비문이 되는 경우를 거른다.

    깨짐 판정:
    1) '___' 가 정확히 1개가 아니다.
    2) answer 가 prompt 의 빈칸 밖에 그대로 또 등장한다 (이중 노출).
    3) 빈칸 뒤 잉여 텍스트(앞뒤 공백/문장부호 무시)가 answer 의 말미와 중복된다:
       - answer 와 tail 의 공통 접미사가 2글자 이상 (예: '덮였어요' + 뒤 '었어요'),
       - 또는 공통 접미사 1글자이면서 tail 이 짧은 잉여 조각(≤2글자, 예: '섞여요' + '요').
    4) answer 가 종결어미로 끝나는데 빈칸 뒤에 짧은(≤2글자) 잉여 토큰이 매달려 있다
       (예: '보여요' + 뒤 '임' 같은 의미 없는 garbage).
    보수적으로, 빈칸 뒤가 비었거나 긴 후속 절이면 깨짐으로 보지 않는다.
    """
    if prompt.count(_BLANK) != 1:
        return True

    before, after = prompt.split(_BLANK, 1)

    # (2) 이중 노출: 빈칸을 뺀 나머지 텍스트에 answer 가 그대로 또 있으면 버린다.
    if answer and answer in (before + after):
        return True

    tail = after.strip(_TRAILING_IGNORE)
    if not tail or not answer:
        return False

    # (3) 빈칸 뒤 잉여 어미 중복
    overlap = _common_suffix_len(answer, tail)
    if overlap >= 2:
        return True
    if overlap >= 1 and len(tail) <= 2:
        return True

    # (4) 종결어미 뒤 매달린 짧은 garbage 토큰
    if len(tail) <= 2 and answer.endswith(_KO_ENDINGS):
        return True

    return False


def _normalize_problem(raw: dict, item_count: int) -> dict | None:
    """즉석 생성 문제 dict 정규화. 유효하지 않으면 None.

    - item_index 는 0..item_count-1 범위여야 한다.
    - choice 인데 options 가 비었거나 정답 미포함이면 버린다.
    - 빈칸이 깨진 문제(_is_broken_blank)는 버린다(안전망).
    - base_form 은 비어도 허용(없으면 빈 문자열).
    """
    if not isinstance(raw, dict):
        return None

    item_index = raw.get("item_index")
    if not isinstance(item_index, int) or not (0 <= item_index < item_count):
        return None

    kind = _clean(raw.get("kind")).lower()
    if kind not in ("choice", "typing"):
        kind = "choice"
    prompt = _clean(raw.get("prompt"))
    answer = _clean(raw.get("answer"))
    if not prompt or not answer:
        return None

    # 안전망: 빈칸에 정답을 채우면 중복/비문이 되는 깨진 문제를 폐기한다.
    if _is_broken_blank(prompt, answer):
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
        "item_index": item_index,
        "kind": kind,
        "prompt": prompt,
        "answer": answer,
        "options": options,
        "base_form": _clean(raw.get("base_form")),
        "explanation": _clean(raw.get("explanation")) or None,
    }


# 항목당 생성 문제 수 상한 (프롬프트/응답 폭주 방지)
# 8 → 6: 후반(per-item 다중 생성)으로 갈수록 빈칸 뒤 잉여 어미/garbage 품질 저하가
# 심해졌다. 품질 우선이되, 단일 항목으로 다수 문제(10/20/30)를 요청하는 경우를
# 캡으로 막지 않도록 충분히 높게 둔다(반복 학습이라 비슷한 예문도 허용).
_PER_ITEM_MAX = 40
# target_count 미지정(0) 시 항목당 기본 생성 수
_DEFAULT_PER_ITEM = 2
# 부족분 top-up 포함 Gemini 총 호출 횟수 상한(무한루프/지연 방지)
_MAX_GEN_ATTEMPTS = 3


def _build_problems_prompt(
    items: list[dict],
    lang_term: str,
    lang_def: str,
    per_item: int,
    avoid_prompts: list[str] | None = None,
) -> str:
    """문제 생성 프롬프트를 만든다(초기/추가 생성 공용).

    avoid_prompts 가 있으면 "이미 만든 문장과 겹치지 마라" 힌트를 덧붙인다(top-up용).
    """
    lines: list[str] = []
    for idx, it in enumerate(items):
        point = _clean(it.get("point"))
        explanation = _clean(it.get("explanation"))
        example = _clean(it.get("example"))
        ex = f" / 예문: {example}" if example else ""
        lines.append(f"[{idx}] {point} — {explanation}{ex}")
    item_block = "\n".join(lines)

    avoid_block = ""
    if avoid_prompts:
        # 과도한 길이 방지를 위해 최근 일부만 제시
        recent = avoid_prompts[-40:]
        joined = "\n".join(f"- {p}" for p in recent)
        avoid_block = (
            "\n아래 문장들은 이미 만들었으니 '똑같은 문장'은 다시 만들지 마라"
            "(비슷한 상황은 허용, 동일 문장만 금지):\n"
            f"{joined}\n"
        )

    return (
        f"학습 언어 '{lang_term}' 의 아래 문법 항목들로 빈칸 채우기 연습문제를 만들어라.\n"
        f"각 문법 항목(아래 [n])마다 정확히 {per_item}개의 문제를 만들어라(반복 학습용).\n"
        f"같은 항목의 {per_item}개 문제는 가능하면 서로 다른 예문/문장으로 만들되, "
        "반복 학습이므로 비슷한 상황의 예문은 허용한다(완전히 동일한 문장만 피하라).\n"
        "기본은 choice(객관식)로 만들고, 일부만 typing(주관식)으로 하라. 난이도는 낮게.\n\n"
        "■ 빈칸/정답 규칙 (반드시 지켜라):\n"
        "1) prompt 는 완전하고 자연스러운 문장이어야 하며, '___' 자리에 answer 를 "
        "그대로 끼워 넣으면 문법적으로 완전하고 올바른 문장이 되어야 한다.\n"
        "2) 빈칸('___')은 정답(answer) 전체를 대체한다. 정답의 어미/조사/활용 일부를 "
        "빈칸 밖(앞이나 뒤)에 절대 남기지 마라.\n"
        "3) 빈칸 앞뒤 텍스트가 정답의 어떤 부분과도 중복되면 안 된다. 빈칸 뒤에 "
        "불필요한 조사/어미/글자(예: '요', '었어요', '임')를 덧붙이지 마라.\n"
        "4) 한 문장에 '___' 는 정확히 1개. 정답 단어를 문장의 다른 곳에 또 노출하지 마라.\n\n"
        "■ choice(객관식) 보기 규칙 — 정답은 '유일'해야 한다 (반드시 지켜라):\n"
        "5) 오답 보기 3개는 주어진 문장 맥락에서 '명백히 틀려야' 한다 — 비문법적이거나 "
        "의미상 부적절. 빈칸에 넣었을 때 정답만 자연스럽고 나머지 3개는 틀리거나 어색해야 한다.\n"
        "6) 정답과 시제/높임/상(相)만 다른데 그 보기도 문맥상 자연스러워서 '둘 다 정답'이 "
        "되는 보기는 절대 금지(복수 정답 모호함 금지).\n"
        "7) 문장에 시간 표현/맥락 단서를 넣어 정답이 유일하게 결정되도록 한정하라. "
        "현재 습관이면 '항상/매일/요즘', 과거면 '어제/방금/아까', 진행이면 '지금' 등을 넣어 "
        "다른 시제 보기가 답이 될 여지를 없애라.\n"
        "8) 그래도 시제로 변별이 애매하면, 시제가 아닌 다른 축(어휘 오류/조사 오류/높임 오류 "
        "/비문)으로 오답을 만들어 정답이 하나가 되게 하라.\n\n"
        "■ 예시(학습 언어가 한국어인 경우로 일반화):\n"
        "올바름: prompt '비가 와서 우산을 ___.' / answer '썼어요' "
        "→ 채우면 '비가 와서 우산을 썼어요.' (완전).\n"
        "금지: prompt '비가 와서 우산을 ___ 어요.' / answer '썼어요' "
        "(빈칸 뒤 '어요' 가 정답 어미와 중복 → 채우면 '...썼어요 어요.' 비문).\n"
        "금지: prompt '... 잘 ___ 요.' / answer '섞여요' (빈칸 뒤 '요' 잉여).\n"
        "금지: prompt '... 남산타워가 잘 ___ 임.' / answer '보여요' (빈칸 뒤 '임' 의미 없는 garbage).\n"
        "모호 금지: prompt '퇴근 시간에는 항상 길이 많이 ___.' / answer '밀려요' / "
        "오답에 '밀렸어요'(과거) 포함 — 문맥상 '밀렸어요'도 말이 되어 둘 다 정답 → 금지. "
        "이런 경우 '항상' 같은 현재 습관 단서를 분명히 하고, 오답은 '밀어요'(어휘/의미 오류) "
        "처럼 문맥에서 명백히 틀린 것으로 만들어라.\n\n"
        "각 문제 필드:\n"
        "- item_index: 위 [n] 의 n (정수)\n"
        "- kind: 'choice' 또는 'typing'\n"
        f"- prompt: 빈칸(___)을 포함한 '{lang_term}' 문장 (위 규칙 준수)\n"
        "- answer: 빈칸에 들어갈 정답(한 덩어리, 활용형)\n"
        "- options: choice 면 정답 포함 4개. 오답 3개는 문맥에서 명백히 틀린 것(위 5~8 규칙). "
        "정답과 시제/높임만 달라 문맥상 둘 다 맞는 보기는 금지. typing 이면 빈 배열\n"
        "- base_form: 빈칸에 들어갈 표현의 기본형/원형(예: 동사 '먹다'). 학습자가 풀 수 있도록 컨텍스트 제공\n"
        f"- explanation: 짧은 해설('{lang_def}' 언어로, 없으면 빈 문자열)\n\n"
        f"{avoid_block}"
        f"문법 항목:\n{item_block}"
    )


def _collect_into_buckets(
    parsed: list,
    items: list[dict],
    by_index: dict[int, list[dict]],
    seen_prompts: set[str],
) -> None:
    """Gemini 응답을 정규화/필터해 항목별 버킷에 누적한다(in-place).

    - _normalize_problem 으로 깨진/garbage 문제 폐기(품질 유지).
    - 완전히 동일한 prompt(seen_prompts)만 중복 제거(유사 예문은 허용).
    """
    item_count = len(items)
    for raw in parsed:
        norm = _normalize_problem(raw, item_count)
        if norm is None:
            continue
        if norm["prompt"] in seen_prompts:
            continue
        seen_prompts.add(norm["prompt"])
        idx = norm["item_index"]
        item = items[idx]
        by_index.setdefault(idx, []).append(
            {
                "item_id": item.get("id"),
                "kind": norm["kind"],
                "prompt": norm["prompt"],
                "answer": norm["answer"],
                "options": norm["options"],
                "base_form": norm["base_form"],
                "explanation": norm["explanation"],
            }
        )


def generate_problems_for_items(
    items: list[dict],
    lang_term: str,
    lang_def: str,
    target_count: int = 0,
) -> list[dict]:
    """선택된 문법 항목 리스트로부터 연습문제를 즉석 생성한다.

    items 각 원소: {id?, point, explanation, example?, level?, category?}
    반환 problem: {item_id, kind, prompt, answer, options, base_form, explanation}

    - target_count: 생성할 "총 문제 수". 항목들에 고르게 분배한다(반복 학습).
      0 이면 항목당 기본(_DEFAULT_PER_ITEM)개로 생성한다.
    - per_item 산정: 단일 항목이면 target 까지(캡 _PER_ITEM_MAX) 한 항목이 모두 채운다.
      멀티 항목이면 clamp(ceil(target / 항목수), 1, _PER_ITEM_MAX) 로 분배한다.
    - top-up: 1차 생성+필터 후 유효 문제가 target 보다 적으면, 부족분만큼 추가 Gemini
      호출로 채운다(총 호출 _MAX_GEN_ATTEMPTS 회 상한). 그래도 모자라면 가능한 만큼 반환.
    - _normalize_problem(중복/garbage 폐기)·보기 모호 방지 규칙은 유지(품질).
      개수는 top-up 으로 보충하되, 완전 동일 prompt 만 중복 제거(유사 예문 허용).
    - 기본은 choice(보기 4개), 난이도는 낮게. base_form 은 빈칸 표현의 기본형/원형.
    - items 가 비면 빈 리스트 반환(Gemini 호출 안 함).
    """
    if not items:
        return []

    item_count = len(items)
    if target_count and target_count > 0:
        if item_count == 1:
            per_item = min(target_count, _PER_ITEM_MAX)
        else:
            per_item = max(1, min(math.ceil(target_count / item_count), _PER_ITEM_MAX))
    else:
        per_item = _DEFAULT_PER_ITEM

    by_index: dict[int, list[dict]] = {}
    seen_prompts: set[str] = set()

    # 1차 생성
    prompt = _build_problems_prompt(items, lang_term, lang_def, per_item)
    parsed = _generate([prompt], _PROBLEMS_RESPONSE_SCHEMA)
    _collect_into_buckets(parsed, items, by_index, seen_prompts)

    def _total() -> int:
        return sum(len(b) for b in by_index.values())

    # top-up: target 에 못 미치면 부족분만큼 추가 호출(총 호출 _MAX_GEN_ATTEMPTS 회까지)
    attempts = 1
    if target_count and target_count > 0:
        while _total() < target_count and attempts < _MAX_GEN_ATTEMPTS:
            deficit = target_count - _total()
            # 부족분을 항목 수로 분배해 추가 요청(최소 항목당 1개)
            extra_per_item = max(1, math.ceil(deficit / item_count))
            extra_per_item = min(extra_per_item, _PER_ITEM_MAX)
            avoid = list(seen_prompts)
            topup_prompt = _build_problems_prompt(
                items, lang_term, lang_def, extra_per_item, avoid_prompts=avoid
            )
            try:
                more = _generate([topup_prompt], _PROBLEMS_RESPONSE_SCHEMA)
            except GrammarError:
                # top-up 실패는 치명적이지 않다 — 지금까지 모은 것으로 진행
                logger.warning("Grammar problem top-up call failed; returning partial")
                break
            before = _total()
            _collect_into_buckets(more, items, by_index, seen_prompts)
            attempts += 1
            # 진전이 없으면(새 문제 0개) 더 돌려도 의미 없으니 중단
            if _total() == before:
                break

    # 항목별 버킷 내부를 섞어 다양성 확보
    for bucket in by_index.values():
        random.shuffle(bucket)

    # 인터리브: 라운드 로빈으로 항목을 번갈아 뽑아 한 항목이 몰리지 않게 한다.
    ordered_indices = sorted(by_index.keys())
    result: list[dict] = []
    round_idx = 0
    while True:
        added = False
        for idx in ordered_indices:
            bucket = by_index[idx]
            if round_idx < len(bucket):
                result.append(bucket[round_idx])
                added = True
        if not added:
            break
        round_idx += 1

    # 최종 트림: target_count 가 있으면 그 수만큼만 반환
    if target_count and target_count > 0:
        result = result[:target_count]
    return result
