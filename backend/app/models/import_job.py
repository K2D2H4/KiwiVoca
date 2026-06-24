"""ImportJob 모델 — Gemini 이미지 추출 이력.

이미지 업로드 → Gemini 추출 1회당 한 행을 남긴다.
실제 카드 커밋은 별도(commit 엔드포인트)이며, deck_id 는 커밋된 경우에만 채워질 수 있다.
소유권은 user_id 로 검증한다.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImportJob(Base):
    """Gemini OCR 추출 작업 기록.

    - status: 'pending' | 'done' | 'failed' — 추출 진행/결과 상태
    - image_count: 업로드된 이미지 장수
    - extracted_count: 추출된 후보 카드 수 (실패 시 0)
    - error: 실패 사유 (한국어 사용자 메시지). 성공 시 null
    - deck_id: 추후 커밋 단계에서 연결될 수 있음 (extract 시점에는 보통 null)
    """

    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # 커밋 전이면 null, 덱 삭제 시에는 이력만 남기도록 SET NULL
    deck_id: Mapped[int | None] = mapped_column(
        ForeignKey("decks.id", ondelete="SET NULL"), nullable=True
    )
    # pending | done | failed
    status: Mapped[str] = mapped_column(String(10), default="pending", nullable=False)
    image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extracted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
