// 카드 목록 + 추가/수정/삭제 — TanStack Query, 변경 후 카드/덱 invalidate
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Card,
  CreateCardPayload,
  UpdateCardPayload,
} from "../types/deck";
import { deckKey } from "./useDecks";

export const cardsKey = (deckId: string | number) =>
  ["decks", String(deckId), "cards"] as const;

// GET /api/decks/{id}/cards
export function useCards(
  deckId: string | number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: cardsKey(deckId ?? ""),
    enabled:
      deckId != null && deckId !== "" && (options?.enabled ?? true),
    queryFn: async () => {
      const { data } = await api.get<Card[]>(`/decks/${deckId}/cards`);
      return data ?? [];
    },
  });
}

// 카드 추가/수정/삭제를 한 훅으로 — 같은 덱 컨텍스트 공유
export function useCardMutations(deckId: string | number) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: cardsKey(deckId) });
    qc.invalidateQueries({ queryKey: deckKey(deckId) }); // card_count 갱신
  };

  // POST /api/decks/{id}/cards
  const create = useMutation({
    mutationFn: async (payload: CreateCardPayload) => {
      const { data } = await api.post<Card>(
        `/decks/${deckId}/cards`,
        payload
      );
      return data;
    },
    onSuccess: invalidate,
  });

  // PATCH /api/cards/{id}
  const update = useMutation({
    mutationFn: async (args: {
      id: string | number;
      payload: UpdateCardPayload;
    }) => {
      const { data } = await api.patch<Card>(`/cards/${args.id}`, args.payload);
      return data;
    },
    onSuccess: invalidate,
  });

  // DELETE /api/cards/{id}
  const remove = useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/cards/${id}`);
      return id;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
