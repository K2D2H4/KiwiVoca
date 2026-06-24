"""진척 통계 Pydantic v2 응답 스키마.

현재 사용자 소유 덱/카드/진척만 집계한 결과를 전달한다.
"""
from pydantic import BaseModel


class StatsOverview(BaseModel):
    """전체 진척 요약 (현재 사용자 기준)."""

    total_decks: int          # 내 덱 수
    total_cards: int          # 내 모든 덱의 카드 수
    studied_cards: int        # 진척 행이 존재하는 카드 수 (1회 이상 학습)
    mastered_cards: int       # box >= 4 인 카드 수
    overall_accuracy: float   # sum(correct)/(sum(correct)+sum(wrong)), 0~1, 분모 0이면 0
    due_cards: int            # 약한 카드 수 = 미학습 카드 + (진척 있고 box <= 1)
    studied_today: int        # 오늘(UTC) last_studied_at 인 카드 수
    streak_days: int          # 오늘/어제부터 연속 학습일 수 (근사)


class DeckStat(BaseModel):
    """덱별 진척 통계."""

    deck_id: int
    title: str
    card_count: int           # 덱의 카드 수
    studied: int              # 진척 행이 존재하는 카드 수
    mastered: int             # box >= 4 인 카드 수
    avg_box: float            # 진척 있는 카드들의 평균 box (없으면 0)
    accuracy: float           # 덱 단위 정답률 0~1 (분모 0이면 0)
