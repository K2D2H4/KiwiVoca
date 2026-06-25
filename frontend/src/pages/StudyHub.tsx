// 학습 허브 — 덱 멀티선택 → 모드 선택 → 옵션(범위/개수) → 학습 세션. Orchard Pop 디자인.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Check, GraduationCap, Phone, Play } from "lucide-react";
import { Card, Badge, Skeleton, EmptyState, Button } from "../components/ui";
import ModeSheet from "../components/study/ModeSheet";
import StudyOptionsSheet from "../components/study/StudyOptionsSheet";
import { useDecks } from "../hooks/useDecks";
import { useStudySummary } from "../hooks/useStudy";
import { langLabel } from "../lib/languages";
import { staggerParent, staggerItem } from "../lib/motion";
import type { Deck } from "../types/deck";
import type { StudyMode, StudyScope } from "../types/study";

export default function StudyHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: decks, isLoading } = useDecks();
  // 선택된 덱 id 집합(멀티선택)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 전화 연습 모드: 켜면 덱 탭 시 단일 덱으로 /call 이동(선택과 무관)
  const [callMode, setCallMode] = useState(false);
  // 진행 시트: 모드 → 옵션
  const [modeOpen, setModeOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pickedMode, setPickedMode] = useState<StudyMode | null>(null);

  const hasDecks = decks && decks.length > 0;

  // 선택된 덱들의 합산 카드 수 — 모드별 최소 카드 판정에 사용
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedCardCount = useMemo(() => {
    if (!decks) return 0;
    return decks
      .filter((d) => selected.has(String(d.id)))
      .reduce((sum, d) => sum + (d.card_count ?? 0), 0);
  }, [decks, selected]);

  // 옵션 시트용 summary(완료/미완료) — 선택된 덱 기준, 시트 열렸을 때만 의미
  const { data: summary, isLoading: summaryLoading } =
    useStudySummary(selectedIds);

  const toggleDeck = (deck: Deck) => {
    if (callMode) {
      navigate(`/call/${deck.id}`);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(deck.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startStudy = (opts: { scope: StudyScope; limit: number }) => {
    if (!pickedMode || selectedIds.length === 0) return;
    const search = new URLSearchParams({
      decks: selectedIds.join(","),
      mode: pickedMode,
      scope: opts.scope,
      limit: String(opts.limit),
    });
    navigate(`/study/play?${search.toString()}`);
  };

  const selectedCount = selected.size;

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

      <div className="mx-auto w-full max-w-screen-md px-5 pt-5 pb-28">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-3xl" />
            ))}
          </div>
        ) : hasDecks ? (
          <>
            {/* AI 전화 연습 진입 — 토글 배너 */}
            <button
              type="button"
              onClick={() => {
                setCallMode((v) => !v);
                setSelected(new Set()); // 모드 전환 시 선택 초기화
              }}
              aria-pressed={callMode}
              className={`mb-4 flex w-full items-center gap-3.5 rounded-3xl p-4 text-left transition-all ${
                callMode
                  ? "bg-kiwi text-white shadow-kiwi-glow"
                  : "bg-surface text-seed shadow-sm ring-1 ring-border hover:ring-kiwi-300"
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  callMode ? "bg-white/20 text-white" : "bg-pop-soft text-pop-dark"
                }`}
              >
                <Phone size={22} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold">
                  {t("call.entryTitle")}
                </span>
                <span
                  className={`mt-0.5 block text-body-sm ${
                    callMode ? "text-white/80" : "text-seed/60"
                  }`}
                >
                  {callMode ? t("call.entryActive") : t("call.entrySubtitle")}
                </span>
              </span>
            </button>

            <p className="mb-3 px-1 text-caption font-bold uppercase tracking-wide text-seed/45">
              {callMode ? t("call.pickDeck") : t("study.pickDecks")}
            </p>
            <motion.ul
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {decks.map((deck) => {
                const isSelected = selected.has(String(deck.id));
                return (
                  <motion.li key={deck.id} variants={staggerItem}>
                    <Card
                      role={callMode ? "button" : "checkbox"}
                      aria-checked={callMode ? undefined : isSelected}
                      tabIndex={0}
                      interactive
                      padding="sm"
                      onClick={() => toggleDeck(deck)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDeck(deck);
                        }
                      }}
                      className={`flex items-center gap-3.5 transition ${
                        isSelected
                          ? "ring-2 ring-kiwi shadow-kiwi-glow"
                          : callMode
                            ? "ring-2 ring-kiwi-300"
                            : ""
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                          isSelected
                            ? "bg-kiwi text-white"
                            : "bg-kiwi-100 text-kiwi-700"
                        }`}
                      >
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
                      {callMode ? (
                        <Phone
                          size={20}
                          strokeWidth={2.4}
                          className="shrink-0 text-kiwi-600"
                          aria-hidden="true"
                        />
                      ) : (
                        // 선택 체크 박스 — 멀티선택 표시
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            isSelected
                              ? "border-kiwi bg-kiwi text-white"
                              : "border-ink-200 bg-surface text-transparent"
                          }`}
                        >
                          <Check size={16} strokeWidth={3} />
                        </span>
                      )}
                    </Card>
                  </motion.li>
                );
              })}
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

      {/* 선택 시 떠오르는 하단 학습 시작 바 (탭바 위 · safe-area) */}
      <AnimatePresence>
        {!callMode && selectedCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-raised px-5"
          >
            <div className="mx-auto w-full max-w-screen-md">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                leftIcon={<Play size={20} fill="currentColor" />}
                onClick={() => setModeOpen(true)}
              >
                {t("study.startWithSelected", { count: selectedCount })}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 모드 선택 시트 → 옵션 시트로 연결 */}
      <ModeSheet
        open={modeOpen}
        cardCount={selectedCardCount}
        onClose={() => setModeOpen(false)}
        onPick={(mode) => {
          setPickedMode(mode);
          setModeOpen(false);
          setOptionsOpen(true);
        }}
      />

      {/* 범위·개수 옵션 시트 → 학습 시작 */}
      <StudyOptionsSheet
        open={optionsOpen}
        summary={summary}
        summaryLoading={summaryLoading}
        onClose={() => setOptionsOpen(false)}
        onStart={startStudy}
      />
    </div>
  );
}
