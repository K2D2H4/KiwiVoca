// 진척 통계 대시보드 — /stats. Orchard Pop 디자인 시스템.
// 상단: 정답률 링 + 연속학습일/오늘학습/복습필요 요약. 전체 현황 진행 + 덱별 숙련도.
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Flame, Sparkles, Clock, type LucideIcon } from "lucide-react";
import { Card, Skeleton, EmptyState, Button, ProgressBar } from "../components/ui";
import AccuracyRing from "../components/stats/AccuracyRing";
import DeckStatCard from "../components/stats/DeckStatCard";
import { useOverview, useDeckStats } from "../hooks/useStats";
import { useCountUp } from "../hooks/useCountUp";
import { staggerParent, staggerItem } from "../lib/motion";
import type { StatsOverview } from "../types/stats";

export default function Stats() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    data: overview,
    isLoading: ovLoading,
    isError: ovError,
    refetch: refetchOverview,
  } = useOverview();
  const { data: deckStats, isLoading: deckLoading } = useDeckStats();

  const loading = ovLoading || deckLoading;

  // 학습 기록이 전혀 없는 빈 상태 판정
  const isEmpty =
    !loading &&
    !ovError &&
    overview != null &&
    overview.studied_cards === 0 &&
    overview.total_cards >= 0 &&
    overview.streak_days === 0;

  return (
    <div className="min-h-[100dvh] md:min-h-0">
      {/* ===== 그린 헤더 ===== */}
      <header className="seed-dots bg-kiwi px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-screen-md">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white">
            {t("stats.title")}
          </h1>
          <p className="mt-1 text-body-sm text-white/85">{t("stats.subtitle")}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-screen-md px-5">
        {/* 에러 */}
        {ovError && (
          <Card padding="lg" className="mt-5 text-center">
            <p className="text-body-sm font-bold text-seed/70">
              {t("stats.loadError")}
            </p>
            <Button
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => refetchOverview()}
            >
              {t("common.retry")}
            </Button>
          </Card>
        )}

        {/* 로딩 */}
        {loading && <StatsSkeleton />}

        {/* 빈 상태 */}
        {isEmpty && (
          <Card padding="lg" className="mt-5">
            <EmptyState
              mood="sleepy"
              title={t("stats.emptyTitle")}
              description={t("stats.emptyHint")}
              action={
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  leftIcon={<Sparkles size={18} strokeWidth={2.4} />}
                  onClick={() => navigate("/study")}
                >
                  {t("stats.startStudy")}
                </Button>
              }
            />
          </Card>
        )}

        {/* 본문 */}
        {!loading && !ovError && !isEmpty && overview && (
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="space-y-4 pt-5"
          >
            {/* 히어로: 정답률 링 + 요약 타일 */}
            <motion.div variants={staggerItem}>
              <Card padding="lg">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-7">
                  {/* 링 */}
                  <div className="shrink-0">
                    <AccuracyRing
                      value={Math.round((overview.overall_accuracy ?? 0) * 100)}
                      caption={t("stats.accuracy")}
                      label={t("stats.overallAccuracy")}
                    />
                  </div>

                  {/* 요약 미니 타일 3개 */}
                  <div className="grid w-full grid-cols-3 gap-2.5 sm:grid-cols-1 sm:gap-3">
                    <MiniStat
                      icon={Flame}
                      tone="pop"
                      value={overview.streak_days}
                      suffix={t("stats.daysUnit")}
                      label={t("stats.streak")}
                    />
                    <MiniStat
                      icon={Sparkles}
                      tone="kiwi"
                      value={overview.studied_today}
                      label={t("stats.today")}
                    />
                    <MiniStat
                      icon={Clock}
                      tone="info"
                      value={overview.due_cards}
                      label={t("stats.due")}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* 전체 현황 */}
            <motion.div variants={staggerItem}>
              <OverallCard overview={overview} />
            </motion.div>

            {/* 덱별 숙련도 */}
            {deckStats && deckStats.length > 0 && (
              <motion.div variants={staggerItem} className="space-y-3">
                <h2 className="px-1 font-display text-base font-bold text-seed">
                  {t("stats.byDeck")}
                  <span className="ml-1.5 text-body-sm font-bold text-seed/40">
                    {deckStats.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {deckStats.map((s) => (
                    <DeckStatCard key={String(s.deck_id)} stat={s} />
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ===== 요약 미니 타일 =====
function MiniStat({
  icon: Icon,
  tone,
  value,
  suffix,
  label,
}: {
  icon: LucideIcon;
  tone: "pop" | "kiwi" | "info";
  value: number;
  suffix?: string;
  label: string;
}) {
  const display = useCountUp(value, 0.9, 0.2);
  const toneCls = {
    pop: "bg-pop-soft text-pop-dark",
    kiwi: "bg-kiwi-100 text-kiwi-700",
    info: "bg-info-soft text-info",
  }[tone];

  return (
    <div className="flex flex-col items-center rounded-2xl bg-cream px-2 py-3 text-center sm:flex-row sm:gap-3 sm:px-3 sm:text-left">
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          toneCls,
        ].join(" ")}
      >
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <div className="mt-1.5 min-w-0 sm:mt-0">
        <p className="font-display text-h3 font-bold leading-none text-seed tabular-nums">
          {display}
          {suffix && (
            <span className="ml-0.5 text-body-sm font-bold text-seed/45">
              {suffix}
            </span>
          )}
        </p>
        <p className="mt-1 truncate text-caption font-bold text-seed/50">
          {label}
        </p>
      </div>
    </div>
  );
}

// ===== 전체 현황 카드 =====
function OverallCard({ overview }: { overview: StatsOverview }) {
  const { t } = useTranslation();
  const { total_cards, studied_cards, mastered_cards, total_decks } = overview;
  const studyPct = total_cards > 0 ? (studied_cards / total_cards) * 100 : 0;
  const masterPct = total_cards > 0 ? (mastered_cards / total_cards) * 100 : 0;

  return (
    <Card padding="md">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-base font-bold text-seed">
          {t("stats.overall")}
        </h2>
        <span className="text-caption font-bold text-seed/45 tabular-nums">
          {t("stats.deckCardSummary", {
            decks: total_decks,
            cards: total_cards,
          })}
        </span>
      </div>

      {/* 학습한 카드 */}
      <Row
        label={t("stats.studied")}
        value={studied_cards}
        total={total_cards}
        pct={studyPct}
        tone="kiwi"
      />
      {/* 마스터 */}
      <Row
        label={t("stats.mastered")}
        value={mastered_cards}
        total={total_cards}
        pct={masterPct}
        tone="pop"
        className="mt-4"
      />
    </Card>
  );
}

function Row({
  label,
  value,
  total,
  pct,
  tone,
  className = "",
}: {
  label: string;
  value: number;
  total: number;
  pct: number;
  tone: "kiwi" | "pop";
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-body-sm font-bold text-seed/70">{label}</span>
        <span className="text-body-sm font-bold text-seed tabular-nums">
          {value}
          <span className="text-seed/40"> / {total}</span>
        </span>
      </div>
      <ProgressBar value={pct} tone={tone} label={label} />
    </div>
  );
}

// ===== 로딩 스켈레톤 =====
function StatsSkeleton() {
  return (
    <div className="space-y-4 pt-5">
      <Card padding="lg">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className="h-[168px] w-[168px] shrink-0" rounded="full" />
          <div className="grid w-full grid-cols-3 gap-2.5 sm:grid-cols-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 sm:h-16" rounded="lg" />
            ))}
          </div>
        </div>
      </Card>
      <Card padding="md">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-4 h-3 w-full" rounded="full" />
        <Skeleton className="mt-5 h-3 w-full" rounded="full" />
      </Card>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-2.5 w-full" rounded="full" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </Card>
        ))}
      </div>
    </div>
  );
}
