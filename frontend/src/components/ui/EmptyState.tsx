// EmptyState — 일러스트 + 카피 + CTA. 키위 캐릭터 무드로 상황 표현.
import type { ReactNode } from "react";
import KiwiBuddy, { type KiwiMood } from "../KiwiBuddy";

interface EmptyStateProps {
  mood?: KiwiMood;
  title: string;
  description?: string;
  action?: ReactNode; // 주로 <Button>
  compact?: boolean;
  className?: string;
}

export default function EmptyState({
  mood = "happy",
  title,
  description,
  action,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center text-center",
        compact ? "py-8" : "py-14",
        className,
      ].join(" ")}
    >
      <KiwiBuddy mood={mood} size={compact ? 80 : 104} float />
      <h3 className="mt-5 text-h3 font-bold text-seed">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-body-sm text-seed/55">{description}</p>
      )}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  );
}
