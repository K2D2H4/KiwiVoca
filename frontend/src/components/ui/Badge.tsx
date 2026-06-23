// Badge / Chip — 라벨 알약. 언어쌍·kind·박스레벨 등 메타 표시용.
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "kiwi" | "neutral" | "pop" | "info" | "warning" | "success" | "outline";
type Size = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  leftIcon?: ReactNode;
  children: ReactNode;
}

const TONES: Record<Tone, string> = {
  kiwi: "bg-kiwi-100 text-kiwi-700",
  neutral: "bg-ink-100 text-ink-600",
  pop: "bg-pop-soft text-pop-dark",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  outline: "bg-transparent text-seed/60 ring-1 ring-border",
};

const SIZES: Record<Size, string> = {
  sm: "h-6 px-2 text-[11px] gap-1",
  md: "h-7 px-2.5 text-caption gap-1.5",
};

export default function Badge({
  tone = "kiwi",
  size = "md",
  leftIcon,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-bold tracking-tight",
        TONES[tone],
        SIZES[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
    </span>
  );
}
