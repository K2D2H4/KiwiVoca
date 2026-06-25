"""GrammarItem 모델 — 문법 덱(decks.kind='grammar')에 속한 문법 항목.

단어 카드(Card)와 달리 문법 항목은 설명 + 연습문제(GrammarProblem) 묶음을 가진다.
소유권은 부모 deck.user_id 로 검증한다.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GrammarItem(Base):
    """문법 항목.

    - point: 문법 포인트(예: '은/는', '~ている')
    - explanation: 문법 설명 (lang_def 언어로)
    - example: 예문 (선택)
    - level: 난이도 라벨(초급/중급/고급 등, AI 일관 태깅)
    - category: 세부 분류(조사/어미/시제 등, AI 태깅)
    - position: 덱 내 정렬 순서
    """

    __tablename__ = "grammar_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    deck_id: Mapped[int] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    point: Mapped[str] = mapped_column(String(500), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # 문법 항목 삭제 시 연습문제도 함께 삭제 (orphan 제거)
    problems: Mapped[list["GrammarProblem"]] = relationship(  # noqa: F821
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="GrammarProblem.position",
    )
