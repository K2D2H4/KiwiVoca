// Button — 프로덕션 버튼 프리미티브.
// variant: primary/secondary/ghost/danger · size: sm/md/lg · leftIcon · loading 스피너.
// 터치 타겟 ≥44px, whileTap 마이크로인터랙션.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// framer-motion과 충돌하는 드래그/애니메이션 핸들러만 제외
type ConflictingProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-kiwi text-white shadow-kiwi-glow hover:bg-kiwi-600 disabled:bg-kiwi/50",
  secondary:
    "bg-white text-seed ring-2 ring-border hover:ring-kiwi-300 hover:bg-kiwi-50 disabled:opacity-50",
  ghost: "bg-transparent text-seed/70 hover:bg-ink-100/70 disabled:opacity-40",
  danger: "bg-danger text-white shadow-pop hover:bg-pop-dark disabled:bg-danger/50",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[40px] px-4 text-body-sm rounded-2xl gap-1.5",
  md: "min-h-[48px] px-5 text-body rounded-2xl gap-2",
  lg: "min-h-[54px] px-6 text-base font-bold rounded-2xl gap-2.5",
};

function Spinner() {
  return (
    <svg className="h-[1.15em] w-[1.15em] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={disabled || loading ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        disabled={disabled || loading}
        className={[
          "relative inline-flex select-none items-center justify-center font-bold tracking-tight",
          "transition-colors duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          "disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...(rest as HTMLMotionProps<"button">)}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        )}
        <span
          className={[
            "inline-flex items-center justify-center gap-[inherit]",
            loading ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
