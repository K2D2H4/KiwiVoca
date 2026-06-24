// 테마 토글 — light | dark | system. 슬라이드 알약(SegmentedControl 패턴).
// variant="full": 아이콘+라벨 3분할(프로필) / variant="compact": 아이콘만(사이드바).
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Sun, Moon, MonitorSmartphone, type LucideIcon } from "lucide-react";
import { useTheme, type ThemeMode } from "../context/ThemeContext";

const MODES: { value: ThemeMode; icon: LucideIcon; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: MonitorSmartphone, labelKey: "theme.system" },
];

interface ThemeToggleProps {
  variant?: "full" | "compact";
  className?: string;
}

export default function ThemeToggle({
  variant = "full",
  className = "",
}: ThemeToggleProps) {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const compact = variant === "compact";

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className={[
        "inline-flex items-center rounded-full bg-ink-100/80 p-1 ring-1 ring-border/60",
        compact ? "" : "w-full",
        className,
      ].join(" ")}
    >
      {MODES.map(({ value, icon: Icon, labelKey }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={t(labelKey)}
            onClick={() => setMode(value)}
            className={[
              "relative inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full font-bold tracking-tight transition-colors active:scale-95",
              compact ? "min-w-[44px] px-2.5" : "flex-1 px-3 text-body-sm",
              active ? "text-white" : "text-seed/55 hover:text-seed",
            ].join(" ")}
          >
            {active && (
              <motion.span
                layoutId="theme-active-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-0 rounded-full bg-kiwi shadow-kiwi-glow"
              />
            )}
            <Icon
              size={compact ? 18 : 17}
              strokeWidth={active ? 2.6 : 2.1}
              className="relative z-raised shrink-0"
            />
            {!compact && (
              <span className="relative z-raised">{t(labelKey)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
