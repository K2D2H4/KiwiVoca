// 덱 생성 — title/description/kind 토글/lang_term·lang_def 선택. 생성 후 상세로 이동.
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/layout/PageHeader";
import {
  Button,
  TextField,
  Select,
  SegmentedControl,
  useToast,
} from "../components/ui";
import { LANG_OPTIONS } from "../lib/languages";
import { useCreateDeck } from "../hooks/useDecks";
import type { DeckKind } from "../types/deck";

export default function DeckNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const createDeck = useCreateDeck();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DeckKind>("vocab");
  const [langTerm, setLangTerm] = useState("en");
  const [langDef, setLangDef] = useState("ko");

  const canSubmit = title.trim().length > 0 && !createDeck.isPending;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const deck = await createDeck.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        kind,
        lang_term: langTerm,
        lang_def: langDef,
      });
      toast.success(t("deck.createdToast"));
      navigate(`/decks/${deck.id}`, { replace: true });
    } catch {
      toast.error(t("deck.createError"));
    }
  };

  return (
    <div className="min-h-[100dvh]">
      <PageHeader title={t("deck.createTitle")} onBack={() => navigate(-1)} />

      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-screen-sm space-y-5 px-5 pt-5"
      >
        <TextField
          id="deck-title"
          label={t("deck.fieldTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("deck.titlePlaceholder")}
          maxLength={80}
          autoFocus
        />

        {/* 설명 — textarea */}
        <label htmlFor="deck-desc" className="block">
          <span className="mb-1.5 block text-caption font-bold uppercase tracking-wide text-seed/50">
            {t("deck.fieldDescription")}
          </span>
          <textarea
            id="deck-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("deck.descriptionPlaceholder")}
            rows={2}
            maxLength={200}
            className="w-full resize-none rounded-2xl border-2 border-transparent bg-cream/70 px-4 py-3.5 text-base text-seed placeholder:text-seed/30 shadow-inner-soft transition focus:border-kiwi focus:bg-surface focus:outline-none"
          />
        </label>

        {/* kind 토글 */}
        <div>
          <span className="mb-1.5 block text-caption font-bold uppercase tracking-wide text-seed/50">
            {t("deck.fieldKind")}
          </span>
          <SegmentedControl<DeckKind>
            layoutId="deck-kind"
            ariaLabel={t("deck.fieldKind")}
            value={kind}
            onChange={setKind}
            segments={[
              { value: "vocab", label: t("deck.kindVocab") },
              { value: "grammar", label: t("deck.kindGrammar") },
            ]}
          />
        </div>

        {/* 언어쌍 select */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="lang-term"
            label={t("deck.fieldLangTerm")}
            value={langTerm}
            onChange={(e) => setLangTerm(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
          <Select
            id="lang-def"
            label={t("deck.fieldLangDef")}
            value={langDef}
            onChange={(e) => setLangDef(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>

        {/* 제출 — 모바일 하단 sticky, 데스크탑 인라인 */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-raised pt-1 md:static md:bottom-auto">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={createDeck.isPending}
            disabled={!canSubmit}
          >
            {t("deck.createCta")}
          </Button>
        </div>
      </form>
    </div>
  );
}
