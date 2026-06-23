"""학습 라우터 — 학습 세트 조회 / 채점.

소유권 검증은 서비스 계층에서 수행하고, 여기서는 도메인 예외를
404(존재 노출 회피)로 변환한다.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.study import AnswerRequest, AnswerResponse, StudySetResponse
from app.services import study_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["study"])


@router.get("/decks/{deck_id}/study", response_model=StudySetResponse)
def get_study_set(
    deck_id: int,
    limit: int = Query(default=20, ge=1, le=200),
    order: str = Query(default="weak", pattern="^(weak|random)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySetResponse:
    """덱의 학습 세트 조회. order=weak(약한 카드 우선) | random."""
    try:
        return study_service.get_study_set(db, current_user, deck_id, limit, order)
    except study_service.DeckNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="덱을 찾을 수 없습니다."
        )


@router.post("/study/answer", response_model=AnswerResponse)
def submit_answer(
    payload: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    """카드 채점 — 라이트너 박스/진척 갱신."""
    try:
        return study_service.record_answer(
            db, current_user, payload.card_id, payload.is_correct
        )
    except study_service.CardNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="카드를 찾을 수 없습니다."
        )
