// Skeleton — 로딩 자리표시자. 시머 애니메이션.
import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  rounded?: "md" | "lg" | "xl" | "full";
  style?: CSSProperties;
}

const ROUND: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  full: "rounded-full",
};

export default function Skeleton({
  className = "",
  rounded = "lg",
  style,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={[
        "skeleton-shimmer animate-shimmer",
        ROUND[rounded],
        className,
      ].join(" ")}
    />
  );
}
