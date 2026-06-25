"""GrammarProgress 모델 — 사용자 x 문법 항목 학습 진척 (라이트너 박스 SRS).

카드 진척(CardProgress)과 동일한 박스 모델을 문법 항목 단위로 적용한다.
(사용자, 문법 항목) 조합당 한 행만 존재한다.
소유권은 grammar_item -> deck -> user 경로로 검증한다.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GrammarProgress(Base):
    """문법 항목별 학습 진척.

    - correct_count / wrong_count: 누적 정답/오답 횟수
    - box: 라이트너 박스 0~5 (낮을수록 약한 항목, 자주 출제)
      정답 시 +1(최대 5), 오답 시 -1(최소 0)
    - is_learned: '학습 완료' 수동 체크 (box 와 독립). scope=unlearned 출제 제외 기준.
    - last_studied_at: 마지막 학습 시각 (학습 전이면 null)
    """

    __tablename__ = "grammar_progress"
    # 한 사용자가 같은 문법 항목에 대해 진척 행을 하나만 갖도록 강제 (upsert 기준)
    __table_args__ = (
        UniqueConstraint(
            "user_id", "grammar_item_id", name="uq_grammar_progress_user_item"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    grammar_item_id: Mapped[int] = mapped_column(
        ForeignKey("grammar_items.id", ondelete="CASCADE"), index=True, nullable=False
    )
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 라이트너 박스 0~5
    box: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 학습 완료 수동 체크 (box 와 독립). scope=unlearned 출제 제외 기준.
    is_learned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_studied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
