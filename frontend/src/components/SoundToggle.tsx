// 효과음 토글 — 켜짐 | 꺼짐. 슬라이드 알약(ThemeToggle 패턴).
// 켜짐을 고르면 샘플 효과음을 한 번 들려준다.
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useSoundStore } from "../store/soundStore";
import { playSound } from "../lib/sound";

const OPTIONS = [
  { value: true, icon: Volume2, labelKey: "sound.on" },
  { value: false, icon: VolumeX, labelKey: "sound.off" },
] as const;

export default function SoundToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const enabled = useSoundStore((s) => s.enabled);
  const setEnabled = useSoundStore((s) => s.setEnabled);

  const select = (next: boolean) => {
    setEnabled(next);
    if (next) playSound("correct"); // 켤 때 미리듣기
  };

  return (
    <div
      role="group"
      aria-label={t("sound.label")}
      className={[
        "inline-flex w-full items-center rounded-full bg-ink-100/80 p-1 ring-1 ring-border/60",
        className,
      ].join(" ")}
    >
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
        const active = enabled === value;
        return (
          <button
            key={labelKey}
            type="button"
            aria-pressed={active}
            aria-label={t(labelKey)}
            onClick={() => select(value)}
            className={[
              "relative inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-body-sm font-bold tracking-tight transition-colors active:scale-95",
              active ? "text-white" : "text-seed/55 hover:text-seed",
            ].join(" ")}
          >
            {active && (
              <motion.span
                layoutId="sound-active-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-0 rounded-full bg-kiwi shadow-kiwi-glow"
              />
            )}
            <Icon
              size={17}
              strokeWidth={active ? 2.6 : 2.1}
              className="relative z-raised shrink-0"
            />
            <span className="relative z-raised">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
