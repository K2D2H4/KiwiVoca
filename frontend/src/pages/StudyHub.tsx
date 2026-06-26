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
  // 단어 덱 / 문법 덱 분리 — 한 화면에 섞여 잘못된 세션으로 빠지는 것 방지
  const vocabDecks = useMemo(
    () => (decks ?? []).filter((d) => d.kind !== "grammar"),
    [decks]
  );
  const grammarDecks = useMemo(
    () => (decks ?? []).filter((d) => d.kind === "grammar"),
    [decks]
  );
  // 선택된 덱 id 집합(멀티선택) — vocab/grammar 각각 독립 집합으로 절대 안 섞임
  const [vocabSel, setVocabSel] = useState<Set<string>>(new Set());
  const [grammarSel, setGrammarSel] = useState<Set<string>>(new Set());
  // 전화 연습 모드: 켜면 단어 덱 탭 시 단일 덱으로 /call 이동(선택과 무관)
  const [callMode, setCallMode] = useState(false);
  // 진행 시트: 모드 → 옵션 (단어 학습 전용)
  const [modeOpen, setModeOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pickedMode, setPickedMode] = useState<StudyMode | null>(null);

  const hasDecks = decks && decks.length > 0;

  // 단어: 선택된 덱들의 합산 카드 수 — 모드별 최소 카드 판정에 사용
  const vocabSelIds = useMemo(() => Array.from(vocabSel), [vocabSel]);
  const grammarSelIds = useMemo(() => Array.from(grammarSel), [grammarSel]);
  const selectedCardCount = useMemo(
    () =>
      vocabDecks
        .filter((d) => vocabSel.has(String(d.id)))
        .reduce((sum, d) => sum + (d.card_count ?? 0), 0),
    [vocabDecks, vocabSel]
  );

  // 옵션 시트용 summary(완료/미완료) — 선택된 단어 덱 기준
  const { data: summary, isLoading: summaryLoading } =
    useStudySummary(vocabSelIds);

  // 단어 덱 탭 — 전화 모드면 /call, 아니면 멀티선택 토글
  const toggleVocabDeck = (deck: Deck) => {
    if (callMode) {
      navigate(`/call/${deck.id}`);
      return;
    }
    setVocabSel((prev) => {
      const next = new Set(prev);
      const key = String(deck.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 문법 덱 탭 — 멀티선택 토글(문법 연습으로 진입)
  const toggleGrammarDeck = (deck: Deck) => {
    setGrammarSel((prev) => {
      const next = new Set(prev);
      const key = String(deck.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startStudy = (opts: { scope: StudyScope; limit: number }) => {
    if (!pickedMode || vocabSelIds.length === 0) return;
    const search = new URLSearchParams({
      decks: vocabSelIds.join(","),
      mode: pickedMode,
      scope: opts.scope,
      limit: String(opts.limit),
    });
    navigate(`/study/play?${search.toString()}`);
  };

  // 문법 연습 진입 — 선택된 문법 덱(들)을 /grammar/practice로
  const startGrammar = () => {
    if (grammarSelIds.length === 0) return;
    navigate(`/grammar/practice?decks=${grammarSelIds.join(",")}`);
  };

  const vocabCount = vocabSel.size;
  const grammarCount = grammarSel.size;

  return (
    <div className="bg-orchard min-h-[100dvh] md:min-h-0">
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

      <div className="mx-auto w-full max-w-screen-md px-5 pt-5 pb-28 md:pb-6">
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
                setVocabSel(new Set()); // 모드 전환 시 선택 초기화
                setGrammarSel(new Set());
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
                  callMode ? "bg-white/20 text-white" : "bg-bark/12 text-bark"
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

            {/* 단어 학습 — 멀티선택 → 게임 (전화 모드면 탭 시 /call) */}
            {vocabDecks.length > 0 && (
              <section>
                <p className="mb-3 px-1 text-caption font-bold uppercase tracking-wide text-seed/45">
                  {callMode ? t("call.pickDeck") : t("study.sectionVocab")}
                </p>
                <motion.ul
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {vocabDecks.map((deck) => (
                    <motion.li key={deck.id} variants={staggerItem}>
                      <DeckRow
                        deck={deck}
                        kindVariant="vocab"
                        callMode={callMode}
                        selected={vocabSel.has(String(deck.id))}
                        onToggle={() => toggleVocabDeck(deck)}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            )}

            {/* 문법 연습 — 멀티선택 → /grammar/practice (단어 게임 세션에 절대 안 섞임) */}
            {grammarDecks.length > 0 && (
              <section className={vocabDecks.length > 0 ? "mt-7" : ""}>
                <p className="mb-1 px-1 text-caption font-bold uppercase tracking-wide text-seed/45">
                  {t("study.sectionGrammar")}
                </p>
                <p className="mb-3 px-1 text-caption text-seed/40">
                  {t("study.sectionGrammarHint")}
                </p>
                <motion.ul
                  variants={staggerParent}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {grammarDecks.map((deck) => (
                    <motion.li key={deck.id} variants={staggerItem}>
                      <DeckRow
                        deck={deck}
                        kindVariant="grammar"
                        callMode={false}
                        selected={grammarSel.has(String(deck.id))}
                        onToggle={() => toggleGrammarDeck(deck)}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            )}
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

      {/* 선택 시 떠오르는 시작 바.
          모바일: viewport 하단 고정(탭바 위 · safe-area, 엄지 접근성).
          데스크탑(md+): fixed 해제 → 콘텐츠 흐름 안 sticky 패널(덱 섹션 바로 아래)로
          자연스럽게 배치(빈 화면에 동떨어진 버튼 방지). */}
      <AnimatePresence>
        {!callMode && (vocabCount > 0 || grammarCount > 0) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-raised px-5 md:sticky md:inset-x-auto md:bottom-5 md:px-0 md:pb-2"
          >
            <div className="mx-auto w-full max-w-screen-md space-y-2.5 md:rounded-3xl md:bg-surface/85 md:p-3 md:shadow-soft md:ring-1 md:ring-border md:backdrop-blur-md">
              {grammarCount > 0 && (
                <Button
                  variant={vocabCount > 0 ? "secondary" : "primary"}
                  size="lg"
                  fullWidth
                  className={vocabCount > 0 ? undefined : "cta-orchard-ring"}
                  leftIcon={<GraduationCap size={20} strokeWidth={2.4} />}
                  onClick={startGrammar}
                >
                  {t("study.startGrammarPractice", { count: grammarCount })}
                </Button>
              )}
              {vocabCount > 0 && (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="cta-orchard-ring"
                  leftIcon={<Play size={20} fill="currentColor" />}
                  onClick={() => setModeOpen(true)}
                >
                  {t("study.startWithSelected", { count: vocabCount })}
                </Button>
              )}
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

// ── 덱 행 — 단어/문법 공용. 단어는 멀티선택(또는 전화 진입), 문법은 멀티선택 ──
function DeckRow({
  deck,
  kindVariant,
  callMode,
  selected,
  onToggle,
}: {
  deck: Deck;
  kindVariant: "vocab" | "grammar";
  callMode: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const isGrammar = kindVariant === "grammar";
  // 문법 덱은 grammar_count(문법 N개), 단어 덱은 card_count(카드 N개)
  const deckCount = isGrammar
    ? deck.grammar_count ?? 0
    : deck.card_count ?? 0;

  return (
    <Card
      role={callMode ? "button" : "checkbox"}
      aria-checked={callMode ? undefined : selected}
      tabIndex={0}
      interactive
      padding="sm"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`flex items-center gap-3.5 transition ${
        selected
          ? "ring-2 ring-kiwi shadow-kiwi-glow"
          : callMode
            ? "ring-2 ring-kiwi-300"
            : ""
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          selected
            ? "bg-kiwi text-white"
            : isGrammar
              ? "bg-info-soft text-info"
              : "bg-kiwi-100 text-kiwi-700"
        }`}
      >
        {isGrammar ? (
          <GraduationCap size={22} strokeWidth={2.2} />
        ) : (
          <Layers size={22} strokeWidth={2.2} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-seed">
          {deck.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={isGrammar ? "neutral" : "kiwi"} size="sm">
            {isGrammar
              ? t("grammar.itemCount", { count: deckCount })
              : t("deck.cardCount", { count: deckCount })}
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
            selected
              ? "border-kiwi bg-kiwi text-white"
              : "border-ink-200 bg-surface text-transparent"
          }`}
        >
          <Check size={16} strokeWidth={3} />
        </span>
      )}
    </Card>
  );
}
