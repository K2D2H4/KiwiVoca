// 학습 결과 — 정답률 카운트업, 통계 stagger, 고득점 키위 셀레브레이션(transform 컨페티), 틀린 카드 + 재시도.
// 카운트업/컨페티/stagger 모션 유지, 레이아웃·타이포·버튼만 디자인 시스템화.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Home, RefreshCw, Star } from "lucide-react";
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
  const wrongCards = outcomes
    .filter((o) => !o.isCorrect)
    .map((o) => cardById.get(String(o.cardId)))
    .filter((c): c is StudyCard => Boolean(c));

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
    <div className="bg-orchard relative flex min-h-[100dvh] flex-col overflow-hidden px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      {celebrate && !reduce && <Confetti />}

      <div className="relative z-raised mx-auto w-full max-w-screen-sm">
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
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-pop text-white shadow-pop"
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
              {wrongCards.map((c) => (
                <motion.li key={c.id} variants={staggerItem}>
                  <Card
                    padding="none"
                    elevation="sm"
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-pop" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-bold text-seed">
                        {c.term}
                      </span>
                      <span className="block truncate text-caption font-medium text-seed/45">
                        {c.definition}
                      </span>
                    </span>
                  </Card>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="mt-7 space-y-2.5"
        >
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
          <motion.div variants={staggerItem}>
            <Button
              size="lg"
              fullWidth
              leftIcon={<RefreshCw size={18} strokeWidth={2.4} />}
              onClick={onRestart}
            >
              {t("study.restart")}
            </Button>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              leftIcon={<Home size={17} strokeWidth={2.4} />}
              onClick={onHome}
            >
              {t("study.backHome")}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// 가벼운 transform 기반 컨페티 — 키위 그린/코랄/연두 조각이 위에서 떨어짐
function Confetti() {
  const colors = ["bg-kiwi", "bg-pop", "bg-kiwi-light", "bg-bark"];
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
