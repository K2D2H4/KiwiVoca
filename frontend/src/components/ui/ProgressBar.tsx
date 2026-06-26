// ProgressBar — 진행률 바. 키위 그린, 부드러운 채움 애니메이션.
import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number; // 0~100
  className?: string;
  tone?: "kiwi" | "bark";
  size?: "sm" | "md";
  label?: string; // aria
}

export default function ProgressBar({
  value,
  className = "",
  tone = "kiwi",
  size = "md",
  label,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = tone === "kiwi" ? "bg-kiwi" : "bg-bark";
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={["w-full overflow-hidden rounded-full bg-ink-100", h, className].join(" ")}
    >
      <motion.div
        className={["h-full rounded-full", fill].join(" ")}
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 28 }}
      />
    </div>
  );
}
