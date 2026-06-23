"""Import(Gemini 추출/커밋) Pydantic v2 스키마.

extract: 멀티파트(이미지+폼) 요청 → 후보 카드 리스트 응답 (자동 커밋 X)
commit: 기존 deck_id 또는 새 덱 정보 + 검수한 카드 배열 → 카드 일괄 생성
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.card import CardCreate, CardResponse
from app.schemas.deck import DeckResponse


class ExtractCandidate(BaseModel):
    """추출된 후보 카드 1개 (프론트에서 편집 후 commit 으로 전송)."""

    term: str
    reading: str | None = None
    definition: str
    example: str | None = None


class ExtractResponse(BaseModel):
    """/import/extract 응답 — 후보 리스트 + 메타."""

    job_id: int
    image_count: int
    extracted_count: int
    candidates: list[ExtractCandidate]


class CommitNewDeck(BaseModel):
    """commit 시 새 덱을 만들 때의 덱 정보."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    lang_term: str = Field(default="en", min_length=1, max_length=10)
    lang_def: str = Field(default="ko", min_length=1, max_length=10)
    kind: Literal["vocab", "grammar"] = "vocab"
    is_public: bool = False


class CommitRequest(BaseModel):
    """/import/commit 요청.

    deck_id(기존 덱) 또는 new_deck(새 덱) 중 정확히 하나를 지정한다.
    cards 는 사용자가 검수/수정한 최종 카드 배열.
    """

    deck_id: int | None = None
    new_deck: CommitNewDeck | None = None
    cards: list[CardCreate] = Field(min_length=1)
    # extract 시 발급된 job 과 연결 (선택)
    job_id: int | None = None

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "CommitRequest":
        if (self.deck_id is None) == (self.new_deck is None):
            raise ValueError("deck_id 또는 new_deck 중 정확히 하나를 지정해야 합니다.")
        return self


class CommitResponse(BaseModel):
    """/import/commit 응답 — 대상 덱 + 생성된 카드."""

    model_config = ConfigDict(from_attributes=True)

    deck: DeckResponse
    cards: list[CardResponse]
