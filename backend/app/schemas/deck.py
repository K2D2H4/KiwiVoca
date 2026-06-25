"""Deck Pydantic v2 스키마 (요청/응답)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DeckCreate(BaseModel):
    """덱 생성 요청."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    lang_term: str = Field(default="en", min_length=1, max_length=10)
    lang_def: str = Field(default="ko", min_length=1, max_length=10)
    kind: Literal["vocab", "grammar"] = "vocab"
    is_public: bool = False


class DeckUpdate(BaseModel):
    """덱 부분 수정 요청. 전달된 필드만 변경한다."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    lang_term: str | None = Field(default=None, min_length=1, max_length=10)
    lang_def: str | None = Field(default=None, min_length=1, max_length=10)
    kind: Literal["vocab", "grammar"] | None = None
    is_public: bool | None = None


class DeckResponse(BaseModel):
    """덱 응답. card_count 는 라우터에서 계산해 채운다."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    description: str | None = None
    lang_term: str
    lang_def: str
    kind: str
    is_public: bool
    card_count: int = 0
    created_at: datetime
    updated_at: datetime


class DeckMergeRequest(BaseModel):
    """덱 병합 요청 — 선택 덱들의 카드+문법 항목을 새 덱으로 전부 복사."""

    deck_ids: list[int] = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class PublicDeckResponse(BaseModel):
    """공개 덱 목록 응답. 내부 user_id 등 민감정보는 노출하지 않고 owner_name 만 제공."""

    id: int
    title: str
    description: str | None = None
    lang_term: str
    lang_def: str
    kind: str
    card_count: int = 0
    owner_name: str  # 소유자 display_name
    created_at: datetime
