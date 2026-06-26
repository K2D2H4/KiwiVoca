// 앱 셸 — 모바일: 하단 탭바 + 중앙 강조 FAB / 데스크탑(md:): 좌측 사이드바.
// 보호 라우트들을 이 셸로 감싼다. 본문 하단 패딩으로 탭바 가림 방지.
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Home,
  Layers,
  Plus,
  User,
  Languages,
  BarChart3,
  Compass,
  type LucideIcon,
} from "lucide-react";
import LogoWordmark from "../LogoWordmark";
import LanguageSwitcher from "../LanguageSwitcher";
import ThemeToggle from "../ThemeToggle";
import Avatar from "../ui/Avatar";
import Sheet from "../ui/Sheet";
import CreateSheet from "./CreateSheet";
import { SUPPORTED_LANGS, LANG_LABELS, type SupportedLang } from "../../i18n";
import { useAuthStore } from "../../store/authStore";

interface TabDef {
  key: "home" | "study" | "explore" | "stats" | "profile";
  to: string;
  icon: LucideIcon;
}

// 모바일 탭바 탭 (중앙 FAB 좌우 4칸). stats 는 데스크탑 사이드바 전용.
const TABS: TabDef[] = [
  { key: "home", to: "/", icon: Home },
  { key: "study", to: "/study", icon: Layers },
  { key: "profile", to: "/profile", icon: User },
];

// 데스크탑 사이드바 네비 (모바일보다 한 칸 더 — 통계 포함)
const SIDEBAR_TABS: TabDef[] = [
  { key: "home", to: "/", icon: Home },
  { key: "study", to: "/study", icon: Layers },
  { key: "explore", to: "/explore", icon: Compass },
  { key: "stats", to: "/stats", icon: BarChart3 },
  { key: "profile", to: "/profile", icon: User },
];

export default function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const name = user?.display_name || user?.email?.split("@")[0] || "Kiwi";

  // 통합 만들기 시트 — FAB/사이드바 "만들기" 공용
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-cream no-x md:flex md:h-[100dvh] md:overflow-hidden">
      {/* ===== 데스크탑 좌측 사이드바 ===== */}
      <aside className="hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-8 flex items-center px-2 text-left transition active:scale-95"
          aria-label={t("app.name")}
        >
          <LogoWordmark height={86} />
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {/* 일반 탭 */}
          {SIDEBAR_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-body-sm font-bold transition active:scale-[0.98]",
                    isActive
                      ? "bg-kiwi-100 text-kiwi-700"
                      : "text-seed/55 hover:bg-cream hover:text-seed",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
                    <span>{t(`nav.${tab.key}`)}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* 만들기 — 통합 진입(단어/문법 × 직접/사진/AI). 사이드바에서는 강조 버튼 */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-2 flex items-center gap-3 rounded-2xl bg-kiwi px-3.5 py-3 text-body-sm font-bold text-white shadow-kiwi-glow transition active:scale-[0.98] hover:bg-kiwi-600"
          >
            <Plus size={22} strokeWidth={2.6} />
            <span>{t("create.title")}</span>
          </button>
        </nav>

        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex justify-center px-1">
            <ThemeToggle variant="compact" />
          </div>
          <div className="mb-3 px-1">
            <LanguageSwitcher variant="surface" />
          </div>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-cream active:scale-[0.98]"
          >
            <Avatar name={name} size={38} />
            <span className="min-w-0 flex-1 truncate text-body-sm font-bold text-seed">
              {name}
            </span>
          </button>
        </div>
      </aside>

      {/* ===== 본문 ===== */}
      <div className="min-w-0 flex-1 md:h-[100dvh] md:overflow-y-auto">
        <main className="mx-auto w-full max-w-screen-md pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:max-w-screen-lg md:pb-12">
          <Outlet />
        </main>
      </div>

      {/* ===== 모바일 하단 탭바 + 중앙 FAB ===== */}
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-nav md:hidden"
      >
        {/* 탭바 본체 */}
        <div className="border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <ul className="mx-auto grid max-w-screen-sm grid-cols-[1fr_1fr_72px_1fr_1fr] items-stretch">
            <TabItem tab={TABS[0]} />
            <TabItem tab={TABS[1]} />
            {/* FAB 자리 비움 (포인터 통과) */}
            <li aria-hidden="true" className="pointer-events-none" />
            <TabItem tab={TABS[2]} />
            {/* 5번째 칸: 언어 토글 미니 */}
            <li className="flex items-center justify-center">
              <LangMini />
            </li>
          </ul>
        </div>

        {/* 중앙 FAB — 통합 만들기 시트 토글 (마지막 렌더 = 최상단) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-raised flex -translate-y-1/2 justify-center">
          <motion.button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label={t("create.title")}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className={[
              "pointer-events-auto flex items-center justify-center rounded-full text-white outline-none ring-4 ring-cream",
              "focus-visible:ring-kiwi-300",
              createOpen
                ? "bg-kiwi-600 shadow-kiwi-glow"
                : "bg-kiwi shadow-kiwi-glow",
            ].join(" ")}
            style={{ height: 60, width: 60 }}
          >
            <motion.span
              animate={{ rotate: createOpen ? 135 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              <Plus size={28} strokeWidth={2.8} />
            </motion.span>
          </motion.button>
        </div>
      </nav>

      {/* 통합 만들기 시트 (모바일 FAB + 데스크탑 사이드바 공용) */}
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// --- 탭 아이템 (활성 알약 인디케이터) ---
function TabItem({ tab }: { tab: TabDef }) {
  const { t } = useTranslation();
  const Icon = tab.icon;
  return (
    <li>
      <NavLink
        to={tab.to}
        end={tab.to === "/"}
        className={({ isActive }) =>
          [
            "relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-2 transition active:scale-90",
            isActive ? "text-kiwi-700" : "text-seed/40",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                className="absolute top-1.5 h-9 w-12 rounded-full bg-kiwi-100"
              />
            )}
            <span className="relative z-raised">
              <Icon size={23} strokeWidth={isActive ? 2.6 : 2} />
            </span>
            <span
              className={[
                "relative z-raised text-[10px] tracking-tight",
                isActive ? "font-extrabold" : "font-semibold",
              ].join(" ")}
            >
              {t(`nav.${tab.key}`)}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}

// --- 탭바 우측 미니 언어 토글 (현재 언어 한 글자) ---
function LangMini() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (i18n.resolvedLanguage || i18n.language || "ko").split(
    "-"
  )[0] as SupportedLang;

  return (
    <>
      <button
        type="button"
        aria-label={t("common.language")}
        onClick={() => setOpen(true)}
        className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-seed/40 transition active:scale-90"
      >
        <Languages size={23} strokeWidth={2} />
        <span className="text-[10px] font-semibold tracking-tight">
          {LANG_LABELS[current]}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("common.language")}>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {SUPPORTED_LANGS.map((lng) => {
            const active = current === lng;
            return (
              <button
                key={lng}
                type="button"
                onClick={() => {
                  i18n.changeLanguage(lng);
                  setOpen(false);
                }}
                className={[
                  "min-h-[52px] rounded-2xl text-body font-bold transition active:scale-95",
                  active
                    ? "bg-kiwi text-white shadow-kiwi-glow"
                    : "bg-cream text-seed/70 ring-1 ring-border hover:bg-kiwi-50",
                ].join(" ")}
              >
                {LANG_LABELS[lng]}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
