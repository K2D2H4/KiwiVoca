// SegmentedControl — 토글 그룹 (언어/모드). 활성 알약이 부드럽게 슬라이드.
import { motion } from "framer-motion";

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
  /** 레이아웃 애니메이션을 공유하기 위한 고유 id */
  layoutId?: string;
}

export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className = "",
  layoutId = "seg-active",
}: SegmentedControlProps<T>) {
  const pad = size === "sm" ? "p-0.5" : "p-1";
  // 터치 타겟 ≥44×44 보장 (min-w/min-h)
  const cell =
    size === "sm"
      ? "min-h-[44px] min-w-[44px] px-2.5 text-xs"
      : "min-h-[44px] min-w-[44px] px-3 text-body-sm";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center rounded-full bg-ink-100/80 ring-1 ring-border/60",
        pad,
        className,
      ].join(" ")}
    >
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(seg.value)}
            className={[
              "relative inline-flex items-center justify-center rounded-full font-bold tracking-tight transition-colors active:scale-95",
              cell,
              active ? "text-white" : "text-seed/55 hover:text-seed",
            ].join(" ")}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-0 rounded-full bg-kiwi shadow-kiwi-glow"
              />
            )}
            <span className="relative z-raised">{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
