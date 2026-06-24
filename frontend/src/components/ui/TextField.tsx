// TextField — 라벨/헬퍼/에러/포커스링. 모바일 줌 방지(text-base), 터치 타겟 ≥48px.
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, helper, error, leftIcon, rightSlot, id, className = "", ...rest },
    ref
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const invalid = Boolean(error);

    return (
      <div className="block">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-caption font-bold uppercase tracking-wide text-seed/50"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-seed/35">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={invalid || undefined}
            aria-describedby={
              error ? `${inputId}-err` : helper ? `${inputId}-help` : undefined
            }
            className={[
              "w-full rounded-2xl border-2 bg-cream/70 py-3.5 text-base text-seed",
              "placeholder:text-seed/30 shadow-inner-soft transition",
              "focus:bg-surface focus:outline-none",
              leftIcon ? "pl-11" : "pl-4",
              rightSlot ? "pr-12" : "pr-4",
              invalid
                ? "border-danger/60 focus:border-danger"
                : "border-transparent focus:border-kiwi",
              className,
            ].join(" ")}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute inset-y-0 right-2 flex items-center">
              {rightSlot}
            </span>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-err`} className="mt-1.5 text-caption font-semibold text-danger">
            {error}
          </p>
        ) : helper ? (
          <p id={`${inputId}-help`} className="mt-1.5 text-caption text-seed/45">
            {helper}
          </p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = "TextField";
export default TextField;
