// 덱 상세 — 헤더(제목/삭제) + 메타 + 학습/사진 CTA + 카드 추가 폼 + 카드 목록 편집.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Globe,
  GraduationCap,
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
import { useDeck, useDeleteDeck, useCopyDeck, deckKey } from "../hooks/useDecks";
import { useCards, useCardMutations, cardsKey } from "../hooks/useCards";
import { useToggleLearned } from "../hooks/useStudy";
import { useTogglePublic } from "../hooks/useSharing";
import {
  useGrammarItems,
  useToggleGrammarLearned,
} from "../hooks/useGrammar";
import type { UpdateCardPayload } from "../types/deck";
import type { GrammarItem } from "../types/grammar";

// 학습/문법 연습 시작 CTA — 키위 그린 톤 그라데이션(코랄 제거)에 흐르는 그린 외곽선(.cta-orchard-ring).
// 밝은 라임→메인 그린→딥 그린으로 깊이감을 주고, 그림자는 그린 발광 톤으로.
// 삭제(danger) 버튼의 코랄은 경고색이라 그대로 둔다(이 상수와 무관).
const START_CTA =
  "cta-orchard-ring bg-gradient-to-br from-kiwi-400 via-kiwi to-kiwi-600 hover:from-kiwi hover:via-kiwi-600 hover:to-kiwi-700 shadow-[0_5px_18px_rgba(107,191,89,0.22)]";

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
  const isGrammar = deck?.kind === "grammar";
  const { data: cards, isLoading: cardsLoading } = useCards(id, {
    enabled: !deleting && deck != null && !isGrammar,
  });
  // 문법 덱이면 문법 항목을 별도 조회 (card_count=0 이므로 항목 배열 길이로 카운트)
  const { data: grammarItems, isLoading: grammarLoading } = useGrammarItems(id, {
    enabled: !deleting && isGrammar,
  });
  const deleteDeck = useDeleteDeck();
  const copyDeck = useCopyDeck();
  const { create, update, remove } = useCardMutations(id);
  const toggleLearned = useToggleLearned(id);
  const toggleGrammarLearned = useToggleGrammarLearned(id);
  const togglePublic = useTogglePublic(id);

  // 공유 링크 복사 완료 표시 (잠깐 체크 아이콘)
  const [linkCopied, setLinkCopied] = useState(false);

  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [pendingCardDelete, setPendingCardDelete] = useState<
    string | number | null
  >(null);

  // 사진 가져오기/문법 커밋 직후 토스트 (location.state.imported | grammarImported)
  const navState = location.state as
    | { imported?: number; grammarImported?: number }
    | null;
  const importedCount = navState?.imported;
  const grammarImportedCount = navState?.grammarImported;
  // StrictMode 이중 호출/재렌더에도 1회만 — replaceState는 router state를 못 지움
  const importToastShown = useRef(false);
  useEffect(() => {
    if (importToastShown.current) return;
    if (importedCount) {
      importToastShown.current = true;
      toast.success(t("import.committed", { count: importedCount }));
      window.history.replaceState({}, "");
    } else if (grammarImportedCount) {
      importToastShown.current = true;
      toast.success(t("grammar.committed", { count: grammarImportedCount }));
      window.history.replaceState({}, "");
    }
  }, [importedCount, grammarImportedCount, toast, t]);

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

  // 학습완료 토글 — 낙관적 업데이트(훅 내부), 실패 시 롤백+토스트
  const onToggleLearned = (cardId: string | number, next: boolean) => {
    toggleLearned.mutate(
      { card_id: cardId, is_learned: next },
      { onError: () => toast.error(t("card.learnedError")) }
    );
  };

  // 문법 항목 학습완료 토글 — 낙관적 업데이트(훅 내부), 실패 시 롤백+토스트
  const onToggleGrammarLearned = (itemId: number, next: boolean) => {
    toggleGrammarLearned.mutate(
      { item_id: itemId, is_learned: next },
      { onError: () => toast.error(t("card.learnedError")) }
    );
  };

  // 덱 복사 — 카드+문법까지 복제, 진척 미복사 → 새 덱으로 이동
  const onCopyDeck = async () => {
    try {
      const newDeck = await copyDeck.mutateAsync(id);
      toast.success(t("deck.copiedToast"));
      navigate(`/decks/${newDeck.id}`, { replace: true });
    } catch {
      toast.error(t("deck.copyError"));
    }
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
      <div className="min-h-[100dvh] md:min-h-0">
        <PageHeader title={t("deck.detail")} onBack={() => navigate("/")} />
        <div className="px-5 pt-10 text-center">
          <p className="text-body-sm font-bold text-seed/60">
            {t("deck.loadError")}
          </p>
        </div>
      </div>
    );
  }

  // 단어 덱: 카드 수 / 문법 덱: 항목 수(card_count=0 이므로 항목 배열 길이 사용)
  const cardCount = isGrammar
    ? grammarItems?.length ?? 0
    : cards?.length ?? deck?.card_count ?? 0;
  // 학습완료 요약 — 완료 N / 총 M
  const learnedCount = isGrammar
    ? grammarItems?.filter((it) => it.progress.is_learned).length ?? 0
    : cards?.filter((c) => c.is_learned).length ?? 0;

  return (
    <div className="min-h-[100dvh] md:min-h-0">
      <PageHeader
        title={deck?.title || t("deck.detail")}
        onBack={() => navigate("/")}
        right={
          deck && (
            <div className="flex items-center gap-0.5">
              <IconButton
                label={t("deck.copy")}
                variant="ghost"
                disabled={copyDeck.isPending}
                onClick={onCopyDeck}
              >
                <Copy size={20} />
              </IconButton>
              <IconButton
                label={t("common.delete")}
                variant="ghost"
                className="text-pop hover:bg-pop-soft"
                onClick={() => setConfirmDeleteDeck(true)}
              >
                <Trash2 size={20} />
              </IconButton>
            </div>
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
              {isGrammar
                ? t("grammar.itemCount", { count: cardCount })
                : t("deck.cardCount", { count: cardCount })}
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

        {/* 주요 액션 — 학습/연습 시작 + 추가. 단어/문법 분기 */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.6fr_1fr]">
          {isGrammar ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<Play size={20} fill="currentColor" />}
              disabled={cardCount === 0}
              className={START_CTA}
              onClick={() =>
                navigate(`/grammar/practice?decks=${id}`)
              }
            >
              {t("grammar.startPractice")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<Play size={20} fill="currentColor" />}
              disabled={cardCount === 0}
              className={START_CTA}
              onClick={() => setModeSheetOpen(true)}
            >
              {t("deck.startStudy")}
            </Button>
          )}
          {deck &&
            (isGrammar ? (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                leftIcon={<GraduationCap size={18} />}
                onClick={() =>
                  navigate(
                    `/grammar/new?deck=${id}&lang_term=${deck.lang_term}&lang_def=${deck.lang_def}`
                  )
                }
              >
                {t("grammar.addShort")}
              </Button>
            ) : (
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
            ))}
        </div>

        {/* 카드 추가 폼 — 단어 덱에서만 */}
        {!isGrammar && (
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
        )}

        {/* 목록 — 학습완료 요약 + 단어/문법 분기 */}
        <div className="mt-5 pb-4">
          {/* 학습완료 요약 — 완료 N / 총 M + 진행 막대 (발견성↑ 카드) */}
          {cardCount > 0 && (
            <div className="mb-3 rounded-2xl bg-surface p-3.5 shadow-soft ring-1 ring-border">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-caption font-bold uppercase tracking-wide text-seed/45">
                  {t("card.progressLabel")}
                </span>
                <span className="font-display text-base font-extrabold text-kiwi-700">
                  {learnedCount}
                  <span className="text-body-sm font-bold text-seed/40">
                    {" / "}
                    {cardCount}
                  </span>
                </span>
              </div>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-kiwi transition-[width] duration-300"
                  style={{
                    width: `${cardCount ? (learnedCount / cardCount) * 100 : 0}%`,
                  }}
                />
              </span>
            </div>
          )}

          {isGrammar ? (
            // ── 문법 항목 리스트 ──
            grammarLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-28 w-full" rounded="xl" />
                  </li>
                ))}
              </ul>
            ) : grammarItems && grammarItems.length > 0 ? (
              <ul className="space-y-3">
                {grammarItems.map((item, i) => (
                  <GrammarItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    onToggleLearned={onToggleGrammarLearned}
                  />
                ))}
              </ul>
            ) : (
              <Card padding="md">
                <EmptyState
                  mood="sleepy"
                  compact
                  title={t("grammar.deckEmptyHint")}
                />
              </Card>
            )
          ) : // ── 단어 카드 리스트 ──
          cardsLoading ? (
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
                  onToggleLearned={onToggleLearned}
                  saving={update.isPending}
                  langTerm={deck?.lang_term}
                />
              ))}
            </ul>
          ) : (
            <Card padding="md">
              <EmptyState mood="sleepy" compact title={t("card.emptyHint")} />
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

// 문법 항목 행 — point + level/category 뱃지 + explanation + example + 문제 미리보기 + 학습완료 토글
function GrammarItemRow({
  item,
  index,
  onToggleLearned,
}: {
  item: GrammarItem;
  index: number;
  onToggleLearned: (itemId: number, next: boolean) => void;
}) {
  const { t } = useTranslation();
  const learned = item.progress.is_learned;
  const checkId = `glearn-${item.id}`;

  return (
    <li>
      <Card
        padding="sm"
        className={learned ? "ring-1 ring-kiwi-300" : undefined}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-caption font-bold text-seed/35">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-body font-bold text-seed">
              {item.point}
            </p>
            {(item.level || item.category) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {item.level && (
                  <Badge tone="kiwi" size="sm">
                    {item.level}
                  </Badge>
                )}
                {item.category && (
                  <Badge tone="info" size="sm">
                    {item.category}
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-2 text-body-sm text-seed/70">{item.explanation}</p>
            {item.example && (
              <p className="mt-1.5 rounded-xl bg-cream px-3 py-2 text-body-sm italic text-seed/60">
                {item.example}
              </p>
            )}
          </div>
        </div>

        {/* 학습완료 토글 — 직관적 체크박스 + 라벨 (≥44px 터치) */}
        <div className="mt-2.5 border-t border-border pt-2.5">
          <label
            htmlFor={checkId}
            className="flex min-h-[44px] cursor-pointer select-none items-center gap-2.5"
          >
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
                learned
                  ? "border-kiwi bg-kiwi text-white"
                  : "border-ink-300 bg-surface text-transparent",
              ].join(" ")}
            >
              <Check size={15} strokeWidth={3} />
            </span>
            <input
              id={checkId}
              type="checkbox"
              className="sr-only"
              checked={learned}
              onChange={(e) => onToggleLearned(item.id, e.target.checked)}
            />
            <span
              className={[
                "text-body-sm font-bold",
                learned ? "text-kiwi-700" : "text-seed/55",
              ].join(" ")}
            >
              {learned ? t("card.markUnlearned") : t("card.markLearned")}
            </span>
          </label>
        </div>
      </Card>
    </li>
  );
}
