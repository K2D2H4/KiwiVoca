// Sheet — 모바일 바텀시트(드래그 핸들/드래그 닫기) · 데스크탑 중앙 모달.
// 백드롭 탭/ESC로 닫힘, 바디 스크롤 잠금, safe-area 대응.
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 닫기 버튼·드래그 닫기 비활성화 (필수 선택 등) */
  dismissible?: boolean;
  ariaLabel?: string;
}

export default function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  ariaLabel,
}: SheetProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-overlay flex items-end justify-center md:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel ?? title}
        >
          {/* 백드롭 */}
          <motion.button
            type="button"
            aria-label={t("common.close")}
            tabIndex={dismissible ? 0 : -1}
            onClick={() => dismissible && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-seed/40 backdrop-blur-sm"
          />

          {/* 시트 본문 */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag={dismissible ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (dismissible && (info.offset.y > 120 || info.velocity.y > 600)) {
                onClose();
              }
            }}
            className="relative max-h-[90dvh] w-full max-w-screen-sm overflow-y-auto rounded-t-4xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl md:max-h-[85dvh] md:w-auto md:max-w-md md:rounded-4xl md:pb-6"
          >
            {/* 그랩 핸들 (모바일) */}
            {dismissible && (
              <div className="mx-auto mb-4 h-1.5 w-11 shrink-0 rounded-full bg-ink-200 md:hidden" />
            )}
            {title && (
              <h2 className="mb-3 text-h3 font-bold text-seed">{title}</h2>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
