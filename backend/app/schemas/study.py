"""Study Pydantic v2 스키마 — 학습 세트 / 채점 요청·응답."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CardProgressInfo(BaseModel):
    """카드 진척 요약 (학습 화면 표시용)."""

    box: int
    correct_count: int
    wrong_count: int
    last_studied_at: datetime | None = None


class StudyCard(BaseModel):
    """학습 세트에 포함되는 카드 (카드 본문 + 진척).

    진척 행이 없는 카드는 box=0, correct=0, wrong=0 으로 채워 반환한다.
    객관식 오답 선택지는 프론트가 다른 카드 definition 으로 구성하므로
    서버는 카드 본문만 제공한다.
    """

    id: int
    deck_id: int
    term: str
    reading: str | None = None
    definition: str
    example: str | None = None
    position: int
    progress: CardProgressInfo


class StudySetResponse(BaseModel):
    """학습 세트 응답."""

    deck_id: int
    cards: list[StudyCard]


class AnswerRequest(BaseModel):
    """채점 요청. is_correct 로 정답/오답을 전달한다."""

    card_id: int
    is_correct: bool


class AnswerResponse(BaseModel):
    """채점 후 갱신된 진척."""

    model_config = ConfigDict(from_attributes=True)

    card_id: int
    box: int
    correct_count: int
    wrong_count: int
