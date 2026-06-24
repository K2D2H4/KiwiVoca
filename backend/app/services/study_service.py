"""학습 세션/채점 서비스 — 학습 세트 조회 + 라이트너 박스 진척 갱신.

모든 조회/갱신은 소유권을 검증한다:
- 학습 세트: deck.user_id == user.id
- 채점: card -> deck -> user.id 경로로 카드 소유 확인

진척이 없는 카드는 box=0 으로 취급한다.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.card_progress import CardProgress
from app.models.deck import Deck
from app.models.user import User
from app.schemas.study import (
    AnswerResponse,
    CardProgressInfo,
    StudyCard,
    StudySetResponse,
)

# 라이트너 박스 경계
_BOX_MIN = 0
_BOX_MAX = 5


class DeckNotFound(Exception):
    """덱이 없거나 현재 사용자 소유가 아님."""


class CardNotFound(Exception):
    """카드가 없거나 현재 사용자 소유가 아님."""


def get_study_set(
    db: Session,
    user: User,
    deck_id: int,
    limit: int = 20,
    order: str = "weak",
) -> StudySetResponse:
    """학습 세트 조회.

    order='weak' : 약한 카드 우선 (box 오름차순 → last_studied_at 오래된 순,
                   학습 안 한 카드(null)가 가장 먼저).
    order='random': 무작위.
    진척 행이 없는 카드는 box=0 으로 취급한다.
    """
    # 1) 덱 소유권 검증 (없거나 타인 소유면 예외)
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).first()
    if deck is None:
        raise DeckNotFound()

    # 2) 카드 + 해당 사용자의 진척을 LEFT JOIN (진척 없으면 행 유지)
    stmt = (
        select(Card, CardProgress)
        .outerjoin(
            CardProgress,
            (CardProgress.card_id == Card.id) & (CardProgress.user_id == user.id),
        )
        .where(Card.deck_id == deck_id)
    )

    if order == "random":
        stmt = stmt.order_by(func.random())
    else:
        # 약한 카드 우선: box 낮은 순 → 학습 오래된 순(null 우선) → 정렬 안정성용 position/id
        box_value = func.coalesce(CardProgress.box, _BOX_MIN)
        stmt = stmt.order_by(
            box_value.asc(),
            CardProgress.last_studied_at.asc().nulls_first(),
            Card.position.asc(),
            Card.id.asc(),
        )

    stmt = stmt.limit(limit)
    rows = db.execute(stmt).all()

    cards: list[StudyCard] = []
    for card, progress in rows:
        if progress is None:
            info = CardProgressInfo(
                box=_BOX_MIN, correct_count=0, wrong_count=0, last_studied_at=None
            )
        else:
            info = CardProgressInfo(
                box=progress.box,
                correct_count=progress.correct_count,
                wrong_count=progress.wrong_count,
                last_studied_at=progress.last_studied_at,
            )
        cards.append(
            StudyCard(
                id=card.id,
                deck_id=card.deck_id,
                term=card.term,
                reading=card.reading,
                definition=card.definition,
                example=card.example,
                position=card.position,
                progress=info,
            )
        )

    return StudySetResponse(deck_id=deck_id, cards=cards)


def record_answer(
    db: Session,
    user: User,
    card_id: int,
    is_correct: bool,
) -> AnswerResponse:
    """채점 기록 — 라이트너 박스 갱신 (get-or-create upsert).

    정답: box=min(box+1, 5), correct_count+1
    오답: box=max(box-1, 0), wrong_count+1
    last_studied_at 갱신. 동시성은 UNIQUE 제약 + IntegrityError 재조회로 처리.
    """
    # 1) 카드 소유권 검증 (card -> deck -> user)
    card = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Card.id == card_id, Deck.user_id == user.id)
        .first()
    )
    if card is None:
        raise CardNotFound()

    # 2) 진척 get-or-create
    progress = (
        db.query(CardProgress)
        .filter(CardProgress.user_id == user.id, CardProgress.card_id == card_id)
        .first()
    )
    if progress is None:
        progress = CardProgress(
            user_id=user.id,
            card_id=card_id,
            correct_count=0,
            wrong_count=0,
            box=_BOX_MIN,
        )
        db.add(progress)
        try:
            db.flush()
        except IntegrityError:
            # 동시 요청이 먼저 행을 만든 경우 — 롤백 후 기존 행 재조회
            db.rollback()
            progress = (
                db.query(CardProgress)
                .filter(
                    CardProgress.user_id == user.id,
                    CardProgress.card_id == card_id,
                )
                .first()
            )
            # 재조회 실패(경쟁 중 행 삭제 등) 시 None 접근으로 AttributeError 가 나지
            # 않도록 명확한 예외로 변환한다 — 클라이언트는 재시도하면 된다.
            if progress is None:
                raise CardNotFound()

    # 3) 박스/카운트 갱신
    if is_correct:
        progress.box = min(progress.box + 1, _BOX_MAX)
        progress.correct_count += 1
    else:
        progress.box = max(progress.box - 1, _BOX_MIN)
        progress.wrong_count += 1
    progress.last_studied_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(progress)

    return AnswerResponse(
        card_id=card_id,
        box=progress.box,
        correct_count=progress.correct_count,
        wrong_count=progress.wrong_count,
    )
