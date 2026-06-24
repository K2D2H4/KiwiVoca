// IconButton — 아이콘 전용 버튼. 터치 타겟 ≥44px 보장.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "ghost" | "solid" | "soft";
type Size = "sm" | "md";

type ConflictingProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps> {
  label: string; // 접근성: aria-label
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  ghost: "text-seed/70 hover:bg-ink-100/70",
  solid: "bg-kiwi text-white shadow-kiwi-glow hover:bg-kiwi-600",
  soft: "bg-surface text-seed ring-1 ring-border hover:bg-kiwi-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-11 w-11", // 44px
  md: "h-12 w-12",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "ghost", size = "sm", className = "", children, ...rest }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          VARIANTS[variant],
          SIZES[size],
          className,
        ].join(" ")}
        {...(rest as HTMLMotionProps<"button">)}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = "IconButton";
export default IconButton;
