// 학습 세트 fetch + 정답 기록 + 학습완료 토글 mutation — TanStack Query
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { cardsKey } from "./useCards";
import type {
  AnswerPayload,
  AnswerResult,
  LearnedPayload,
  LearnedResult,
  StudyCard,
  StudyScope,
  StudySet,
  StudySummary,
} from "../types/study";
import type { Card } from "../types/deck";

// deck_ids 배열을 정렬된 쿼리 문자열로 — 키 안정성(순서 무관 캐시 일치)
const normalizeIds = (ids: (string | number)[]) =>
  [...ids].map(String).sort().join(",");

export interface StudySetOpts {
  scope?: StudyScope;
  limit?: number; // 0 = 전체
  order?: string;
}

export const studyKey = (
  deckIds: (string | number)[],
  opts: Required<StudySetOpts>
) =>
  [
    "study",
    "cards",
    normalizeIds(deckIds),
    opts.scope,
    opts.order,
    opts.limit,
  ] as const;

// GET /api/study/cards?deck_ids=1,2&scope=all|unlearned&limit=0|N&order=weak|random
export function useStudySet(
  deckIds: (string | number)[],
  opts?: StudySetOpts
) {
  const resolved: Required<StudySetOpts> = {
    scope: opts?.scope ?? "all",
    limit: opts?.limit ?? 20,
    order: opts?.order ?? "weak",
  };
  const enabled = deckIds.length > 0;
  return useQuery({
    queryKey: studyKey(deckIds, resolved),
    enabled,
    staleTime: 0,
    queryFn: async () => {
      // 백엔드가 배열(list[StudyCard]) 또는 래퍼({cards:[...]}) 어느 쪽을 줘도 정규화
      const { data } = await api.get<StudySet | StudyCard[]>("/study/cards", {
        params: {
          deck_ids: normalizeIds(deckIds),
          scope: resolved.scope,
          limit: resolved.limit,
          order: resolved.order,
        },
      });
      const cards = Array.isArray(data) ? data : (data?.cards ?? []);
      return { cards } satisfies StudySet;
    },
  });
}

export const summaryKey = (deckIds: (string | number)[]) =>
  ["study", "summary", normalizeIds(deckIds)] as const;

// GET /api/study/summary?deck_ids=1,2 → { total, learned, unlearned }
export function useStudySummary(deckIds: (string | number)[]) {
  const enabled = deckIds.length > 0;
  return useQuery({
    queryKey: summaryKey(deckIds),
    enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const { data } = await api.get<StudySummary>("/study/summary", {
        params: { deck_ids: normalizeIds(deckIds) },
      });
      return data;
    },
  });
}

// POST /api/study/answer — 각 정답/오답 기록(후속, 실패해도 학습 흐름은 진행)
export function useAnswer() {
  return useMutation({
    mutationFn: async (payload: AnswerPayload) => {
      const { data } = await api.post<AnswerResult>("/study/answer", payload);
      return data;
    },
  });
}

// POST /api/study/learned — 학습완료 토글. 낙관적 업데이트(덱 카드 캐시 즉시 반영) + 롤백.
export function useToggleLearned(deckId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LearnedPayload) => {
      const { data } = await api.post<LearnedResult>(
        "/study/learned",
        payload
      );
      return data;
    },
    onMutate: async ({ card_id, is_learned }) => {
      await qc.cancelQueries({ queryKey: cardsKey(deckId) });
      const prev = qc.getQueryData<Card[]>(cardsKey(deckId));
      qc.setQueryData<Card[]>(cardsKey(deckId), (old) =>
        old?.map((c) =>
          String(c.id) === String(card_id) ? { ...c, is_learned } : c
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(cardsKey(deckId), ctx.prev);
    },
    onSettled: () => {
      // summary/학습세트 캐시 최신화 — 완료 표시 직후 미완료(unlearned) 세션에
      // 방금 완료한 카드가 stale 캐시로 다시 출제되지 않도록 study/cards도 무효화.
      qc.invalidateQueries({ queryKey: ["study", "summary"] });
      qc.invalidateQueries({ queryKey: ["study", "cards"] });
    },
  });
}
