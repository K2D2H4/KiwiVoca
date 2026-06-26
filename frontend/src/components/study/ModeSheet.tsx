// 모드 선택 바텀시트 — Sheet 프리미티브 기반. 4개 모드 큰 카드(아이콘+설명), 카드 부족 모드 비활성.
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Layers, ListChecks, Keyboard, Grid2x2, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, Badge } from "../ui";
import { staggerParent, staggerItem } from "../../lib/motion";
import type { StudyMode } from "../../types/study";

interface ModeSheetProps {
  open: boolean;
  cardCount: number;
  onClose: () => void;
  onPick: (mode: StudyMode) => void;
}

const MODES: {
  mode: StudyMode;
  min: number;
  Icon: LucideIcon;
  tile: string;
}[] = [
  { mode: "flashcards", min: 1, Icon: Layers, tile: "bg-kiwi-100 text-kiwi-700" },
  { mode: "choice", min: 4, Icon: ListChecks, tile: "bg-bark/12 text-bark" },
  { mode: "typing", min: 1, Icon: Keyboard, tile: "bg-info-soft text-info" },
  { mode: "match", min: 4, Icon: Grid2x2, tile: "bg-warning-soft text-warning" },
];

export default function ModeSheet({
  open,
  cardCount,
  onClose,
  onPick,
}: ModeSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t("study.pickMode")}>
      <div className="mb-4">
        <h2 className="text-h3 font-bold text-seed">{t("study.pickMode")}</h2>
        <p className="mt-0.5 text-body-sm text-seed/50">
          {t("study.pickModeHint")}
        </p>
      </div>

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3"
      >
        {MODES.map(({ mode, min, Icon, tile }) => {
          const enabled = cardCount >= min;
          return (
            <motion.button
              key={mode}
              variants={staggerItem}
              type="button"
              disabled={!enabled}
              onClick={() => onPick(mode)}
              whileTap={enabled ? { scale: 0.97 } : undefined}
              className={[
                "relative flex min-h-[148px] flex-col items-start gap-2.5 rounded-3xl bg-surface p-4 text-left",
                "outline-none transition focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                enabled
                  ? "shadow-soft hover:shadow-lg"
                  : "cursor-not-allowed ring-1 ring-border",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-2xl",
                  enabled ? tile : "bg-ink-100 text-ink-400",
                ].join(" ")}
              >
                <Icon size={24} strokeWidth={2.2} />
              </span>
              <span className="block text-body font-bold text-seed">
                {t(`study.mode_${mode}`)}
              </span>
              <span className="block text-caption font-medium leading-snug text-seed/50">
                {t(`study.mode_${mode}_desc`)}
              </span>
              {!enabled && (
                <Badge
                  tone="neutral"
                  size="sm"
                  leftIcon={<Lock size={11} strokeWidth={2.6} />}
                  className="mt-auto"
                >
                  {t("study.needCardsShort", { count: min })}
                </Badge>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </Sheet>
  );
}
