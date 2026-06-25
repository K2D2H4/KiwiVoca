// 학습 도메인 타입 — 백엔드 /api/study/cards · /api/study/answer · /api/study/learned 계약 기준
import type { Card } from "./deck";

export type StudyMode = "flashcards" | "choice" | "typing" | "match";

// 학습 범위/개수 — 세션 시작 옵션
export type StudyScope = "all" | "unlearned";

// 카드 진척 메타 — /api/study/cards 응답 progress
export interface CardProgress {
  box?: number;
  correct_count?: number;
  wrong_count?: number;
  is_learned?: boolean;
  last_studied_at?: string | null;
}

// study set 카드 — 일반 카드 + 진척 메타(약한 카드 우선 정렬에 사용)
export interface StudyCard extends Card {
  box?: number;
  correct_count?: number;
  wrong_count?: number;
  progress?: CardProgress;
}

// GET /api/study/cards?deck_ids=&scope=&limit=&order=
export interface StudySet {
  cards: StudyCard[];
}

// GET /api/study/summary?deck_ids=
export interface StudySummary {
  total: number;
  learned: number;
  unlearned: number;
}

// POST /api/study/learned
export interface LearnedPayload {
  card_id: string | number;
  is_learned: boolean;
}

export interface LearnedResult {
  card_id: string | number;
  is_learned: boolean;
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
