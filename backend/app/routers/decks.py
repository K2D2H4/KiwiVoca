"""덱 & 카드 CRUD 라우터.

모든 deck/card 접근은 현재 사용자 소유권을 검증한다.
타인 리소스 / 미존재 리소스는 일괄 404 로 응답해 존재 여부 노출을 막는다.
카드는 부모 deck 의 소유권으로 검증한다.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.user import User
from app.schemas.card import (
    CardBulkRequest,
    CardCreate,
    CardResponse,
    CardUpdate,
)
from app.schemas.deck import DeckCreate, DeckResponse, DeckUpdate
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["decks"])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="덱을 찾을 수 없습니다.")
_CARD_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="카드를 찾을 수 없습니다."
)


def _get_owned_deck(deck_id: int, user: User, db: Session) -> Deck:
    """현재 사용자 소유의 덱을 조회. 없거나 타인 소유면 404."""
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).first()
    if deck is None:
        raise _NOT_FOUND
    return deck


def _get_owned_card(card_id: int, user: User, db: Session) -> Card:
    """현재 사용자 소유의 카드를 조회 (부모 덱 소유로 검증). 없거나 타인 소유면 404."""
    card = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Card.id == card_id, Deck.user_id == user.id)
        .first()
    )
    if card is None:
        raise _CARD_NOT_FOUND
    return card


def _deck_card_count(deck_id: int, db: Session) -> int:
    """단일 덱의 카드 수."""
    return db.query(func.count(Card.id)).filter(Card.deck_id == deck_id).scalar() or 0


def _deck_to_response(deck: Deck, card_count: int) -> DeckResponse:
    """ORM 덱 + 카드 수 → 응답 스키마."""
    data = DeckResponse.model_validate(deck)
    data.card_count = card_count
    return data


# ----------------------------- 덱 -----------------------------

@router.get("/decks", response_model=list[DeckResponse])
def list_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DeckResponse]:
    """내 덱 목록 (최신순). 각 덱의 card_count 포함."""
    decks = (
        db.query(Deck)
        .filter(Deck.user_id == current_user.id)
        .order_by(Deck.created_at.desc(), Deck.id.desc())
        .all()
    )
    if not decks:
        return []

    # N+1 회피: 내 덱들의 카드 수를 한 번에 집계
    deck_ids = [d.id for d in decks]
    counts = dict(
        db.execute(
            select(Card.deck_id, func.count(Card.id))
            .where(Card.deck_id.in_(deck_ids))
            .group_by(Card.deck_id)
        ).all()
    )
    return [_deck_to_response(d, counts.get(d.id, 0)) for d in decks]


@router.post("/decks", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
def create_deck(
    payload: DeckCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeckResponse:
    """덱 생성."""
    deck = Deck(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        lang_term=payload.lang_term,
        lang_def=payload.lang_def,
        kind=payload.kind,
        is_public=payload.is_public,
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return _deck_to_response(deck, 0)


@router.get("/decks/{deck_id}", response_model=DeckResponse)
def get_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeckResponse:
    """덱 상세 (card_count 포함). 카드 목록은 GET /decks/{id}/cards 로 별도 조회."""
    deck = _get_owned_deck(deck_id, current_user, db)
    return _deck_to_response(deck, _deck_card_count(deck.id, db))


@router.patch("/decks/{deck_id}", response_model=DeckResponse)
def update_deck(
    deck_id: int,
    payload: DeckUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DeckResponse:
    """덱 부분 수정. 전달된 필드만 변경."""
    deck = _get_owned_deck(deck_id, current_user, db)

    # exclude_unset: 클라이언트가 실제로 보낸 필드만 반영
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deck, field, value)

    db.commit()
    db.refresh(deck)
    return _deck_to_response(deck, _deck_card_count(deck.id, db))


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """덱 삭제 (카드 cascade 삭제)."""
    deck = _get_owned_deck(deck_id, current_user, db)
    db.delete(deck)
    db.commit()


# ----------------------------- 카드 -----------------------------

@router.get("/decks/{deck_id}/cards", response_model=list[CardResponse])
def list_cards(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Card]:
    """덱의 카드 목록 (position, id 순)."""
    _get_owned_deck(deck_id, current_user, db)
    return (
        db.query(Card)
        .filter(Card.deck_id == deck_id)
        .order_by(Card.position.asc(), Card.id.asc())
        .all()
    )


def _next_position(deck_id: int, db: Session) -> int:
    """덱 내 다음 position (현재 최대 + 1, 비어있으면 0)."""
    current_max = db.query(func.max(Card.position)).filter(Card.deck_id == deck_id).scalar()
    return 0 if current_max is None else current_max + 1


@router.post(
    "/decks/{deck_id}/cards",
    response_model=CardResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_card(
    deck_id: int,
    payload: CardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Card:
    """카드 1개 추가. position 미지정 시 덱 끝에 배치."""
    _get_owned_deck(deck_id, current_user, db)

    position = payload.position if payload.position is not None else _next_position(deck_id, db)
    card = Card(
        deck_id=deck_id,
        term=payload.term,
        reading=payload.reading,
        definition=payload.definition,
        example=payload.example,
        position=position,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.post(
    "/decks/{deck_id}/cards/bulk",
    response_model=list[CardResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_cards_bulk(
    deck_id: int,
    payload: CardBulkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Card]:
    """카드 대량 추가 (Gemini 추출 검수 후 커밋 등). 입력 순서대로 덱 끝에 이어 배치."""
    _get_owned_deck(deck_id, current_user, db)

    base = _next_position(deck_id, db)
    cards: list[Card] = []
    for offset, item in enumerate(payload.cards):
        position = item.position if item.position is not None else base + offset
        cards.append(
            Card(
                deck_id=deck_id,
                term=item.term,
                reading=item.reading,
                definition=item.definition,
                example=item.example,
                position=position,
            )
        )
    db.add_all(cards)
    db.commit()
    for card in cards:
        db.refresh(card)
    return cards


@router.patch("/cards/{card_id}", response_model=CardResponse)
def update_card(
    card_id: int,
    payload: CardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Card:
    """카드 부분 수정. 전달된 필드만 변경 (소유권은 부모 덱으로 검증)."""
    card = _get_owned_card(card_id, current_user, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(card, field, value)

    db.commit()
    db.refresh(card)
    return card


@router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """카드 삭제 (소유권은 부모 덱으로 검증)."""
    card = _get_owned_card(card_id, current_user, db)
    db.delete(card)
    db.commit()
