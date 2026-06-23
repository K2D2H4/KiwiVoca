// 사진 → Gemini 추출 → 커밋 도메인 타입 — 백엔드 /api/import 계약 기준
import type { Card, Deck, DeckKind } from "./deck";

// 추출된 후보 카드 (검수/편집 전, id 없음)
export interface ExtractCandidate {
  term: string;
  reading?: string | null;
  definition: string;
  example?: string | null;
}

// POST /api/import/extract 응답
export interface ExtractResult {
  candidates: ExtractCandidate[];
  image_count: number;
  extracted_count?: number;
  job_id?: string | number;
}

// POST /api/import/extract 요청 메타 (이미지는 FormData files로 별도 전송)
export interface ExtractParams {
  files: File[];
  lang_term: string;
  lang_def: string;
  kind: DeckKind;
}

// commit 시 카드 페이로드 (위치는 백엔드가 순서대로 부여)
export interface CommitCard {
  term: string;
  reading?: string;
  definition: string;
  example?: string;
}

// POST /api/import/commit 요청 — 새 덱 생성(new_deck) 또는 기존 덱(deck_id)에 추가.
// 백엔드 계약: new_deck 또는 deck_id 중 정확히 하나.
export type CommitPayload =
  | {
      new_deck: {
        title: string;
        description?: string;
        lang_term: string;
        lang_def: string;
        kind: DeckKind;
      };
      cards: CommitCard[];
    }
  | {
      deck_id: string | number;
      cards: CommitCard[];
    };

// POST /api/import/commit 응답 — 생성/갱신된 덱(+카드)
export interface CommitResult {
  deck: Deck;
  cards?: Card[];
}
