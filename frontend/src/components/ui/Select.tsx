// Select — 라벨/헬퍼/에러 + 커스텀 chevron. 네이티브 select 기반(모바일 친화).
import {
  forwardRef,
  useId,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helper, error, id, className = "", children, ...rest }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    const invalid = Boolean(error);

    return (
      <div className="block">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-caption font-bold uppercase tracking-wide text-seed/50"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={invalid || undefined}
            className={[
              "w-full appearance-none rounded-2xl border-2 bg-cream/70 py-3.5 pl-4 pr-11",
              "text-base text-seed shadow-inner-soft transition",
              "focus:bg-surface focus:outline-none",
              invalid
                ? "border-danger/60 focus:border-danger"
                : "border-transparent focus:border-kiwi",
              className,
            ].join(" ")}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            size={20}
            className="pointer-events-none absolute inset-y-0 right-3.5 my-auto text-seed/40"
            aria-hidden="true"
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-caption font-semibold text-danger">{error}</p>
        ) : helper ? (
          <p className="mt-1.5 text-caption text-seed/45">{helper}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
