"""Card Pydantic v2 스키마 (요청/응답)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CardCreate(BaseModel):
    """카드 생성 요청. position 미지정 시 라우터가 덱 끝에 추가한다."""

    term: str = Field(min_length=1, max_length=500)
    reading: str | None = Field(default=None, max_length=500)
    definition: str = Field(min_length=1)
    example: str | None = None
    position: int | None = Field(default=None, ge=0)


class CardUpdate(BaseModel):
    """카드 부분 수정 요청. 전달된 필드만 변경한다."""

    term: str | None = Field(default=None, min_length=1, max_length=500)
    reading: str | None = Field(default=None, max_length=500)
    definition: str | None = Field(default=None, min_length=1)
    example: str | None = None
    position: int | None = Field(default=None, ge=0)


class CardBulkRequest(BaseModel):
    """카드 대량 추가 요청 (Gemini 추출 검수 후 커밋 등)."""

    cards: list[CardCreate] = Field(min_length=1)


class CardResponse(BaseModel):
    """카드 응답."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    term: str
    reading: str | None = None
    definition: str
    example: str | None = None
    position: int
    created_at: datetime
