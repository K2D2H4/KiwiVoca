// 덱 목록/상세/생성/수정/삭제 — TanStack Query, 변경 후 invalidate
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  CreateDeckPayload,
  Deck,
  UpdateDeckPayload,
} from "../types/deck";

const DECKS_KEY = ["decks"] as const;
export const deckKey = (id: string | number) => ["decks", String(id)] as const;

// GET /api/decks
export function useDecks() {
  return useQuery({
    queryKey: DECKS_KEY,
    queryFn: async () => {
      const { data } = await api.get<Deck[]>("/decks");
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

// GET /api/decks/{id}
export function useDeck(
  id: string | number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: deckKey(id ?? ""),
    enabled: id != null && id !== "" && (options?.enabled ?? true),
    queryFn: async () => {
      const { data } = await api.get<Deck>(`/decks/${id}`);
      return data;
    },
  });
}

// POST /api/decks
export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDeckPayload) => {
      const { data } = await api.post<Deck>("/decks", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

// PATCH /api/decks/{id}
export function useUpdateDeck(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateDeckPayload) => {
      const { data } = await api.patch<Deck>(`/decks/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DECKS_KEY });
      qc.invalidateQueries({ queryKey: deckKey(id) });
    },
  });
}

// POST /api/decks/{id}/copy — 덱(카드+문법) 복제, 진척 미복사 → 새 덱 반환
export function useCopyDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const { data } = await api.post<Deck>(`/decks/${id}/copy`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: DECKS_KEY });
      // 새 덱 상세 캐시 시드 — 복사 직후 이동 시 스켈레톤 없이 즉시 표시
      qc.setQueryData(deckKey(data.id), data);
    },
  });
}

// POST /api/decks/merge — 선택 덱들의 카드+문법을 합쳐 새 덱 생성
export function useMergeDecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      deck_ids: (string | number)[];
      title: string;
      description?: string;
    }) => {
      const { data } = await api.post<Deck>("/decks/merge", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}

// DELETE /api/decks/{id}
export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/decks/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DECKS_KEY });
    },
  });
}
