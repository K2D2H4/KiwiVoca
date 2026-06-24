// 학습 세트 fetch + 정답 기록 mutation — TanStack Query
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  AnswerPayload,
  AnswerResult,
  StudySet,
} from "../types/study";

export const studyKey = (
  deckId: string | number,
  order: string,
  limit: number
) => ["decks", String(deckId), "study", order, limit] as const;

// GET /api/decks/{id}/study?limit=&order=weak — 약한 카드 우선
export function useStudySet(
  deckId: string | number | undefined,
  opts?: { limit?: number; order?: string }
) {
  const limit = opts?.limit ?? 20;
  const order = opts?.order ?? "weak";
  return useQuery({
    queryKey: studyKey(deckId ?? "", order, limit),
    enabled: deckId != null && deckId !== "",
    staleTime: 0,
    queryFn: async () => {
      const { data } = await api.get<StudySet>(`/decks/${deckId}/study`, {
        params: { limit, order },
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
