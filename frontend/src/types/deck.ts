// 덱/카드 도메인 타입 — 백엔드 /api/decks · /api/cards 계약 기준
export type DeckKind = "vocab" | "grammar";

export interface Deck {
  id: string | number;
  title: string;
  description?: string | null;
  lang_term: string; // 학습 언어 (예: en)
  lang_def: string; // 모국어/뜻 언어 (예: ko)
  kind: DeckKind;
  is_public?: boolean;
  card_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Card {
  id: string | number;
  deck_id: string | number;
  term: string;
  reading?: string | null;
  definition: string;
  example?: string | null;
  position?: number;
  created_at?: string;
}

// POST /api/decks
export interface CreateDeckPayload {
  title: string;
  description?: string;
  lang_term: string;
  lang_def: string;
  kind: DeckKind;
}

// PATCH /api/decks/{id}
export type UpdateDeckPayload = Partial<CreateDeckPayload> & {
  is_public?: boolean;
};

// POST /api/decks/{id}/cards
export interface CreateCardPayload {
  term: string;
  reading?: string;
  definition: string;
  example?: string;
}

// PATCH /api/cards/{id}
export type UpdateCardPayload = Partial<CreateCardPayload> & {
  position?: number;
};
