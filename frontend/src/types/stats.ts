// 통계 도메인 타입 — 백엔드 /api/stats 계약 기준
// accuracy/overall_accuracy 는 0~1, avg_box 는 0~5.

export interface StatsOverview {
  total_decks: number;
  total_cards: number;
  studied_cards: number;
  mastered_cards: number; // box>=4
  overall_accuracy: number; // 0~1
  due_cards: number;
  studied_today: number;
  streak_days: number;
}

export interface DeckStat {
  deck_id: string | number;
  title: string;
  card_count: number;
  studied: number;
  mastered: number;
  avg_box: number; // 0~5
  accuracy: number; // 0~1
}
