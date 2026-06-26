// 언어 전환기 — 컴팩트 "글로브 알약" 트리거 → 언어 목록(모바일 바텀시트 / 데스크탑 앵커드 팝오버).
// N개 언어 확장 대비: 트리거 길이 고정(현재 언어만), 목록은 스크롤 가능. i18n.changeLanguage 호출.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Check, ChevronDown } from "lucide-react";
import { SUPPORTED_LANGS, LANG_LABELS, type SupportedLang } from "../i18n";
import Sheet from "./ui/Sheet";

type Variant = "onColor" | "surface" | "field";

interface LanguageSwitcherProps {
  /**
   * onColor: 녹색 헤더/히어로용(반투명 흰 알약) · surface: 밝은 배경용(크림 알약)
   * field: 설정 행용(풀폭 select 느낌)
   */
  variant?: Variant;
}

export default function LanguageSwitcher({
  variant = "onColor",
}: LanguageSwitcherProps) {
  // 사이드바 트리거는 화면 하단에 앵커되므로 데스크탑 팝오버를 위로 연다.
  const openUp = variant === "surface";
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 'ko-KR' 같은 지역 코드도 base로 매칭
  const current = (i18n.resolvedLanguage || i18n.language || "ko").split(
    "-"
  )[0] as SupportedLang;

  const select = (lng: SupportedLang) => {
    i18n.changeLanguage(lng);
    setOpen(false);
  };

  // 데스크탑 팝오버: 외부 클릭 / ESC 닫힘 (모바일 Sheet는 자체 처리)
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ── 트리거 스타일 (배경별) ──
  const triggerByVariant: Record<Variant, string> = {
    onColor:
      "bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/25",
    surface:
      "bg-cream text-seed ring-1 ring-border hover:bg-kiwi-50 hover:text-kiwi-700",
    field:
      "w-full justify-between bg-cream/70 text-seed ring-1 ring-border hover:border-kiwi",
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common.language")}
        className={[
          "flex min-h-[44px] items-center gap-2 rounded-full px-3.5 py-2",
          "text-body-sm font-bold transition active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-300",
          variant === "field" ? "rounded-2xl" : "",
          triggerByVariant[variant],
        ].join(" ")}
      >
        <Globe size={18} strokeWidth={2.3} className="shrink-0" />
        <span className="max-w-[5.5rem] truncate">{LANG_LABELS[current]}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className={variant === "field" ? "ml-auto" : ""}
        >
          <ChevronDown size={16} strokeWidth={2.4} className="shrink-0 opacity-70" />
        </motion.span>
      </button>

      {/* ===== 모바일: 바텀시트 (탭바 LangMini와 동일 룩) ===== */}
      <div className="md:hidden">
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={t("common.language")}
        >
          <ul role="listbox" aria-label={t("common.language")} className="grid gap-2 pt-1">
            {SUPPORTED_LANGS.map((lng) => (
              <LangRow
                key={lng}
                lng={lng}
                active={current === lng}
                onSelect={() => select(lng)}
              />
            ))}
          </ul>
        </Sheet>
      </div>

      {/* ===== 데스크탑: 앵커드 팝오버 ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            role="listbox"
            aria-label={t("common.language")}
            className={[
              "absolute z-overlay hidden w-48 max-w-[14rem] overflow-hidden md:block",
              "max-h-72 overflow-y-auto rounded-3xl border border-border bg-surface p-1.5 shadow-lg",
              openUp ? "bottom-full mb-2" : "mt-2",
              variant === "field" ? "left-0 right-0 w-auto" : "right-0",
            ].join(" ")}
          >
            <ul className="grid gap-1">
              {SUPPORTED_LANGS.map((lng) => (
                <LangRow
                  key={lng}
                  lng={lng}
                  active={current === lng}
                  onSelect={() => select(lng)}
                  compact
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 언어 항목 행 (시트=넉넉 / 팝오버=compact) ──
function LangRow({
  lng,
  active,
  onSelect,
  compact = false,
}: {
  lng: SupportedLang;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onSelect}
        className={[
          "flex w-full items-center justify-between rounded-2xl text-left transition active:scale-[0.98]",
          compact ? "px-3 py-2.5 text-body-sm" : "min-h-[52px] px-4 text-body",
          "font-bold",
          active
            ? "bg-kiwi text-white shadow-kiwi-glow"
            : "text-seed/75 hover:bg-kiwi-50 hover:text-kiwi-700",
        ].join(" ")}
      >
        <span className="truncate">{LANG_LABELS[lng]}</span>
        {active && <Check size={compact ? 16 : 20} strokeWidth={2.6} className="shrink-0" />}
      </button>
    </li>
  );
}
