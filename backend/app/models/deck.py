"""Deck 모델 — 단어장/세트 (단어·문법 공용).

decks.kind 로 단어(vocab)/문법(grammar)을 구분하며, 카드 구조는 동일하다.
모든 도메인 쿼리는 user_id 소유권 검증 필수.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Deck(Base):
    """학습 세트 (단어장 또는 문법 세트).

    - kind: 'vocab' | 'grammar' — 카드 구조는 동일하고 의미만 다름
    - lang_term: 학습 언어 코드 (예: 'en'), lang_def: 모국어 코드 (예: 'ko')
    """

    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # 학습 언어 / 모국어 (ISO 코드 같은 짧은 문자열)
    lang_term: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    lang_def: Mapped[str] = mapped_column(String(10), default="ko", nullable=False)
    # vocab | grammar — 카드 구조 공용, 의미 구분용
    kind: Mapped[str] = mapped_column(String(10), default="vocab", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # 덱 삭제 시 카드도 함께 삭제 (orphan 제거)
    cards: Mapped[list["Card"]] = relationship(  # noqa: F821
        back_populates="deck",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
