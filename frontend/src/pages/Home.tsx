// 홈 — 내 단어장 목록. 모바일 1열 / 데스크탑 2~3열 그리드.
// 빈 상태는 KiwiBuddy + "첫 단어장 만들기" CTA, 로딩은 Skeleton 카드.
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Compass, Plus } from "lucide-react";
import KiwiMark from "../components/KiwiMark";
import LanguageSwitcher from "../components/LanguageSwitcher";
import DeckCard from "../components/deck/DeckCard";
import { Button, Card, Skeleton, EmptyState } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { useDecks } from "../hooks/useDecks";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const name = user?.display_name || user?.email?.split("@")[0] || "Kiwi";

  const { data: decks, isLoading, isError, refetch } = useDecks();

  return (
    <div className="min-h-[100dvh]">
      {/* 상단 그린 헤더 */}
      <header className="seed-dots bg-kiwi px-5 pb-7 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between pt-2 md:hidden">
          <div className="flex items-center gap-2">
            <KiwiMark size={30} />
            <span className="font-display text-lg font-extrabold text-white">
              {t("app.name")}
            </span>
          </div>
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Camera size={16} />}
              onClick={() => navigate("/import")}
            >
              {t("import.fromPhotoShort")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} strokeWidth={2.6} />}
              onClick={() => navigate("/decks/new")}
            >
              {t("deck.new")}
            </Button>
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
                  onClick={() => navigate("/decks/new")}
                >
                  {t("deck.createFirst")}
                </Button>
              }
            />
          </Card>
        )}

        {/* 덱 그리드 */}
        {!isLoading && !isError && decks && decks.length > 0 && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
