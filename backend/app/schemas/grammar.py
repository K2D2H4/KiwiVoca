"""문법 학습 Pydantic v2 스키마 (요청/응답).

설계 변경(2026-06): 추출/생성은 문법 "항목"만 반환·저장한다(문제 미저장).
연습문제는 저장하지 않고 POST /practice 에서 선택 항목으로부터 즉석 생성한다.

extract/generate: 문법 항목 후보 리스트 반환 (자동 커밋 X)
commit: 기존 deck_id 또는 새 덱 + 검수한 항목 배열 → 항목만 일괄 생성
practice: 선택 항목 필터 → 연습문제 즉석 생성
answer/learned: 항목 단위 진척 갱신
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ----------------------------- 후보(검수용) -----------------------------

class GrammarItemCandidate(BaseModel):
    """문법 항목 후보 1개 (항목만, 연습문제 없음)."""

    point: str = Field(min_length=1, max_length=500)
    explanation: str = Field(min_length=1)
    example: str | None = None
    level: str = Field(default="", max_length=50)
    category: str = Field(default="", max_length=100)


class CandidatesResponse(BaseModel):
    """extract/generate 공통 응답 — 후보 항목 리스트."""

    candidates: list[GrammarItemCandidate]


# ----------------------------- 생성 요청 -----------------------------

class GenerateRequest(BaseModel):
    """텍스트 기반 문법 생성 요청."""

    lang_term: str = Field(min_length=1, max_length=10)
    lang_def: str = Field(min_length=1, max_length=10)
    level: str = Field(min_length=1, max_length=50)
    topic: str | None = Field(default=None, max_length=200)
    count: int = Field(default=5, ge=1, le=20)


# ----------------------------- 커밋 -----------------------------

class CommitNewDeck(BaseModel):
    """commit 시 새 문법 덱을 만들 때의 덱 정보 (kind 는 항상 grammar)."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    lang_term: str = Field(default="en", min_length=1, max_length=10)
    lang_def: str = Field(default="ko", min_length=1, max_length=10)


class GrammarCommitRequest(BaseModel):
    """문법 항목 일괄 커밋 요청.

    deck_id(기존 grammar 덱) 또는 new_deck(새 덱) 중 정확히 하나를 지정한다.
    """

    deck_id: int | None = None
    new_deck: CommitNewDeck | None = None
    items: list[GrammarItemCandidate] = Field(min_length=1)

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "GrammarCommitRequest":
        if (self.deck_id is None) == (self.new_deck is None):
            raise ValueError("deck_id 또는 new_deck 중 정확히 하나를 지정해야 합니다.")
        return self


# ----------------------------- 조회 응답 -----------------------------

class GrammarProgressInfo(BaseModel):
    """문법 항목 진척 요약."""

    box: int
    correct_count: int
    wrong_count: int
    is_learned: bool = False
    last_studied_at: datetime | None = None


class GrammarItemResponse(BaseModel):
    """문법 항목 응답 (항목 + 현재 사용자 진척). 연습문제는 포함하지 않는다."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    point: str
    explanation: str
    example: str | None = None
    level: str
    category: str
    position: int
    progress: GrammarProgressInfo


class GrammarCommitResponse(BaseModel):
    """commit 응답 — 대상 덱 + 생성된 항목 수."""

    deck: "DeckResponse"
    item_count: int


# ----------------------------- 필터 -----------------------------

class CategoryCount(BaseModel):
    """카테고리별 항목 수."""

    category: str
    count: int


class LevelGroup(BaseModel):
    """레벨별 항목 수 + 하위 카테고리 계층."""

    level: str
    count: int
    categories: list[CategoryCount]


class FiltersResponse(BaseModel):
    """다단계 필터 응답 (레벨 → 카테고리 계층)."""

    levels: list[LevelGroup]


# ----------------------------- 연습 출제 (즉석 생성) -----------------------------

class PracticeRequest(BaseModel):
    """연습 시작 요청 — 선택된 덱/필터로 항목을 고른 뒤 문제를 즉석 생성한다."""

    deck_ids: list[int] = Field(min_length=1)
    levels: list[str] | None = None
    categories: list[str] | None = None
    scope: Literal["all", "unlearned"] = "all"
    limit: int = Field(default=0, ge=0, le=1000)  # 0=전체(항목 선택 상한)
    order: Literal["weak", "random"] = "weak"


class PracticeProblem(BaseModel):
    """즉석 생성된 연습문제 단위 — 문제 + 부모 항목 컨텍스트 + 항목 진척.

    저장하지 않으므로 problem_id 는 없다. item_id 로 진척을 갱신한다.
    """

    item_id: int
    kind: str
    prompt: str
    answer: str
    options: list[str] | None = None
    base_form: str = ""  # 빈칸에 들어갈 표현의 기본형/원형
    explanation: str | None = None
    # 부모 항목 컨텍스트
    point: str
    item_explanation: str
    level: str
    category: str
    progress: GrammarProgressInfo


class PracticeResponse(BaseModel):
    """연습 응답 — 즉석 생성된 문제 리스트 (비면 빈 배열)."""

    problems: list[PracticeProblem]


# ----------------------------- 채점 / 학습완료 -----------------------------

class GrammarAnswerRequest(BaseModel):
    """문법 채점 요청 (항목 단위 진척 갱신)."""

    item_id: int
    is_correct: bool


class GrammarAnswerResponse(BaseModel):
    """채점 후 갱신된 항목 진척."""

    item_id: int
    box: int
    correct_count: int
    wrong_count: int


class GrammarLearnedRequest(BaseModel):
    """학습 완료 토글 요청."""

    item_id: int
    is_learned: bool


class GrammarLearnedResponse(BaseModel):
    """학습 완료 토글 결과."""

    item_id: int
    is_learned: bool


# DeckResponse 전방참조 해소
from app.schemas.deck import DeckResponse  # noqa: E402

GrammarCommitResponse.model_rebuild()
