"""GrammarProblem 모델 — 문법 항목(GrammarItem)에 딸린 연습문제.

choice(객관식)/typing(주관식) 두 종류. options 는 choice 일 때 4개 선택지(정답 포함).
소유권은 item -> deck -> user 경로로 검증한다.
"""
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class GrammarProblem(Base):
    """문법 연습문제.

    - kind: 'choice'(객관식) | 'typing'(주관식)
    - prompt: 빈칸(___) 포함 문제 문장
    - answer: 정답
    - options: choice 일 때 선택지 배열(정답 포함). typing 이면 null
    - explanation: 해설 (선택)
    - position: 항목 내 정렬 순서
    """

    __tablename__ = "grammar_problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    grammar_item_id: Mapped[int] = mapped_column(
        ForeignKey("grammar_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # choice | typing
    kind: Mapped[str] = mapped_column(String(20), default="choice", nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    # choice 선택지 배열 (JSON). typing 이면 null
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    item: Mapped["GrammarItem"] = relationship(back_populates="problems")  # noqa: F821
