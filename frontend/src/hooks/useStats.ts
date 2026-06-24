// 학습 통계 — 전체 요약 + 덱별 숙련도. TanStack Query.
// GET /api/stats/overview · GET /api/stats/decks
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DeckStat, StatsOverview } from "../types/stats";

const OVERVIEW_KEY = ["stats", "overview"] as const;
const DECK_STATS_KEY = ["stats", "decks"] as const;

// GET /api/stats/overview
export function useOverview() {
  return useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: async () => {
      const { data } = await api.get<StatsOverview>("/stats/overview");
      return data;
    },
    staleTime: 30_000,
  });
}

// GET /api/stats/decks
export function useDeckStats() {
  return useQuery({
    queryKey: DECK_STATS_KEY,
    queryFn: async () => {
      const { data } = await api.get<DeckStat[]>("/stats/decks");
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
