// 프로필 — 내 정보 + 통계 + 언어 설정 + 로그아웃 + 앱 정보. Orchard Pop 디자인 시스템.
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Layers,
  BookText,
  Languages,
  LogOut,
  Sparkles,
  Palette,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";
import { Avatar, Card, Skeleton, Button } from "../components/ui";
import { useAuthStore } from "../store/authStore";
import { useDecks } from "../hooks/useDecks";
import { staggerParent, staggerItem } from "../lib/motion";

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const name = user?.display_name || user?.email?.split("@")[0] || "Kiwi";

  const { data: decks, isLoading } = useDecks();
  const deckCount = decks?.length ?? 0;
  const cardCount =
    decks?.reduce((sum, d) => sum + (d.card_count ?? 0), 0) ?? 0;

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="bg-orchard min-h-[100dvh]">
      {/* 그린 헤더 + 아바타 */}
      <header className="seed-dots bg-kiwi px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-screen-md flex-col items-center text-center">
          <div className="rounded-full bg-white/25 p-1 shadow-lg">
            <Avatar name={name} size={84} className="ring-4 ring-white/30" />
          </div>
          <h1 className="mt-3 text-h2 font-display font-bold text-white">
            {name}
          </h1>
          {user?.email && (
            <p className="mt-0.5 text-body-sm text-white/80">{user.email}</p>
          )}
        </div>
      </header>

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="mx-auto -mt-7 w-full max-w-screen-md space-y-4 px-5 pb-4"
      >
        {/* 통계 */}
        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Layers size={18} strokeWidth={2.3} />}
            value={isLoading ? null : deckCount}
            label={t("profile.statDecks")}
          />
          <StatCard
            icon={<BookText size={18} strokeWidth={2.3} />}
            value={isLoading ? null : cardCount}
            label={t("profile.statCards")}
          />
        </motion.div>

        {/* 내 통계 — /stats 진입 */}
        <motion.div variants={staggerItem}>
          <button
            type="button"
            onClick={() => navigate("/stats")}
            className="group block w-full rounded-3xl text-left outline-none focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <Card interactive padding="md">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pop-soft text-pop-dark">
                  <BarChart3 size={18} strokeWidth={2.3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold text-seed">
                    {t("stats.myStats")}
                  </p>
                  <p className="truncate text-caption text-seed/50">
                    {t("stats.myStatsHint")}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-seed/25 transition group-hover:translate-x-0.5 group-hover:text-seed/45"
                />
              </div>
            </Card>
          </button>
        </motion.div>

        {/* 테마 설정 */}
        <motion.div variants={staggerItem}>
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700">
                <Palette size={18} strokeWidth={2.3} />
              </span>
              <p className="text-body font-bold text-seed">{t("theme.label")}</p>
            </div>
            <ThemeToggle variant="full" />
          </Card>
        </motion.div>

        {/* 언어 설정 */}
        <motion.div variants={staggerItem}>
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700">
                <Languages size={18} strokeWidth={2.3} />
              </span>
              <p className="text-body font-bold text-seed">
                {t("common.language")}
              </p>
            </div>
            <LanguageSwitcher />
          </Card>
        </motion.div>

        {/* 앱 정보 */}
        <motion.div variants={staggerItem}>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pop-soft text-pop-dark">
                <Sparkles size={18} strokeWidth={2.3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-bold text-seed">
                  {t("app.name")}
                </p>
                <p className="truncate text-caption text-seed/50">
                  {t("app.tagline")}
                </p>
              </div>
              <span className="shrink-0 text-caption font-bold text-ink-300">
                v1.0
              </span>
            </div>
          </Card>
        </motion.div>

        {/* 로그아웃 */}
        <motion.div variants={staggerItem}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            leftIcon={<LogOut size={18} strokeWidth={2.4} />}
            onClick={onLogout}
            className="text-pop-dark hover:bg-pop-soft hover:ring-pop/40"
          >
            {t("home.logout")}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | null;
  label: string;
}) {
  return (
    <Card padding="md">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700">
        {icon}
      </span>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-12" rounded="md" />
      ) : (
        <p className="mt-3 font-display text-h1 font-bold text-seed tabular-nums">
          {value}
        </p>
      )}
      <p className="mt-0.5 text-caption font-bold text-seed/50">{label}</p>
    </Card>
  );
}
