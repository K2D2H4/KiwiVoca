// 학습 허브 — 덱 선택 → 모드 선택 시트 → 학습 세션. Orchard Pop 디자인 시스템.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Layers, ChevronRight, GraduationCap } from "lucide-react";
import { Card, Badge, Skeleton, EmptyState, Button } from "../components/ui";
import ModeSheet from "../components/study/ModeSheet";
import { useDecks } from "../hooks/useDecks";
import { langLabel } from "../lib/languages";
import { staggerParent, staggerItem } from "../lib/motion";
import type { Deck } from "../types/deck";

export default function StudyHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: decks, isLoading } = useDecks();
  const [picked, setPicked] = useState<Deck | null>(null);

  const hasDecks = decks && decks.length > 0;

  return (
    <div className="bg-orchard min-h-[100dvh]">
      {/* 그린 헤더 */}
      <header className="seed-dots bg-kiwi px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-screen-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-caption font-bold text-white">
            <GraduationCap size={14} strokeWidth={2.4} />
            {t("study.kicker")}
          </span>
          <h1 className="mt-3 text-h1 font-display font-bold text-white">
            {t("study.title")}
          </h1>
          <p className="mt-1 text-body-sm text-white/85">
            {t("study.subtitle")}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-screen-md px-5 pt-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-3xl" />
            ))}
          </div>
        ) : hasDecks ? (
          <>
            <p className="mb-3 px-1 text-caption font-bold uppercase tracking-wide text-seed/45">
              {t("study.pickDeck")}
            </p>
            <motion.ul
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {decks.map((deck) => (
                <motion.li key={deck.id} variants={staggerItem}>
                  <Card
                    role="button"
                    tabIndex={0}
                    interactive
                    padding="sm"
                    onClick={() => setPicked(deck)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPicked(deck);
                      }
                    }}
                    className="flex items-center gap-3.5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700">
                      <Layers size={22} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-seed">
                        {deck.title}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="kiwi" size="sm">
                          {t("deck.cardCount", { count: deck.card_count ?? 0 })}
                        </Badge>
                        <Badge tone="outline" size="sm">
                          {langLabel(deck.lang_term)} → {langLabel(deck.lang_def)}
                        </Badge>
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      strokeWidth={2.4}
                      className="shrink-0 text-ink-300"
                      aria-hidden="true"
                    />
                  </Card>
                </motion.li>
              ))}
            </motion.ul>
          </>
        ) : (
          <Card padding="lg">
            <EmptyState
              mood="sleepy"
              title={t("study.emptyTitle")}
              description={t("study.empty")}
              action={
                <Button fullWidth size="lg" onClick={() => navigate("/decks/new")}>
                  {t("deck.createFirst")}
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {/* 모드 선택 시트 */}
      <ModeSheet
        open={picked !== null}
        cardCount={picked?.card_count ?? 0}
        onClose={() => setPicked(null)}
        onPick={(mode) => {
          if (picked) navigate(`/study/${picked.id}/${mode}`);
          setPicked(null);
        }}
      />
    </div>
  );
}
