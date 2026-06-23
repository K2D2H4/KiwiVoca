// Card / Surface — 컨테이너 프리미티브. 라운드 강조 + elevation 토큰.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

type Elevation = "flat" | "sm" | "md" | "lg";
type Padding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  padding?: Padding;
  interactive?: boolean; // hover/active 피드백 (탭 가능한 카드)
  children: ReactNode;
}

const ELEVATION: Record<Elevation, string> = {
  flat: "ring-1 ring-border",
  sm: "shadow-sm",
  md: "shadow-soft",
  lg: "shadow-lg",
};

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-3.5",
  md: "p-5",
  lg: "p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      elevation = "md",
      padding = "md",
      interactive = false,
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-3xl bg-surface",
          ELEVATION[elevation],
          PADDING[padding],
          interactive
            ? "cursor-pointer transition active:scale-[0.985] hover:shadow-lg"
            : "",
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
