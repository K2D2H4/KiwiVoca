// 인증 화면 공통 셸 — 키위 그린 히어로 + 크림 카드.
// 모바일: 풀폭, 하단 둥근 카드(엄지 영역에 폼). 데스크탑: 중앙 정렬 카드.
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import KiwiBuddy from "../KiwiBuddy";
import LanguageSwitcher from "../LanguageSwitcher";
import LogoWordmark from "../LogoWordmark";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
}: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-kiwi no-x md:items-center md:justify-center md:bg-kiwi-600">
      {/* 데스크탑: 중앙 카드. 모바일: 전체 레이아웃 */}
      <div className="flex min-h-[100dvh] w-full flex-col md:min-h-0 md:max-w-md md:overflow-hidden md:rounded-4xl md:bg-kiwi md:shadow-xl">
        {/* ===== 상단 그린 히어로 ===== */}
        <div className="seed-dots relative px-6 pt-[max(1rem,env(safe-area-inset-top))]">
          {/* 코랄 글로우 블롭 (분위기) */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pop/25 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 top-16 h-28 w-28 rounded-full bg-white/15 blur-2xl" />

          <div className="relative mx-auto flex w-full max-w-md items-center justify-end pt-2">
            <LanguageSwitcher />
          </div>

          <div className="relative mx-auto mt-5 flex w-full max-w-md flex-col items-center pb-9 text-center">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-5"
            >
              <LogoWordmark onColor height={44} />
            </motion.div>
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="rounded-full bg-white/15 p-3 ring-1 ring-white/25"
            >
              <KiwiBuddy mood="happy" size={68} float />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="mt-4 font-display text-h1 font-bold leading-tight text-white"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.4 }}
              className="mt-1.5 text-body-sm text-white/85"
            >
              {subtitle}
            </motion.p>
          </div>
        </div>

        {/* ===== 하단 크림 카드 ===== */}
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 26 }}
          className="flex-1 rounded-t-4xl bg-cream px-6 pt-7 shadow-[0_-8px_24px_rgba(46,58,36,0.12)] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-none md:shadow-none"
        >
          <div className="mx-auto w-full max-w-md">{children}</div>
        </motion.div>
      </div>
    </main>
  );
}
