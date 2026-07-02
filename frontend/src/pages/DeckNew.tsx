// 단어장(vocab) 덱 생성 — title/description/lang_term·lang_def 선택. 문법 덱은 /grammar/new 전용.
// 생성 후 상세로 이동.
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/layout/PageHeader";
import { Button, TextField, Select, useToast } from "../components/ui";
import { LANG_OPTIONS } from "../lib/languages";
import { useCreateDeck } from "../hooks/useDecks";

export default function DeckNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const createDeck = useCreateDeck();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
        kind: "vocab",
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
    <div className="min-h-[100dvh] md:min-h-0">
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
          {/* 글자 수 카운터 — 190자부터 한계 임박 강조 */}
          <span
            aria-live="polite"
            className={[
              "mt-1 block text-right text-caption tabular-nums transition-colors",
              description.length >= 190
                ? "font-bold text-pop"
                : "text-seed/40",
            ].join(" ")}
          >
            {description.length}/200
          </span>
        </label>

        {/* 언어쌍 select */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="lang-term"
            label={t("deck.fieldLangTerm")}
            value={langTerm}
            onChange={(e) => setLangTerm(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              // 뜻 언어로 이미 선택된 언어는 비활성화 — 동일 언어쌍 방지
              <option key={l.code} value={l.code} disabled={l.code === langDef}>
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
              // 학습 언어로 이미 선택된 언어는 비활성화 — 동일 언어쌍 방지
              <option key={l.code} value={l.code} disabled={l.code === langTerm}>
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
