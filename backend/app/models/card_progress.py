"""CardProgress 모델 — 사용자 x 카드 학습 진척 (라이트너 박스 간단 SRS).

사용자가 카드를 학습할 때마다 정답/오답을 누적하고, 라이트너 박스(0~5)로
약한 카드 우선 출제를 가능하게 한다. (사용자, 카드) 조합당 한 행만 존재한다.
소유권은 card -> deck -> user 경로로 검증한다.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CardProgress(Base):
    """카드별 학습 진척.

    - correct_count / wrong_count: 누적 정답/오답 횟수
    - box: 라이트너 박스 0~5 (낮을수록 약한 카드, 자주 출제)
      정답 시 +1(최대 5), 오답 시 -1(최소 0)
    - last_studied_at: 마지막 학습 시각 (학습 전이면 null)
    """

    __tablename__ = "card_progress"
    # 한 사용자가 같은 카드에 대해 진척 행을 하나만 갖도록 강제 (upsert 기준)
    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_card_progress_user_card"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"), index=True, nullable=False
    )
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 라이트너 박스 0~5
    box: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_studied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
