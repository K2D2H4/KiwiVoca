"""진척 통계 라우터 — 현재 사용자 기준 집계 조회.

모든 통계는 인증된 사용자 소유 데이터만 집계한다 (서비스 계층에서 소유권 필터).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.stats import DeckStat, StatsOverview
from app.services import stats_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview", response_model=StatsOverview)
def stats_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatsOverview:
    """전체 진척 요약 (덱/카드/학습/정답률/연속 학습일 등)."""
    return stats_service.get_overview(db, current_user)


@router.get("/decks", response_model=list[DeckStat])
def stats_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DeckStat]:
    """덱별 진척 통계 (최신순)."""
    return stats_service.get_deck_stats(db, current_user)
