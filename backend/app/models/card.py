"""Card 모델 — 덱에 속한 학습 카드 (단어·문법 공용).

문법 카드도 동일 구조: term=문법 포인트, definition=설명, example=예문.
소유권은 부모 deck.user_id 로 검증한다.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Card(Base):
    """학습 카드.

    - term: 단어/문법 포인트, reading: 발음/요미가나 등(선택)
    - definition: 뜻/설명, example: 예문(선택)
    - position: 덱 내 정렬 순서
    """

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    deck_id: Mapped[int] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    term: Mapped[str] = mapped_column(String(500), nullable=False)
    reading: Mapped[str | None] = mapped_column(String(500), nullable=True)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    deck: Mapped["Deck"] = relationship(back_populates="cards")  # noqa: F821
