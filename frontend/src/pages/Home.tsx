// 홈 — 내 단어장 목록. 모바일 1열 / 데스크탑 2~3열 그리드.
// 빈 상태는 KiwiBuddy + "첫 단어장 만들기" CTA, 로딩은 Skeleton 카드.
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import {
  CheckSquare,
  Compass,
  Layers,
  Plus,
  X,
} from "lucide-react";
import LogoWordmark from "../components/LogoWordmark";
import LanguageSwitcher from "../components/LanguageSwitcher";
import CreateSheet from "../components/layout/CreateSheet";
import DeckCard from "../components/deck/DeckCard";
import {
  Button,
  Card,
  Skeleton,
  EmptyState,
  Sheet,
  TextField,
  useToast,
} from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { useDecks, useMergeDecks } from "../hooks/useDecks";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const name = user?.display_name || user?.email?.split("@")[0] || "Kiwi";

  const { data: decks, isLoading, isError, refetch } = useDecks();
  const mergeDecks = useMergeDecks();

  // 통합 만들기 시트
  const [createOpen, setCreateOpen] = useState(false);

  // 병합 선택 모드 상태
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [mergeSheetOpen, setMergeSheetOpen] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");

  // 선택된 첫 덱의 kind 가 병합 가능한 종류를 고정(단어/문법 혼합 금지).
  // 선택이 비면 잠금 해제.
  const lockedKind = useMemo(() => {
    if (!decks || selectedIds.length === 0) return null;
    const first = decks.find((d) => d.id === selectedIds[0]);
    return first?.kind ?? null;
  }, [decks, selectedIds]);

  const toggleSelect = (deckId: string | number) =>
    setSelectedIds((prev) =>
      prev.includes(deckId)
        ? prev.filter((x) => x !== deckId)
        : [...prev, deckId]
    );

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const onMerge = async (e: FormEvent) => {
    e.preventDefault();
    if (mergeTitle.trim().length === 0 || selectedIds.length < 2) return;
    try {
      const newDeck = await mergeDecks.mutateAsync({
        deck_ids: selectedIds,
        title: mergeTitle.trim(),
      });
      setMergeSheetOpen(false);
      exitSelecting();
      setMergeTitle("");
      toast.success(t("deck.mergedToast"));
      navigate(`/decks/${newDeck.id}`);
    } catch (err) {
      // 백엔드 400(다른 kind 혼합 등) 메시지를 그대로 노출, 없으면 일반 메시지
      const detail =
        isAxiosError(err) &&
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : null;
      toast.error(detail ?? t("deck.mergeError"));
    }
  };

  const hasDecks = !!decks && decks.length > 0;

  return (
    <div className="min-h-[100dvh]">
      {/* 상단 그린 헤더 */}
      <header className="seed-dots bg-kiwi px-5 pb-7 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between pt-2 md:hidden">
          <LogoWordmark height={60} />
          <LanguageSwitcher />
        </div>

        <div className="mt-5 md:mt-2">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white">
            {t("home.welcome", { name })}
          </h1>
          <p className="mt-1 text-body-sm text-white/85">
            {t("deck.listSubtitle")}
          </p>
        </div>

        {/* 모바일 전용 탐색 진입 (데스크탑은 사이드바에 탐색 항목 존재) */}
        <button
          type="button"
          onClick={() => navigate("/explore")}
          className="mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-white/15 px-4 py-3 text-left text-white backdrop-blur-sm transition active:scale-[0.98] hover:bg-white/20 md:hidden"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Compass size={18} strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm font-bold">
              {t("explore.title")}
            </span>
            <span className="block truncate text-caption text-white/80">
              {t("explore.homeEntryHint")}
            </span>
          </span>
        </button>
      </header>

      <div className="px-5 pt-5">
        {/* 섹션 헤더 + 액션 */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-seed">
            {t("deck.myDecks")}
            {decks && decks.length > 0 && (
              <span className="ml-1.5 text-body-sm font-bold text-seed/40">
                {decks.length}
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selecting ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<X size={16} />}
                onClick={exitSelecting}
              >
                {t("common.cancel")}
              </Button>
            ) : (
              <>
                {/* 2개 이상 덱이 있을 때만 합치기 진입 노출 */}
                {decks && decks.length >= 2 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<CheckSquare size={16} />}
                    onClick={() => setSelecting(true)}
                  >
                    {t("deck.mergeEntry")}
                  </Button>
                )}
                {/* 통합 만들기 진입 (단어/문법 × 직접/사진/AI) */}
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={16} strokeWidth={2.6} />}
                  onClick={() => setCreateOpen(true)}
                >
                  {t("create.title")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 로딩 — 스켈레톤 카드 */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} padding="md" elevation="md" className="min-h-[140px]">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-14" rounded="full" />
                  <Skeleton className="ml-auto h-6 w-20" rounded="full" />
                </div>
                <Skeleton className="mt-3 h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
                <Skeleton className="mt-5 h-4 w-16" />
              </Card>
            ))}
          </div>
        )}

        {/* 에러 */}
        {isError && (
          <Card padding="lg" className="text-center">
            <p className="text-body-sm font-bold text-seed/70">
              {t("deck.loadError")}
            </p>
            <Button
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => refetch()}
            >
              {t("common.retry")}
            </Button>
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !isError && decks && decks.length === 0 && (
          <Card padding="lg">
            <EmptyState
              mood="happy"
              title={t("deck.emptyTitle")}
              description={t("deck.emptyHint")}
              action={
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  leftIcon={<Plus size={18} strokeWidth={2.6} />}
                  onClick={() => setCreateOpen(true)}
                >
                  {t("deck.createFirst")}
                </Button>
              }
            />
          </Card>
        )}

        {/* 선택 모드 안내 배너 — kind 잠금 시 같은 종류 안내 */}
        {selecting && hasDecks && (
          <div className="mb-4 rounded-2xl bg-kiwi-50 px-4 py-3 text-body-sm font-bold text-kiwi-800 ring-1 ring-kiwi-200">
            {lockedKind != null
              ? t("deck.mergeSameKindHint", {
                  kind:
                    lockedKind === "grammar"
                      ? t("deck.kindGrammar")
                      : t("deck.kindVocab"),
                })
              : t("deck.mergeSelectHint")}
          </div>
        )}

        {/* 덱 그리드 — 선택 모드면 카드 토글, 하단 액션바 공간 확보 */}
        {!isLoading && !isError && hasDecks && (
          <div
            className={[
              "grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3",
              selecting ? "pb-28" : "",
            ].join(" ")}
          >
            {decks!.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                selectable={selecting}
                selected={selectedIds.includes(deck.id)}
                // 첫 선택의 kind 와 다르면 합칠 수 없어 비활성
                disabled={
                  selecting &&
                  lockedKind != null &&
                  deck.kind !== lockedKind
                }
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* 병합 액션바 — 선택 모드 하단 고정. 모바일은 탭바 위, 데스크탑은 사이드바 옆. */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-nav border-y border-border bg-surface/95 px-5 py-3 backdrop-blur-sm md:bottom-0 md:left-64 md:border-b-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-screen-sm items-center gap-3">
            <p className="min-w-0 flex-1 text-body-sm font-bold text-seed/70">
              {t("deck.mergeSelectedCount", { count: selectedIds.length })}
            </p>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Layers size={18} />}
              disabled={selectedIds.length < 2}
              onClick={() => {
                setMergeTitle("");
                setMergeSheetOpen(true);
              }}
            >
              {t("deck.mergeCta", { count: selectedIds.length })}
            </Button>
          </div>
        </div>
      )}

      {/* 병합 제목 입력 시트 */}
      <Sheet
        open={mergeSheetOpen}
        onClose={() => setMergeSheetOpen(false)}
        title={t("deck.mergeSheetTitle")}
      >
        <form onSubmit={onMerge}>
          <p className="mb-3 text-body-sm text-seed/60">
            {t("deck.mergeSheetHint", { count: selectedIds.length })}
          </p>
          <TextField
            value={mergeTitle}
            autoFocus
            onChange={(e) => setMergeTitle(e.target.value)}
            placeholder={t("deck.titlePlaceholder")}
          />
          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="mt-4"
            loading={mergeDecks.isPending}
            disabled={mergeTitle.trim().length === 0 || selectedIds.length < 2}
          >
            {t("deck.mergeConfirmCta")}
          </Button>
        </form>
      </Sheet>

      {/* 통합 만들기 시트 */}
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
