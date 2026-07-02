// 학습 결과 — 정답률 카운트업, 통계 stagger, 고득점 키위 셀레브레이션(transform 컨페티), 틀린 카드 + 재시도.
// 틀린 카드는 아코디언 — 펼치면 "내 답 vs 정답" 즉시 리뷰(퀴즈 모드에서 userAnswer 기록 시).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RotateCcw, Home, RefreshCw, Star, ChevronDown } from "lucide-react";
import KiwiBuddy, { type KiwiMood } from "../KiwiBuddy";
import { Card, Button } from "../ui";
import { useCountUp } from "../../hooks/useCountUp";
import { useSound } from "../../hooks/useSound";
import { spring, staggerParent, staggerItem } from "../../lib/motion";
import type { StudyCard, StudyOutcome } from "../../types/study";

interface StudyResultProps {
  outcomes: StudyOutcome[];
  cards: StudyCard[]; // 라운드에 쓰인 카드(틀린 카드 조회용)
  onRetryWrong?: (wrongCards: StudyCard[]) => void;
  onRestart: () => void;
  onHome: () => void;
}

export default function StudyResult({
  outcomes,
  cards,
  onRetryWrong,
  onRestart,
  onHome,
}: StudyResultProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const { play } = useSound();

  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const wrong = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const accCount = useCountUp(accuracy, 1.0, 0.35);

  const cardById = new Map(cards.map((c) => [String(c.id), c]));
  // 틀린 항목 — 카드 + 당시 내 답(퀴즈 모드에서만 기록됨)
  const wrongEntries = outcomes
    .filter((o) => !o.isCorrect)
    .map((o) => ({ outcome: o, card: cardById.get(String(o.cardId)) }))
    .filter((e): e is { outcome: StudyOutcome; card: StudyCard } =>
      Boolean(e.card)
    );
  const wrongCards = wrongEntries.map((e) => e.card);

  // 점수대별 키위 리액션
  const tier =
    accuracy >= 90 ? "perfect" : accuracy >= 60 ? "good" : "keepGoing";
  const mood: KiwiMood =
    tier === "perfect" ? "love" : tier === "good" ? "happy" : "neutral";
  const celebrate = accuracy >= 90;

  // 결과 화면 진입 시 마무리 효과음 1회 — 만점이면 셀레브레이션, 아니면 경쾌한 완료음
  const playedRef = useRef(false);
  useEffect(() => {
    if (playedRef.current) return; // StrictMode 중복 마운트 가드
    playedRef.current = true;
    play(celebrate ? "celebrate" : "complete");
  }, [celebrate, play]);

  return (
    <div className="bg-orchard relative flex h-[100dvh] flex-col overflow-hidden">
      {celebrate && !reduce && <Confetti />}

      {/* 스크롤 영역 — 통계 + (길어질 수 있는) 틀린 카드 목록. 하단 액션바에 가리지 않게 패딩. */}
      <div className="relative z-raised flex-1 overflow-y-auto px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-screen-sm">
        {/* 리액션 + 정답률 */}
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center"
        >
          <motion.div variants={staggerItem} className="relative">
            <motion.div
              animate={
                celebrate && !reduce
                  ? { rotate: [0, -8, 8, -5, 0], y: [0, -6, 0] }
                  : {}
              }
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <KiwiBuddy mood={mood} size={104} />
            </motion.div>
            {tier === "perfect" && (
              <motion.span
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...spring.gentle, delay: 0.5 }}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-warning text-white shadow-kiwi-glow"
              >
                <Star size={16} fill="currentColor" strokeWidth={0} />
              </motion.span>
            )}
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="mt-4 text-body-sm font-bold uppercase tracking-wide text-kiwi-700"
          >
            {t(`study.reaction.${tier}`)}
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="mt-1 flex items-end justify-center gap-1"
          >
            <span className="font-display text-[5rem] font-bold leading-none text-seed tabular-nums">
              {accCount}
            </span>
            <span className="mb-2 text-h1 font-bold text-seed/35">%</span>
          </motion.div>
          <motion.p
            variants={staggerItem}
            className="mt-1 text-caption font-bold text-seed/50"
          >
            {t("study.accuracy")}
          </motion.p>
        </motion.div>

        {/* 맞춘/틀린 */}
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-2 gap-3"
        >
          <motion.div variants={staggerItem}>
            <Card padding="md" className="text-center">
              <p className="font-display text-h1 font-bold text-kiwi-700 tabular-nums">
                {correct}
              </p>
              <p className="mt-1 text-caption font-bold text-seed/50">
                {t("study.correct")}
              </p>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card padding="md" className="text-center">
              <p className="font-display text-h1 font-bold text-pop-dark tabular-nums">
                {wrong}
              </p>
              <p className="mt-1 text-caption font-bold text-seed/50">
                {t("study.wrong")}
              </p>
            </Card>
          </motion.div>
        </motion.div>

        {/* 틀린 카드 목록 */}
        {wrongCards.length > 0 && (
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="mt-5"
          >
            <motion.p
              variants={staggerItem}
              className="mb-2 px-1 text-caption font-bold uppercase tracking-wide text-seed/40"
            >
              {t("study.wrongList")}
            </motion.p>
            <ul className="space-y-2">
              {wrongEntries.map(({ card: c, outcome }, i) => (
                <motion.li key={`${c.id}-${i}`} variants={staggerItem}>
                  <WrongCardRow card={c} outcome={outcome} />
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        </div>
      </div>

      {/* 액션바 — 화면 하단 고정. 스크롤과 무관하게 항상 보임(몰입형, 탭바 없음). */}
      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="relative z-raised border-t border-ink-100/70 bg-surface/85 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(46,58,36,0.07)] backdrop-blur-md"
      >
        <div className="mx-auto w-full max-w-screen-sm space-y-2.5">
          {wrongCards.length > 0 && onRetryWrong && (
            <motion.div variants={staggerItem}>
              <Button
                variant="danger"
                size="lg"
                fullWidth
                leftIcon={<RotateCcw size={18} strokeWidth={2.4} />}
                onClick={() => onRetryWrong(wrongCards)}
              >
                {t("study.retryWrong", { count: wrongCards.length })}
              </Button>
            </motion.div>
          )}
          {/* 보조 액션 — 다시 학습(재시도와 위계 구분) */}
          <motion.div variants={staggerItem}>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<RefreshCw size={18} strokeWidth={2.4} />}
              onClick={onRestart}
            >
              {t("study.restart")}
            </Button>
          </motion.div>
          {/* 메인 완료 CTA — 활성 primary(키위 그린)로 명확하게 */}
          <motion.div variants={staggerItem}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<Home size={18} strokeWidth={2.4} />}
              onClick={onHome}
            >
              {t("study.backHome")}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// 틀린 카드 행 — userAnswer 기록이 있으면 아코디언으로 "내 답 vs 정답" 즉시 리뷰
function WrongCardRow({
  card,
  outcome,
}: {
  card: StudyCard;
  outcome: StudyOutcome;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // 플래시카드/매칭은 답 기록이 없어 펼침 없이 기존 행 유지
  const expandable = outcome.userAnswer != null;

  const header = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full bg-pop" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-bold text-seed">
          {card.term}
        </span>
        <span className="block truncate text-caption font-medium text-seed/45">
          {card.definition}
        </span>
      </span>
    </>
  );

  if (!expandable) {
    return (
      <Card padding="none" elevation="sm" className="flex items-center gap-3 px-4 py-3">
        {header}
      </Card>
    );
  }

  return (
    <Card padding="none" elevation="sm" className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left outline-none transition active:bg-ink-50/60 focus-visible:ring-2 focus-visible:ring-kiwi-400"
      >
        {header}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          className="shrink-0 text-seed/35"
        >
          <ChevronDown size={18} strokeWidth={2.6} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-4 pb-3.5">
              {/* 내 답(오답 — 코랄) vs 정답(키위 그린) */}
              <div className="flex items-start gap-2 rounded-xl bg-pop/8 px-3 py-2">
                <span className="shrink-0 text-caption font-bold text-pop-dark/70">
                  {t("study.myAnswer")}
                </span>
                <span className="min-w-0 flex-1 break-words text-body-sm font-bold text-pop-dark">
                  {outcome.userAnswer}
                </span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-kiwi/10 px-3 py-2">
                <span className="shrink-0 text-caption font-bold text-kiwi-dark/70">
                  {t("study.answerLabel")}
                </span>
                <span className="min-w-0 flex-1 break-words text-body-sm font-bold text-kiwi-dark">
                  {outcome.correctAnswer ?? card.term}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// 가벼운 transform 기반 컨페티 — 키위 그린/블루/연두 조각이 위에서 떨어짐
function Confetti() {
  const colors = ["bg-kiwi", "bg-info", "bg-kiwi-light", "bg-bark"];
  const pieces = Array.from({ length: 22 });
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = (i * 4.6 + (i % 3) * 7) % 100;
        const delay = (i % 7) * 0.12;
        const color = colors[i % colors.length];
        const size = 7 + (i % 3) * 3;
        return (
          <motion.span
            key={i}
            className={`absolute top-0 rounded-[2px] ${color}`}
            style={{ left: `${left}%`, width: size, height: size * 1.4 }}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{
              y: ["-10%", "115vh"],
              opacity: [0, 1, 1, 0],
              rotate: [0, 220 + (i % 4) * 80],
              x: [0, (i % 2 ? 1 : -1) * (18 + (i % 5) * 8)],
            }}
            transition={{
              duration: 2.4 + (i % 4) * 0.4,
              delay,
              ease: "easeIn",
              repeat: Infinity,
              repeatDelay: 1.2,
            }}
          />
        );
      })}
    </div>
  );
}
