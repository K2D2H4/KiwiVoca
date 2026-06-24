// 사진 추출(extract) + 커밋(commit) — TanStack Query mutation
// extract: multipart/form-data (이미지 N장 동기 업로드, 수 초 소요)
// commit: JSON, 성공 후 decks 목록/해당 덱 invalidate
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { deckKey } from "./useDecks";
import { cardsKey } from "./useCards";
import type {
  CommitPayload,
  CommitResult,
  ExtractParams,
  ExtractResult,
} from "../types/import";

// POST /api/import/extract — FormData (Content-Type 자동 지정)
export function useExtract() {
  return useMutation({
    mutationFn: async ({ files, lang_term, lang_def, kind }: ExtractParams) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("lang_term", lang_term);
      form.append("lang_def", lang_def);
      form.append("kind", kind);
      const { data } = await api.post<ExtractResult>(
        "/import/extract",
        form
      );
      return data;
    },
  });
}

// POST /api/import/commit — 새 덱이면 decks, 기존 덱이면 해당 덱/카드 invalidate
export function useCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CommitPayload) => {
      const { data } = await api.post<CommitResult>("/import/commit", payload);
      return data;
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      if ("deck_id" in variables) {
        qc.invalidateQueries({ queryKey: deckKey(variables.deck_id) });
        qc.invalidateQueries({ queryKey: cardsKey(variables.deck_id) });
      }
      if (data.deck?.id != null) {
        qc.invalidateQueries({ queryKey: deckKey(data.deck.id) });
        qc.invalidateQueries({ queryKey: cardsKey(data.deck.id) });
      }
    },
  });
}
