// Toast — 전역 토스트 시스템. ToastProvider + useToast() 훅.
// 성공/에러/정보 톤, 자동 닫힘, 상단 중앙 스택(모바일 safe-area 대응).
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Info, TriangleAlert } from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLE: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: { ring: "ring-kiwi-200", icon: <Check size={18} className="text-kiwi-600" /> },
  error: { ring: "ring-danger/30", icon: <X size={18} className="text-danger" /> },
  info: { ring: "ring-info/30", icon: <Info size={18} className="text-info" /> },
  warning: { ring: "ring-warning/40", icon: <TriangleAlert size={18} className="text-warning" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => remove(id), 3200);
    },
    [remove]
  );

  // 안정적인 컨텍스트 값 — 매 렌더 새 객체면 useEffect 의존성으로 쓸 때 무한 루프
  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* 토스트 스택 — 상단 중앙 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-toast flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={[
                "pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl bg-surface px-4 py-3 shadow-lg ring-1",
                TONE_STYLE[t.tone].ring,
              ].join(" ")}
              role="status"
            >
              <span className="shrink-0">{TONE_STYLE[t.tone].icon}</span>
              <span className="min-w-0 flex-1 text-body-sm font-semibold text-seed">
                {t.message}
              </span>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => remove(t.id)}
                className="-mr-1 shrink-0 rounded-full p-1 text-seed/35 transition hover:bg-ink-100 active:scale-90"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
