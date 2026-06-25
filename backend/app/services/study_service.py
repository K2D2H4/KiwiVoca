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
    LearnedResponse,
    StudyCard,
    StudySetResponse,
    StudySummaryResponse,
)

# 라이트너 박스 경계
_BOX_MIN = 0
_BOX_MAX = 5


class DeckNotFound(Exception):
    """덱이 없거나 현재 사용자 소유가 아님."""


class CardNotFound(Exception):
    """카드가 없거나 현재 사용자 소유가 아님."""


def _progress_info(progress: CardProgress | None) -> CardProgressInfo:
    """진척 행(없을 수 있음) → 응답용 진척 정보. 없으면 box=0/미학습 기본값."""
    if progress is None:
        return CardProgressInfo(
            box=_BOX_MIN,
            correct_count=0,
            wrong_count=0,
            is_learned=False,
            last_studied_at=None,
        )
    return CardProgressInfo(
        box=progress.box,
        correct_count=progress.correct_count,
        wrong_count=progress.wrong_count,
        is_learned=progress.is_learned,
        last_studied_at=progress.last_studied_at,
    )


def _to_study_card(card: Card, progress: CardProgress | None) -> StudyCard:
    """ORM 카드 + 진척 → StudyCard 응답."""
    return StudyCard(
        id=card.id,
        deck_id=card.deck_id,
        term=card.term,
        reading=card.reading,
        definition=card.definition,
        example=card.example,
        position=card.position,
        progress=_progress_info(progress),
    )


def _verify_owned_decks(db: Session, user: User, deck_ids: list[int]) -> None:
    """deck_ids 가 모두 현재 사용자 소유인지 검증. 하나라도 아니면 DeckNotFound.

    중복 입력은 무시하고, 존재+소유한 덱 수가 고유 요청 수와 일치하는지로 판단한다.
    """
    unique_ids = set(deck_ids)
    owned = (
        db.query(Deck.id)
        .filter(Deck.id.in_(unique_ids), Deck.user_id == user.id)
        .all()
    )
    if len({row[0] for row in owned}) != len(unique_ids):
        raise DeckNotFound()


def _build_study_cards(
    db: Session,
    user: User,
    deck_ids: list[int],
    scope: str,
    limit: int,
    order: str,
) -> list[StudyCard]:
    """멀티덱 학습 카드 조회 코어 (소유권은 호출자가 사전 검증).

    - scope='unlearned' : is_learned=true 카드 제외 (진척 없으면 미학습으로 포함).
    - order='weak'      : box 낮은 순 → 학습 오래된 순(null 우선) → position/id.
    - order='random'    : 무작위.
    - limit<=0          : 전체 (limit 미적용).
    진척 행이 없는 카드는 box=0 으로 취급한다.
    """
    # 카드 + 해당 사용자의 진척을 LEFT JOIN (진척 없으면 행 유지)
    stmt = (
        select(Card, CardProgress)
        .outerjoin(
            CardProgress,
            (CardProgress.card_id == Card.id) & (CardProgress.user_id == user.id),
        )
        .where(Card.deck_id.in_(deck_ids))
    )

    if scope == "unlearned":
        # 진척이 없거나(=미학습) is_learned=false 인 카드만
        stmt = stmt.where(
            func.coalesce(CardProgress.is_learned, False).is_(False)
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

    if limit > 0:
        stmt = stmt.limit(limit)

    rows = db.execute(stmt).all()
    return [_to_study_card(card, progress) for card, progress in rows]


def get_study_set(
    db: Session,
    user: User,
    deck_id: int,
    limit: int = 20,
    order: str = "weak",
) -> StudySetResponse:
    """단일 덱 학습 세트 조회 (하위호환). 내부적으로 멀티덱 코어를 재사용한다.

    order='weak' : 약한 카드 우선, order='random': 무작위. 진척 없으면 box=0.
    """
    # 덱 소유권 검증 (없거나 타인 소유면 예외)
    _verify_owned_decks(db, user, [deck_id])
    cards = _build_study_cards(
        db, user, [deck_id], scope="all", limit=limit, order=order
    )
    return StudySetResponse(deck_id=deck_id, cards=cards)


def get_study_cards(
    db: Session,
    user: User,
    deck_ids: list[int],
    scope: str = "all",
    limit: int = 0,
    order: str = "weak",
) -> list[StudyCard]:
    """멀티덱 학습 카드 조회. deck_ids 전부 현재 사용자 소유여야 한다.

    하나라도 미소유/미존재면 DeckNotFound. scope=unlearned 면 완료 카드 제외.
    limit<=0(또는 생략) 이면 전체 반환.
    """
    if not deck_ids:
        raise DeckNotFound()
    _verify_owned_decks(db, user, deck_ids)
    return _build_study_cards(db, user, deck_ids, scope, limit, order)


def get_study_summary(
    db: Session,
    user: User,
    deck_ids: list[int],
) -> StudySummaryResponse:
    """선택한 덱들의 학습 진행 요약 (total/learned/unlearned).

    deck_ids 전부 현재 사용자 소유여야 한다 (하나라도 아니면 DeckNotFound).
    learned = is_learned=true 인 진척이 있는 카드 수, unlearned = total - learned.
    """
    if not deck_ids:
        raise DeckNotFound()
    _verify_owned_decks(db, user, deck_ids)
    unique_ids = list(set(deck_ids))

    total = (
        db.query(func.count(Card.id)).filter(Card.deck_id.in_(unique_ids)).scalar()
        or 0
    )
    # 완료: 해당 덱들의 카드 중 현재 사용자 진척이 is_learned=true 인 카드 수
    learned = (
        db.query(func.count(Card.id))
        .join(
            CardProgress,
            (CardProgress.card_id == Card.id)
            & (CardProgress.user_id == user.id),
        )
        .filter(
            Card.deck_id.in_(unique_ids),
            CardProgress.is_learned.is_(True),
        )
        .scalar()
        or 0
    )
    return StudySummaryResponse(
        total=total, learned=learned, unlearned=total - learned
    )


def set_learned(
    db: Session,
    user: User,
    card_id: int,
    is_learned: bool,
) -> LearnedResponse:
    """학습 완료 토글 — card_progress upsert 로 is_learned 설정.

    card -> deck -> user 소유권 검증. 진척 행이 없으면 생성한다.
    동시 생성 경쟁은 UNIQUE 제약 + IntegrityError 재조회로 처리한다.
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
            is_learned=is_learned,
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
            if progress is None:
                raise CardNotFound()
            progress.is_learned = is_learned
    else:
        progress.is_learned = is_learned

    db.commit()
    return LearnedResponse(card_id=card_id, is_learned=is_learned)


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
