"""진척 통계 서비스 — 현재 사용자 소유 덱/카드/진척 집계.

모든 쿼리는 user_id 소유권으로 필터한다 (타인 데이터 유출 방지).
N+1 회피를 위해 GROUP BY 집계 쿼리를 사용한다.

streak_days 는 정확한 학습 이벤트 로그가 없으므로 card_progress.last_studied_at
의 distinct UTC 날짜들을 기준으로 한 **근사치**다 (카드별 마지막 학습일만 알 수 있어
같은 날 여러 카드를 학습해도 하루로 집계되고, 과거 학습일이 더 최근 학습으로 덮일 수 있음).
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.card_progress import CardProgress
from app.models.deck import Deck
from app.models.user import User
from app.schemas.stats import DeckStat, StatsOverview

# 마스터 기준 박스, 약한 카드(due) 박스 경계
_MASTERED_BOX = 4
_DUE_BOX = 1


def _accuracy(correct: int, wrong: int) -> float:
    """정답률 = correct / (correct + wrong). 분모 0이면 0."""
    total = correct + wrong
    return (correct / total) if total > 0 else 0.0


def get_overview(db: Session, user: User) -> StatsOverview:
    """전체 진척 요약 (현재 사용자 기준).

    - studied_cards: 진척 행 존재 카드 수
    - mastered_cards: box >= 4
    - overall_accuracy: 내 모든 진척의 sum(correct)/(sum(correct)+sum(wrong))
    - due_cards: 미학습 카드 + (진척 있고 box <= 1) — 복습이 필요한 약한 카드
    - studied_today: 오늘(UTC) 학습한 카드 수
    - streak_days: 오늘/어제부터 끊김 없이 이어진 연속 학습일 (근사)
    """
    # 내 카드 ID 집합 (소유 덱 -> 카드). due_cards 의 "미학습" 계산에 카드 총수가 필요.
    total_decks = (
        db.execute(select(func.count(Deck.id)).where(Deck.user_id == user.id)).scalar() or 0
    )
    total_cards = (
        db.execute(
            select(func.count(Card.id))
            .select_from(Card)
            .join(Deck, Card.deck_id == Deck.id)
            .where(Deck.user_id == user.id)
        ).scalar()
        or 0
    )

    # 진척 집계: 내 카드에 대한 내 진척만 (card -> deck.user_id, progress.user_id 둘 다 본인)
    # 한 번의 쿼리로 학습 카드 수 / 마스터 수 / box<=1 수 / 정답·오답 합계를 모은다.
    progress_agg = db.execute(
        select(
            func.count(CardProgress.id),  # studied_cards
            func.coalesce(func.sum(CardProgress.correct_count), 0),
            func.coalesce(func.sum(CardProgress.wrong_count), 0),
            func.count(CardProgress.id).filter(CardProgress.box >= _MASTERED_BOX),
            func.count(CardProgress.id).filter(CardProgress.box <= _DUE_BOX),
        )
        .select_from(CardProgress)
        .join(Card, CardProgress.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .where(Deck.user_id == user.id, CardProgress.user_id == user.id)
    ).one()
    studied_cards, sum_correct, sum_wrong, mastered_cards, weak_studied = progress_agg

    # due = 한 번도 학습 안 한 카드(진척 행 없음) + 진척 있고 box<=1 인 카드
    not_studied = total_cards - studied_cards
    due_cards = not_studied + (weak_studied or 0)

    # 오늘(UTC) 학습한 카드 수
    today = datetime.now(timezone.utc).date()
    studied_today = (
        db.execute(
            select(func.count(CardProgress.id))
            .select_from(CardProgress)
            .join(Card, CardProgress.card_id == Card.id)
            .join(Deck, Card.deck_id == Deck.id)
            .where(
                Deck.user_id == user.id,
                CardProgress.user_id == user.id,
                func.date(func.timezone("UTC", CardProgress.last_studied_at)) == today,
            )
        ).scalar()
        or 0
    )

    streak_days = _calc_streak(db, user, today)

    return StatsOverview(
        total_decks=total_decks,
        total_cards=total_cards,
        studied_cards=studied_cards or 0,
        mastered_cards=mastered_cards or 0,
        overall_accuracy=round(_accuracy(sum_correct or 0, sum_wrong or 0), 4),
        due_cards=due_cards,
        studied_today=studied_today,
        streak_days=streak_days,
    )


def _calc_streak(db: Session, user: User, today: date) -> int:
    """연속 학습일 수 (근사) — last_studied_at 의 distinct UTC 날짜 기준.

    오늘 또는 어제 학습 기록이 있어야 streak 가 살아있다. 거기서부터 하루씩
    거슬러 올라가며 끊기는 지점까지 세어 반환한다.
    """
    studied_date = func.date(func.timezone("UTC", CardProgress.last_studied_at)).label(
        "studied_date"
    )
    rows = db.execute(
        select(studied_date)
        .select_from(CardProgress)
        .join(Card, CardProgress.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .where(
            Deck.user_id == user.id,
            CardProgress.user_id == user.id,
            CardProgress.last_studied_at.is_not(None),
        )
        .group_by(studied_date)
    ).all()
    studied_dates = {r[0] for r in rows if r[0] is not None}
    if not studied_dates:
        return 0

    # 시작점: 오늘 학습했으면 오늘부터, 아니면 어제부터(어제 학습했으면 streak 유지).
    if today in studied_dates:
        cursor = today
    elif (today - timedelta(days=1)) in studied_dates:
        cursor = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in studied_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def get_deck_stats(db: Session, user: User) -> list[DeckStat]:
    """덱별 진척 통계 목록 (현재 사용자 기준, 최신순).

    GROUP BY 집계로 N+1 을 회피한다. 카드 수와 진척 집계를 각각 한 쿼리로 모은 뒤
    파이썬에서 병합한다 (진척 LEFT JOIN 시 카드당 0/1 행이라 카드 수 집계만 분리).
    """
    decks = (
        db.query(Deck)
        .filter(Deck.user_id == user.id)
        .order_by(Deck.created_at.desc(), Deck.id.desc())
        .all()
    )
    if not decks:
        return []

    deck_ids = [d.id for d in decks]

    # 덱별 카드 수
    card_counts = dict(
        db.execute(
            select(Card.deck_id, func.count(Card.id))
            .where(Card.deck_id.in_(deck_ids))
            .group_by(Card.deck_id)
        ).all()
    )

    # 덱별 진척 집계 (내 진척만): 학습 카드 수, 마스터 수, 평균 box, 정답·오답 합
    progress_rows = db.execute(
        select(
            Card.deck_id,
            func.count(CardProgress.id),
            func.count(CardProgress.id).filter(CardProgress.box >= _MASTERED_BOX),
            func.coalesce(func.avg(CardProgress.box), 0.0),
            func.coalesce(func.sum(CardProgress.correct_count), 0),
            func.coalesce(func.sum(CardProgress.wrong_count), 0),
        )
        .select_from(Card)
        .join(
            CardProgress,
            (CardProgress.card_id == Card.id) & (CardProgress.user_id == user.id),
        )
        .where(Card.deck_id.in_(deck_ids))
        .group_by(Card.deck_id)
    ).all()
    progress_by_deck = {
        row[0]: {
            "studied": row[1],
            "mastered": row[2],
            "avg_box": float(row[3]),
            "correct": row[4],
            "wrong": row[5],
        }
        for row in progress_rows
    }

    result: list[DeckStat] = []
    for deck in decks:
        p = progress_by_deck.get(deck.id)
        if p is None:
            result.append(
                DeckStat(
                    deck_id=deck.id,
                    title=deck.title,
                    card_count=card_counts.get(deck.id, 0),
                    studied=0,
                    mastered=0,
                    avg_box=0.0,
                    accuracy=0.0,
                )
            )
        else:
            result.append(
                DeckStat(
                    deck_id=deck.id,
                    title=deck.title,
                    card_count=card_counts.get(deck.id, 0),
                    studied=p["studied"],
                    mastered=p["mastered"],
                    avg_box=round(p["avg_box"], 2),
                    accuracy=round(_accuracy(p["correct"], p["wrong"]), 4),
                )
            )
    return result
