// 탐색 — 공개 단어장 갤러리. 검색(q) + 카드 그리드(호버 강조) + "더보기" 페이지네이션.
// 모바일 우선: 그린 헤더 아래 sticky 검색바, 1열 → sm:2열 → lg:3열. 빈/로딩/에러 상태 처리.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Layers, Search, Compass, X } from "lucide-react";
import LogoWordmark from "../components/LogoWordmark";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Button, Card, Badge, Avatar, Skeleton, EmptyState } from "../components/ui";
import { langLabel } from "../lib/languages";
import { usePublicDecks } from "../hooks/useSharing";
import type { PublicDeck } from "../types/deck";

export default function Explore() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublicDecks(query);

  const decks = data?.pages.flat() ?? [];
  const isEmpty = !isLoading && !isError && decks.length === 0;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input);
  };
  const onClear = () => {
    setInput("");
    setQuery("");
  };

  return (
    <div className="min-h-[100dvh] md:min-h-0">
      {/* ===== 그린 헤더 ===== */}
      <header className="seed-dots bg-kiwi px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between pt-2 md:hidden">
          <LogoWordmark height={60} />
          <LanguageSwitcher />
        </div>

        <div className="mt-5 flex items-center gap-2 md:mt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20">
            <Compass size={20} className="text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight text-white">
              {t("explore.title")}
            </h1>
            <p className="text-body-sm text-white/85">{t("explore.subtitle")}</p>
          </div>
        </div>
      </header>

      {/* ===== sticky 검색바 ===== */}
      <div className="sticky top-0 z-header -mt-4 px-5">
        <form onSubmit={onSearch}>
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 shadow-soft ring-1 ring-border focus-within:ring-2 focus-within:ring-kiwi-400">
            <Search size={19} className="shrink-0 text-seed/40" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("explore.searchPlaceholder")}
              aria-label={t("explore.searchPlaceholder")}
              className="min-h-[48px] w-full bg-transparent text-body text-seed outline-none placeholder:text-seed/40 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {input && (
              <button
                type="button"
                onClick={onClear}
                aria-label={t("common.close")}
                className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-seed/40 transition hover:bg-cream active:scale-90"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ===== 본문 ===== */}
      <div className="px-5 pt-5">
        {/* 로딩 — 스켈레톤 */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} padding="md" className="min-h-[156px]">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-14" rounded="full" />
                  <Skeleton className="ml-auto h-6 w-20" rounded="full" />
                </div>
                <Skeleton className="mt-3 h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
                <Skeleton className="mt-5 h-7 w-28" rounded="full" />
              </Card>
            ))}
          </div>
        )}

        {/* 에러 */}
        {isError && (
          <Card padding="lg" className="text-center">
            <p className="text-body-sm font-bold text-seed/70">
              {t("explore.loadError")}
            </p>
            <Button
              variant="primary"
              size="md"
              className="mx-auto mt-4"
              onClick={() => refetch()}
            >
              {t("common.retry")}
            </Button>
          </Card>
        )}

        {/* 빈 상태 — 검색 결과 없음 vs 공개 덱 없음 구분 */}
        {isEmpty && (
          <Card padding="lg">
            <EmptyState
              mood={query ? "sad" : "sleepy"}
              title={query ? t("explore.noResults") : t("explore.emptyTitle")}
              description={
                query
                  ? t("explore.noResultsHint", { q: query })
                  : t("explore.emptyHint")
              }
              action={
                query ? (
                  <Button variant="secondary" size="md" fullWidth onClick={onClear}>
                    {t("explore.clearSearch")}
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )}

        {/* 갤러리 그리드 */}
        {!isLoading && !isError && decks.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <PublicDeckCard key={deck.id} deck={deck} />
              ))}
            </div>

            {/* 더보기 */}
            {hasNextPage && (
              <div className="mt-6 flex justify-center pb-4">
                <Button
                  variant="secondary"
                  size="md"
                  loading={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  {t("explore.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- 공개 덱 카드 — 호버 시 카드 강조(리프트+키위 링) + owner 칩 ---
function PublicDeckCard({ deck }: { deck: PublicDeck }) {
  const { t } = useTranslation();
  const isGrammar = deck.kind === "grammar";
  const count = deck.card_count ?? 0;

  return (
    <Link
      to={`/explore/${deck.id}`}
      className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-kiwi focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <Card
        interactive
        padding="md"
        className="relative flex h-full min-h-[156px] flex-col overflow-hidden hover:-translate-y-1 hover:ring-2 hover:ring-kiwi-400/50"
      >
        <div className="mb-3 flex items-center gap-1.5">
          <Badge tone={isGrammar ? "neutral" : "kiwi"} size="sm">
            {isGrammar ? t("deck.kindGrammar") : t("deck.kindVocab")}
          </Badge>
          <Badge tone="outline" size="sm" className="ml-auto">
            <span className="max-w-[4.5rem] truncate">
              {langLabel(deck.lang_term)}
            </span>
            <ArrowRight size={11} className="mx-0.5 shrink-0 opacity-50" />
            <span className="max-w-[4.5rem] truncate">
              {langLabel(deck.lang_def)}
            </span>
          </Badge>
        </div>

        <h3 className="line-clamp-2 font-display text-[17px] font-bold leading-snug text-seed">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="mt-1 line-clamp-1 text-body-sm text-seed/50">
            {deck.description}
          </p>
        )}

        {/* 하단: owner + 카드 수 */}
        <div className="mt-auto flex items-center gap-2 pt-3.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={deck.owner_name} size={22} />
            <span className="min-w-0 truncate text-body-sm font-bold text-seed/55">
              {deck.owner_name}
            </span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-body-sm font-bold text-seed/45">
            <Layers size={14} className="text-kiwi-500" />
            {count}
          </span>
        </div>

      </Card>
    </Link>
  );
}
