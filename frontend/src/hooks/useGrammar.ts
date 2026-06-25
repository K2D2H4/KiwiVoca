// 문법 생성/추출/커밋/조회/학습완료 — TanStack Query
// generate: JSON · extract: multipart(이미지 N장) · commit: JSON
// items: GET /decks/{id}/grammar · learned: 낙관적 토글
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { deckKey } from "./useDecks";
import type {
  CandidatesResponse,
  ExtractGrammarParams,
  GenerateGrammarParams,
  GrammarAnswerPayload,
  GrammarAnswerResult,
  GrammarCommitPayload,
  GrammarCommitResult,
  GrammarFiltersResponse,
  GrammarItem,
  GrammarLearnedPayload,
  GrammarLearnedResult,
  PracticePayload,
  PracticeResponse,
} from "../types/grammar";

// 덱별 문법 항목 캐시 키 (카드와 별도 네임스페이스)
export const grammarItemsKey = (deckId: string | number) =>
  ["grammar", "items", String(deckId)] as const;

// deck_ids 배열을 정렬된 콤마 문자열로 — 키/요청 안정성(순서 무관)
const idsParam = (ids: (string | number)[]) =>
  [...ids].map(String).sort().join(",");

// POST /api/grammar/generate — 텍스트 프롬프트로 문법 후보 생성
export function useGenerateGrammar() {
  return useMutation({
    mutationFn: async (params: GenerateGrammarParams) => {
      const { data } = await api.post<CandidatesResponse>(
        "/grammar/generate",
        params
      );
      return data;
    },
  });
}

// POST /api/grammar/extract — 문법 노트 이미지에서 후보 추출 (FormData)
export function useExtractGrammar() {
  return useMutation({
    mutationFn: async ({ files, lang_term, lang_def }: ExtractGrammarParams) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("lang_term", lang_term);
      form.append("lang_def", lang_def);
      const { data } = await api.post<CandidatesResponse>(
        "/grammar/extract",
        form
      );
      return data;
    },
  });
}

// POST /api/grammar/commit — 새 덱이면 decks, 기존 덱이면 해당 덱/문법항목 invalidate
export function useCommitGrammar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GrammarCommitPayload) => {
      const { data } = await api.post<GrammarCommitResult>(
        "/grammar/commit",
        payload
      );
      return data;
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      if ("deck_id" in variables) {
        qc.invalidateQueries({ queryKey: deckKey(variables.deck_id) });
        qc.invalidateQueries({ queryKey: grammarItemsKey(variables.deck_id) });
      }
      if (data.deck?.id != null) {
        qc.invalidateQueries({ queryKey: deckKey(data.deck.id) });
        qc.invalidateQueries({ queryKey: grammarItemsKey(data.deck.id) });
      }
    },
  });
}

// GET /api/decks/{id}/grammar — 덱의 문법 항목(+문제+진척)
export function useGrammarItems(
  deckId: string | number | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: grammarItemsKey(deckId ?? ""),
    enabled: deckId != null && deckId !== "" && (options?.enabled ?? true),
    queryFn: async () => {
      const { data } = await api.get<GrammarItem[]>(`/decks/${deckId}/grammar`);
      return data ?? [];
    },
  });
}

// POST /api/grammar/learned — 학습완료 토글. 낙관적 업데이트(항목 캐시 즉시 반영) + 롤백.
export function useToggleGrammarLearned(deckId: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GrammarLearnedPayload) => {
      const { data } = await api.post<GrammarLearnedResult>(
        "/grammar/learned",
        payload
      );
      return data;
    },
    onMutate: async ({ item_id, is_learned }) => {
      await qc.cancelQueries({ queryKey: grammarItemsKey(deckId) });
      const prev = qc.getQueryData<GrammarItem[]>(grammarItemsKey(deckId));
      qc.setQueryData<GrammarItem[]>(grammarItemsKey(deckId), (old) =>
        old?.map((it) =>
          it.id === item_id
            ? { ...it, progress: { ...it.progress, is_learned } }
            : it
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(grammarItemsKey(deckId), ctx.prev);
    },
  });
}

// ── 연습 세션 ────────────────────────────────────────────────
export const grammarFiltersKey = (deckIds: (string | number)[]) =>
  ["grammar", "filters", idsParam(deckIds)] as const;

// GET /api/grammar/filters?deck_ids=1,2 — 다단계 필터(레벨 → 카테고리) 계층
export function useGrammarFilters(deckIds: (string | number)[]) {
  const enabled = deckIds.length > 0;
  return useQuery({
    queryKey: grammarFiltersKey(deckIds),
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<GrammarFiltersResponse>(
        "/grammar/filters",
        { params: { deck_ids: idsParam(deckIds) } }
      );
      return data?.levels ? data : { levels: [] };
    },
  });
}

export interface PracticeParams {
  deckIds: (string | number)[];
  levels?: string[];
  categories?: string[];
  scope?: "all" | "unlearned";
  limit?: number; // 0 = 전체
  order?: "weak" | "random";
}

// POST /api/grammar/practice — 즉석 생성(Gemini, 수초 소요)이므로 mutation.
// "시작" 시점에 명시 호출 → 로딩 화면 노출 → problems 받으면 플레이.
// 빈 항목이면 { problems: [] } 반환.
export function usePractice() {
  return useMutation({
    mutationFn: async (params: PracticeParams) => {
      const body: PracticePayload = {
        deck_ids: [...params.deckIds].map(String).sort(),
        scope: params.scope ?? "all",
        limit: params.limit ?? 0,
        order: params.order ?? "weak",
        // 빈 값이면 필드 생략(전체)
        ...(params.levels?.length ? { levels: params.levels } : {}),
        ...(params.categories?.length ? { categories: params.categories } : {}),
      };
      const { data } = await api.post<PracticeResponse>(
        "/grammar/practice",
        body
      );
      return data?.problems ?? [];
    },
  });
}

// POST /api/grammar/answer — 정답 기록. 후속 학습/필터 캐시 무효화(진척 반영).
export function useGrammarAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GrammarAnswerPayload) => {
      const { data } = await api.post<GrammarAnswerResult>(
        "/grammar/answer",
        payload
      );
      return data;
    },
    onSuccess: () => {
      // 진척이 바뀌었으니 덱 문법 항목 + 필터 카운트 최신화
      qc.invalidateQueries({ queryKey: ["grammar", "items"] });
      qc.invalidateQueries({ queryKey: ["grammar", "filters"] });
    },
  });
}
