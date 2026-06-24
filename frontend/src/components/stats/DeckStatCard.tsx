// 덱별 숙련도 카드 — 제목 + 정답률 Badge + 마스터/학습 진행 바 + 씨앗(avg_box).
// 탭하면 해당 덱 상세로 이동.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Card, Badge, ProgressBar } from "../ui";
import SeedPips from "./SeedPips";
import type { DeckStat } from "../../types/stats";

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default function DeckStatCard({ stat }: { stat: DeckStat }) {
  const { t } = useTranslation();
  const accuracy = Math.round((stat.accuracy ?? 0) * 100);
  const masterPct = pct(stat.mastered, stat.card_count);
  const studyPct = pct(stat.studied, stat.card_count);

  // 정답률 톤: 80%+ 그린 / 50%+ 중립 / 그 외 코랄
  const accTone =
    stat.studied === 0
      ? "neutral"
      : accuracy >= 80
        ? "success"
        : accuracy >= 50
          ? "kiwi"
          : "pop";

  return (
    <Link
      to={`/decks/${stat.deck_id}`}
      className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <Card interactive padding="md">
        {/* 헤더: 제목 + 정답률 */}
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 line-clamp-1 font-display text-[17px] font-bold text-seed">
            {stat.title}
          </h3>
          <Badge tone={accTone} size="sm" className="shrink-0">
            {stat.studied === 0 ? t("stats.notStudied") : `${accuracy}%`}
          </Badge>
        </div>

        {/* 진행: 학습한 카드 위에 마스터 비율을 겹쳐 보여줌 */}
        <div className="relative mt-3">
          {/* 학습(연한 그린) */}
          <ProgressBar
            value={studyPct}
            tone="kiwi"
            size="md"
            className="opacity-40"
            label={t("stats.studied")}
          />
          {/* 마스터(진한 그린) — 같은 트랙 위 오버레이 */}
          <div className="pointer-events-none absolute inset-0">
            <ProgressBar
              value={masterPct}
              tone="kiwi"
              size="md"
              label={t("stats.mastered")}
            />
          </div>
        </div>

        {/* 하단: 마스터/학습 수치 + 씨앗 + chevron */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-caption font-bold text-seed/55 tabular-nums">
            <span className="text-kiwi-700">{stat.mastered}</span>
            {" / "}
            {stat.studied} {t("stats.ofCards", { count: stat.card_count })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SeedPips
              value={stat.avg_box}
              label={t("stats.avgBoxLabel", {
                value: stat.avg_box.toFixed(1),
              })}
            />
            <ChevronRight
              size={18}
              className="text-seed/25 transition group-hover:translate-x-0.5 group-hover:text-seed/45"
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
