// 학습 도메인 타입 — 백엔드 /api/decks/{id}/study · /api/study/answer 계약 기준
import type { Card } from "./deck";

export type StudyMode = "flashcards" | "choice" | "typing" | "match";

// study set 카드 — 일반 카드 + 진척 메타(약한 카드 우선 정렬에 사용)
export interface StudyCard extends Card {
  box?: number;
  correct_count?: number;
  wrong_count?: number;
}

// GET /api/decks/{id}/study
export interface StudySet {
  deck_id: string | number;
  cards: StudyCard[];
}

// POST /api/study/answer
export interface AnswerPayload {
  card_id: string | number;
  is_correct: boolean;
}

export interface AnswerResult {
  card_id: string | number;
  box: number;
  correct_count: number;
  wrong_count: number;
}

// 한 라운드 결과 집계 — 결과 화면에 전달
export interface StudyOutcome {
  cardId: string | number;
  isCorrect: boolean;
}
