// 덱 공유/탐색 훅 — 공개 덱 목록(페이지네이션·검색), 복사, 공개 토글.
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Deck, PublicDeck } from "../types/deck";
import { deckKey } from "./useDecks";

const PUBLIC_DECKS_KEY = ["decks", "public"] as const;
export const PAGE_SIZE = 12;

// GET /api/decks/public?limit=&offset=&q= — 무한스크롤("더보기")용
export function usePublicDecks(q: string) {
  const query = q.trim();
  return useInfiniteQuery({
    queryKey: [...PUBLIC_DECKS_KEY, query],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<PublicDeck[]>("/decks/public", {
        params: {
          limit: PAGE_SIZE,
          offset: pageParam,
          ...(query ? { q: query } : {}),
        },
      });
      return data ?? [];
    },
    // 마지막 페이지가 가득 찼으면 다음 offset, 아니면 끝
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE
        ? undefined
        : allPages.length * PAGE_SIZE,
    staleTime: 30_000,
  });
}

// POST /api/decks/{id}/copy — 공개/본인 덱을 내 새 덱으로 복제(카드 포함)
export function useCopyDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const { data } = await api.post<Deck>(`/decks/${id}/copy`);
      return data;
    },
    onSuccess: () => {
      // 내 단어장 목록 갱신
      qc.invalidateQueries({ queryKey: ["decks"], exact: true });
    },
  });
}

// PATCH /api/decks/{id} { is_public } — 소유자만 공개 상태 토글
export function useTogglePublic(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (isPublic: boolean) => {
      const { data } = await api.patch<Deck>(`/decks/${id}`, {
        is_public: isPublic,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deckKey(id) });
      qc.invalidateQueries({ queryKey: ["decks"], exact: true });
      // 공개 갤러리 목록도 무효화(공개/비공개 전환 반영)
      qc.invalidateQueries({ queryKey: PUBLIC_DECKS_KEY });
    },
  });
}
