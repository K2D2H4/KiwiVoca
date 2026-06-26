// 문법 학습 도메인 타입 — 백엔드 /api/grammar 계약 기준
import type { Deck } from "./deck";

// 연습 문제 종류
export type ProblemKind = "choice" | "typing";

// ── 후보(검수/생성 결과, 미저장) ─────────────────────────────
// 연습 문제 후보 — choice 면 options(정답 포함) 필요
export interface ProblemCandidate {
  kind: ProblemKind;
  prompt: string; // 빈칸 ___ 포함
  answer: string;
  options?: string[] | null;
  explanation?: string | null;
}

// 문법 항목 후보 (항목 + 연습 문제 묶음)
export interface GrammarItemCandidate {
  point: string;
  explanation: string;
  example?: string | null;
  level: string;
  category: string;
  problems: ProblemCandidate[];
}

// POST /api/grammar/extract · /generate 공통 응답
export interface CandidatesResponse {
  candidates: GrammarItemCandidate[];
}

// POST /api/grammar/extract 요청 메타 (이미지는 FormData files로 별도 전송)
export interface ExtractGrammarParams {
  files: File[];
  lang_term: string;
  lang_def: string;
}

// POST /api/grammar/generate 요청
export interface GenerateGrammarParams {
  lang_term: string;
  lang_def: string;
  level: string;
  topic?: string;
  count?: number; // 1~20, 기본 5
}

// ── 커밋 ─────────────────────────────────────────────────────
// new_deck 또는 deck_id 중 정확히 하나
export type GrammarCommitPayload =
  | {
      new_deck: {
        title: string;
        description?: string;
        lang_term: string;
        lang_def: string;
      };
      items: GrammarItemCandidate[];
    }
  | {
      deck_id: string | number;
      items: GrammarItemCandidate[];
    };

// POST /api/grammar/commit 응답
export interface GrammarCommitResult {
  deck: Deck;
  item_count: number;
}

// ── 조회 응답 ────────────────────────────────────────────────
export interface GrammarProblem {
  id: number;
  kind: ProblemKind;
  prompt: string;
  answer: string;
  options?: string[] | null;
  explanation?: string | null;
  position: number;
}

export interface GrammarProgressInfo {
  box: number;
  correct_count: number;
  wrong_count: number;
  is_learned: boolean;
  last_studied_at?: string | null;
}

// GET /api/decks/{id}/grammar 항목
export interface GrammarItem {
  id: number;
  deck_id: number;
  point: string;
  explanation: string;
  example?: string | null;
  level: string;
  category: string;
  position: number;
  problems: GrammarProblem[];
  progress: GrammarProgressInfo;
}

// ── 연습 세션 (즉석 생성) ────────────────────────────────────
// GET /api/grammar/filters?deck_ids=1,2 — 다단계 필터(레벨 → 카테고리) 계층
export interface GrammarFilterCategory {
  category: string;
  count: number;
}

export interface GrammarFilterLevel {
  level: string;
  count: number;
  categories: GrammarFilterCategory[];
}

export interface GrammarFiltersResponse {
  levels: GrammarFilterLevel[];
}

// POST /api/grammar/practice 요청 — 즉석 생성(Gemini), 수초 소요
// limit: 생성할 "문제 수"(반복 학습용). item_ids: 특정 문법 항목만 연습(선택).
// deck_ids / item_ids 중 최소 하나 필수.
export interface PracticePayload {
  deck_ids?: (string | number)[];
  item_ids?: number[];
  levels?: string[];
  categories?: string[];
  scope?: "all" | "unlearned";
  limit?: number; // 생성할 문제 수
  order?: "weak" | "random";
}

// POST /api/grammar/practice 응답 항목 — 문제 + 문법 컨텍스트 + 진척
// 미저장(problem_id 없음). base_form: 빈칸의 기본형 힌트(예: "먹다").
export interface PracticeProblem {
  item_id: number;
  kind: ProblemKind;
  prompt: string; // 빈칸 ___ 포함
  answer: string;
  options?: string[] | null; // choice 면 4지선다(정답 포함)
  base_form: string; // 빈칸의 기본형 힌트
  explanation?: string | null; // 문제 해설
  point: string; // 문법 포인트
  item_explanation: string; // 문법 항목 설명
  level: string;
  category: string;
  progress: GrammarProgressInfo;
}

// POST /api/grammar/practice 응답 래퍼
export interface PracticeResponse {
  problems: PracticeProblem[];
}

// POST /api/grammar/answer 요청/응답
export interface GrammarAnswerPayload {
  item_id: number;
  is_correct: boolean;
}

export interface GrammarAnswerResult {
  item_id: number;
  box: number;
  correct_count: number;
  wrong_count: number;
}

// POST /api/grammar/learned 요청/응답
export interface GrammarLearnedPayload {
  item_id: number;
  is_learned: boolean;
}

export interface GrammarLearnedResult {
  item_id: number;
  is_learned: boolean;
}
