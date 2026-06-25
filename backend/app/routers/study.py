"""학습 라우터 — 학습 세트 조회 / 채점.

소유권 검증은 서비스 계층에서 수행하고, 여기서는 도메인 예외를
404(존재 노출 회피)로 변환한다.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.study import (
    AnswerRequest,
    AnswerResponse,
    LearnedRequest,
    LearnedResponse,
    StudyCard,
    StudySetResponse,
    StudySummaryResponse,
)
from app.services import study_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["study"])

_DECK_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="덱을 찾을 수 없습니다."
)


def _parse_deck_ids(raw: str) -> list[int]:
    """콤마 구분 deck_ids 파싱 (예: '1,2,3'). 형식 오류면 422.

    빈 토큰/공백은 무시하고, 정수가 아니면 422 로 거절한다.
    """
    ids: list[int] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            ids.append(int(token))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="deck_ids 형식이 올바르지 않습니다(콤마 구분 정수).",
            )
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deck_ids 가 비어 있습니다.",
        )
    return ids


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


@router.get("/study/cards", response_model=list[StudyCard])
def get_study_cards(
    deck_ids: str = Query(..., description="콤마 구분 덱 ID (예: 1,2,3)"),
    scope: str = Query(default="all", pattern="^(all|unlearned)$"),
    limit: int = Query(default=0, ge=0, le=1000),
    order: str = Query(default="weak", pattern="^(weak|random)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudyCard]:
    """멀티덱 학습 카드 조회.

    scope=unlearned 면 학습 완료 카드 제외. limit=0(또는 생략)이면 전체.
    deck_ids 중 하나라도 미소유/미존재면 404.
    """
    ids = _parse_deck_ids(deck_ids)
    try:
        return study_service.get_study_cards(db, current_user, ids, scope, limit, order)
    except study_service.DeckNotFound:
        raise _DECK_NOT_FOUND


@router.get("/study/summary", response_model=StudySummaryResponse)
def get_study_summary(
    deck_ids: str = Query(..., description="콤마 구분 덱 ID (예: 1,2)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySummaryResponse:
    """선택한 덱들의 학습 진행 요약 (total/learned/unlearned). 미소유 포함 시 404."""
    ids = _parse_deck_ids(deck_ids)
    try:
        return study_service.get_study_summary(db, current_user, ids)
    except study_service.DeckNotFound:
        raise _DECK_NOT_FOUND


@router.post("/study/learned", response_model=LearnedResponse)
def set_learned(
    payload: LearnedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LearnedResponse:
    """학습 완료 토글 — card_progress.is_learned 설정 (upsert)."""
    try:
        return study_service.set_learned(
            db, current_user, payload.card_id, payload.is_learned
        )
    except study_service.CardNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="카드를 찾을 수 없습니다."
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
