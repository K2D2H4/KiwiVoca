// 덱 상세 — 헤더(제목/삭제) + 메타 + 학습/사진 CTA + 카드 추가 폼 + 카드 목록 편집.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  Check,
  Globe,
  Layers,
  Link2,
  Lock,
  Play,
  Trash2,
} from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import CardEditorRow from "../components/deck/CardEditorRow";
import ModeSheet from "../components/study/ModeSheet";
import {
  Button,
  IconButton,
  Card,
  Badge,
  TextField,
  Skeleton,
  EmptyState,
  ConfirmSheet,
  useToast,
} from "../components/ui";
import { langLabel } from "../lib/languages";
import { useDeck, useDeleteDeck, deckKey } from "../hooks/useDecks";
import { useCards, useCardMutations, cardsKey } from "../hooks/useCards";
import { useTogglePublic } from "../hooks/useSharing";
import type { UpdateCardPayload } from "../types/deck";

export default function DeckDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const { id = "" } = useParams();

  // 삭제 진행 중이면 상세/카드 재조회 차단 — 삭제된 덱 404 방지
  const [deleting, setDeleting] = useState(false);
  const { data: deck, isLoading: deckLoading, isError: deckError } =
    useDeck(id, { enabled: !deleting });
  const { data: cards, isLoading: cardsLoading } = useCards(id, {
    enabled: !deleting,
  });
  const deleteDeck = useDeleteDeck();
  const { create, update, remove } = useCardMutations(id);
  const togglePublic = useTogglePublic(id);

  // 공유 링크 복사 완료 표시 (잠깐 체크 아이콘)
  const [linkCopied, setLinkCopied] = useState(false);

  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [pendingCardDelete, setPendingCardDelete] = useState<
    string | number | null
  >(null);

  // 사진 가져오기 커밋 직후 토스트 (location.state.imported)
  const importedCount = (location.state as { imported?: number } | null)
    ?.imported;
  // StrictMode 이중 호출/재렌더에도 1회만 — replaceState는 router state를 못 지움
  const importToastShown = useRef(false);
  useEffect(() => {
    if (!importedCount || importToastShown.current) return;
    importToastShown.current = true;
    toast.success(t("import.committed", { count: importedCount }));
    // state 소비 — 새로고침/뒤로가기 시 재노출 방지
    window.history.replaceState({}, "");
  }, [importedCount, toast, t]);

  // 카드 추가 폼 상태
  const [term, setTerm] = useState("");
  const [reading, setReading] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");

  const canAdd = term.trim() && definition.trim() && !create.isPending;

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    try {
      await create.mutateAsync({
        term: term.trim(),
        reading: reading.trim() || undefined,
        definition: definition.trim(),
        example: example.trim() || undefined,
      });
      setTerm("");
      setReading("");
      setDefinition("");
      setExample("");
      toast.success(t("card.addedToast"));
    } catch {
      toast.error(t("card.addError"));
    }
  };

  const onSaveCard = async (
    cardId: string | number,
    payload: UpdateCardPayload
  ) => {
    await update.mutateAsync({ id: cardId, payload });
    toast.success(t("card.savedToast"));
  };

  const onDeleteDeck = async () => {
    // 재조회 차단 먼저 — 진행 중 in-flight 쿼리 취소 + 캐시 제거
    setDeleting(true);
    await qc.cancelQueries({ queryKey: deckKey(id) });
    await qc.cancelQueries({ queryKey: cardsKey(id) });
    await deleteDeck.mutateAsync(id);
    // 404 콘솔 에러 방지 — 이동 전 상세/카드 쿼리 제거
    qc.removeQueries({ queryKey: deckKey(id) });
    qc.removeQueries({ queryKey: cardsKey(id) });
    toast.success(t("deck.deletedToast"));
    navigate("/", { replace: true });
  };

  // 공개 토글 — 실패 시 토스트
  const onTogglePublic = async (next: boolean) => {
    try {
      await togglePublic.mutateAsync(next);
      toast.success(next ? t("share.madePublic") : t("share.madePrivate"));
    } catch {
      toast.error(t("share.toggleError"));
    }
  };

  // 공유 링크 클립보드 복사
  const onCopyLink = async () => {
    const url = `${window.location.origin}/explore/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast.success(t("share.linkCopied"));
    } catch {
      toast.error(t("share.linkCopyError"));
    }
  };

  // 복사 체크 표시 자동 해제 (cleanup)
  useEffect(() => {
    if (!linkCopied) return;
    const tid = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(tid);
  }, [linkCopied]);

  if (deckError) {
    return (
      <div className="min-h-[100dvh]">
        <PageHeader title={t("deck.detail")} onBack={() => navigate("/")} />
        <div className="px-5 pt-10 text-center">
          <p className="text-body-sm font-bold text-seed/60">
            {t("deck.loadError")}
          </p>
        </div>
      </div>
    );
  }

  const cardCount = cards?.length ?? deck?.card_count ?? 0;

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title={deck?.title || t("deck.detail")}
        onBack={() => navigate("/")}
        right={
          deck && (
            <IconButton
              label={t("common.delete")}
              variant="ghost"
              className="text-pop hover:bg-pop-soft"
              onClick={() => setConfirmDeleteDeck(true)}
            >
              <Trash2 size={20} />
            </IconButton>
          )
        }
      />

      <div className="mx-auto max-w-screen-sm px-5 pt-4">
        {/* 덱 메타 카드 */}
        {deckLoading ? (
          <Skeleton className="h-28 w-full" rounded="xl" />
        ) : deck ? (
          <section className="seed-dots rounded-3xl bg-kiwi p-5 text-white shadow-soft">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline" size="sm" className="text-white ring-white/40">
                {deck.kind === "grammar"
                  ? t("deck.kindGrammar")
                  : t("deck.kindVocab")}
              </Badge>
              <Badge tone="outline" size="sm" className="text-white ring-white/40">
                {langLabel(deck.lang_term)}
                <ArrowRight size={11} className="mx-0.5 opacity-60" />
                {langLabel(deck.lang_def)}
              </Badge>
            </div>
            {deck.description && (
              <p className="mt-3 text-body-sm text-white/90">
                {deck.description}
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-body-sm font-bold text-white/85">
              <Layers size={15} />
              {t("deck.cardCount", { count: cardCount })}
            </p>
          </section>
        ) : null}

        {/* 공유 — 공개 토글 + (공개 시) 링크 복사 */}
        {deck && (
          <section className="mt-3 overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-border">
            <div className="flex items-center gap-3 p-4">
              <span
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors",
                  deck.is_public
                    ? "bg-kiwi-100 text-kiwi-700"
                    : "bg-ink-100 text-ink-600",
                ].join(" ")}
              >
                {deck.is_public ? <Globe size={20} /> : <Lock size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-bold text-seed">
                  {deck.is_public ? t("share.publicTitle") : t("share.privateTitle")}
                </p>
                <p className="truncate text-caption text-seed/50">
                  {deck.is_public ? t("share.publicHint") : t("share.privateHint")}
                </p>
              </div>
              {/* 공개 스위치 — 44px+ 터치 타겟 */}
              <button
                type="button"
                role="switch"
                aria-checked={!!deck.is_public}
                aria-label={t("share.toggleLabel")}
                disabled={togglePublic.isPending}
                onClick={() => onTogglePublic(!deck.is_public)}
                className={[
                  "relative h-8 w-[52px] shrink-0 rounded-full p-1 transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  "disabled:opacity-60",
                  deck.is_public ? "bg-kiwi" : "bg-ink-200",
                ].join(" ")}
              >
                <span
                  className={[
                    "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
                    deck.is_public ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>

            {/* 공개 상태에서만 노출되는 공유 링크 바 */}
            {deck.is_public && (
              <div className="border-t border-border bg-kiwi-50/60 p-3">
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-2xl bg-surface px-3.5 text-left ring-1 ring-border transition active:scale-[0.99] hover:ring-kiwi-300"
                >
                  <Link2 size={17} className="shrink-0 text-kiwi-600" />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-seed/70">
                    {`${window.location.origin}/explore/${id}`}
                  </span>
                  <span
                    className={[
                      "flex shrink-0 items-center gap-1 text-caption font-bold",
                      linkCopied ? "text-kiwi-700" : "text-kiwi-600",
                    ].join(" ")}
                  >
                    {linkCopied ? (
                      <>
                        <Check size={15} />
                        {t("share.copied")}
                      </>
                    ) : (
                      t("share.copyLink")
                    )}
                  </span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* 주요 액션 — 학습 시작(눈에 띄게) + 사진으로 */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.6fr_1fr]">
          <Button
            variant="danger"
            size="lg"
            fullWidth
            leftIcon={<Play size={20} fill="currentColor" />}
            disabled={cardCount === 0}
            onClick={() => setModeSheetOpen(true)}
          >
            {t("deck.startStudy")}
          </Button>
          {deck && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<Camera size={18} />}
              onClick={() =>
                navigate(
                  `/import?deck=${id}&lang_term=${deck.lang_term}&lang_def=${deck.lang_def}&kind=${deck.kind}`
                )
              }
            >
              {t("import.fromPhotoShort")}
            </Button>
          )}
        </div>

        {/* 카드 추가 폼 */}
        <Card padding="sm" className="mt-5">
          <p className="mb-2.5 text-caption font-bold uppercase tracking-wide text-kiwi-700">
            {t("card.addTitle")}
          </p>
          <form onSubmit={onAdd}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <AddInput
                value={term}
                onChange={setTerm}
                placeholder={t("card.term")}
                required
              />
              <AddInput
                value={reading}
                onChange={setReading}
                placeholder={t("card.reading")}
              />
              <div className="sm:col-span-2">
                <AddInput
                  value={definition}
                  onChange={setDefinition}
                  placeholder={t("card.definition")}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <AddInput
                  value={example}
                  onChange={setExample}
                  placeholder={t("card.example")}
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              className="mt-3"
              loading={create.isPending}
              disabled={!canAdd}
            >
              {t("card.addCta")}
            </Button>
          </form>
        </Card>

        {/* 카드 목록 */}
        <div className="mt-5 pb-4">
          {cardsLoading ? (
            <ul className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-20 w-full" rounded="xl" />
                </li>
              ))}
            </ul>
          ) : cards && cards.length > 0 ? (
            <ul className="space-y-3">
              {cards.map((card, i) => (
                <CardEditorRow
                  key={card.id}
                  card={card}
                  index={i}
                  onSave={onSaveCard}
                  onDelete={(cid) => setPendingCardDelete(cid)}
                  saving={update.isPending}
                  langTerm={deck?.lang_term}
                />
              ))}
            </ul>
          ) : (
            <Card padding="md">
              <EmptyState
                mood="sleepy"
                compact
                title={t("card.emptyHint")}
              />
            </Card>
          )}
        </div>
      </div>

      {/* 학습 모드 선택 시트 */}
      <ModeSheet
        open={modeSheetOpen}
        cardCount={cardCount}
        onClose={() => setModeSheetOpen(false)}
        onPick={(mode) => {
          setModeSheetOpen(false);
          navigate(`/study/${id}/${mode}`);
        }}
      />

      {/* 덱 삭제 확인 */}
      <ConfirmSheet
        open={confirmDeleteDeck}
        title={t("deck.deleteConfirmTitle")}
        message={t("deck.deleteConfirmBody")}
        confirmLabel={t("common.delete")}
        danger
        loading={deleteDeck.isPending}
        onCancel={() => setConfirmDeleteDeck(false)}
        onConfirm={onDeleteDeck}
      />

      {/* 카드 삭제 확인 */}
      <ConfirmSheet
        open={pendingCardDelete !== null}
        title={t("card.deleteConfirmTitle")}
        confirmLabel={t("common.delete")}
        danger
        loading={remove.isPending}
        onCancel={() => setPendingCardDelete(null)}
        onConfirm={async () => {
          if (pendingCardDelete !== null) {
            await remove.mutateAsync(pendingCardDelete);
            toast.success(t("card.deletedToast"));
          }
          setPendingCardDelete(null);
        }}
      />
    </div>
  );
}

// 카드 추가 인라인 입력 — TextField 위에 얇게 래핑 (필수 표시 *)
function AddInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder + (required ? " *" : "")}
    />
  );
}
