// 타이핑 — 문제=definition, 입력=term. 제출 reveal: 정답 체크 바운스 / 오답 input shake + 정답 슬라이드
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import StudyTopBar from "./StudyTopBar";
import ScoreChip from "./ScoreChip";
import { SpeakButton } from "../ui";
import { useTTS } from "../../hooks/useTTS";
import { useSound } from "../../hooks/useSound";
import { isAnswerCorrect, shuffle } from "../../lib/grading";
import {
  spring,
  questionVariants,
  shakeKeyframes,
  shakeTransition,
} from "../../lib/motion";
import type { StudyCard, StudyOutcome } from "../../types/study";

interface TypingQuizProps {
  cards: StudyCard[];
  onClose: () => void;
  onAnswer: (cardId: string | number, isCorrect: boolean) => void;
  onComplete: (outcomes: StudyOutcome[]) => void;
  langTerm?: string; // term 발음 언어(덱 lang_term)
}

type Phase = "input" | "correct" | "wrong";

export default function TypingQuiz({
  cards,
  onClose,
  onAnswer,
  onComplete,
  langTerm,
}: TypingQuizProps) {
  const { t } = useTranslation();
  const { prefetch } = useTTS();
  const { play } = useSound();
  const queue = useMemo(() => shuffle(cards), [cards]);

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [score, setScore] = useState(0);
  const [outcomes, setOutcomes] = useState<StudyOutcome[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const card = queue[index];

  // 현재 문항 term 을 미리 합성해 정답 노출 시 발음 버튼 지연 완화(캐시 워밍)
  useEffect(() => {
    if (card?.term) prefetch(card.term, langTerm);
  }, [card, langTerm, prefetch]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!card || phase !== "input" || !value.trim()) return;
    const ok = isAnswerCorrect(value, card.term);
    setPhase(ok ? "correct" : "wrong");
    play(ok ? "correct" : "wrong");
    if (ok) setScore((p) => p + 1);
    onAnswer(card.id, ok);
    setOutcomes((p) => [...p, { cardId: card.id, isCorrect: ok }]);
  };

  const onNext = () => {
    const isLast = index + 1 >= queue.length;
    if (isLast) {
      onComplete(outcomes);
      return;
    }
    setIndex((p) => p + 1);
    setValue("");
    setPhase("input");
    // 다음 문제 자동 포커스
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  if (!card) return null;

  const revealed = phase !== "input";

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden">
      <StudyTopBar
        onClose={onClose}
        current={index + 1}
        total={queue.length}
        right={<ScoreChip score={score} />}
      />

      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* 문제 (뜻) — 슬라이드 전환 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            variants={questionVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.smooth}
            className="mt-2 flex min-h-[26dvh] flex-col items-center justify-center rounded-3xl bg-surface p-7 text-center shadow-soft"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-kiwi-dark/55">
              {t("study.typeTerm")}
            </span>
            <span className="mt-3 break-words text-[clamp(1.5rem,6vw,2rem)] font-black leading-snug text-seed">
              {card.definition}
            </span>
            {card.example && (
              <span className="mt-2 max-w-xs break-words text-sm font-semibold text-seed/45">
                “{card.example}”
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {/* 입력 / 피드백 */}
        <form onSubmit={onSubmit} className="mt-4 flex flex-1 flex-col">
          <motion.div
            // 오답 시 input shake
            animate={phase === "wrong" ? { x: shakeKeyframes.x } : { x: 0 }}
            transition={phase === "wrong" ? shakeTransition : { duration: 0 }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={revealed}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t("study.typeHere")}
              className={`min-h-[56px] w-full rounded-2xl border-2 bg-surface px-4 text-lg font-extrabold text-seed shadow-soft transition-[border-color,box-shadow] duration-200 placeholder:text-seed/30 focus:outline-none ${
                phase === "correct"
                  ? "border-kiwi shadow-kiwi-glow"
                  : phase === "wrong"
                    ? "border-pop shadow-pop"
                    : "border-transparent focus:border-kiwi focus:shadow-[0_0_0_4px_rgba(107,191,89,0.15)]"
              }`}
            />
          </motion.div>

          {/* 정답/오답 피드백 */}
          <AnimatePresence mode="wait">
            {phase === "correct" && (
              <motion.div
                key="correct"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.snappy}
                className="mt-3 flex items-center gap-2 rounded-2xl bg-kiwi/12 px-4 py-3 text-sm font-extrabold text-kiwi-dark"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={spring.gentle}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </motion.span>
                {t("study.correctMsg")}
              </motion.div>
            )}
            {phase === "wrong" && (
              <motion.div
                key="wrong"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={spring.snappy}
                className="mt-3 overflow-hidden rounded-2xl bg-pop/12 px-4 py-3"
              >
                <p className="text-xs font-bold text-pop">{t("study.wrongMsg")}</p>
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring.snappy, delay: 0.08 }}
                  className="mt-1 flex items-center gap-1.5"
                >
                  <span className="text-base font-black text-seed">
                    {card.term}
                  </span>
                  {/* 정답 노출 시 발음 */}
                  <SpeakButton text={card.term} lang={langTerm} variant="ghost" size="sm" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto pt-4">
            {revealed ? (
              <motion.button
                type="button"
                onClick={onNext}
                whileTap={{ scale: 0.96 }}
                className="min-h-[56px] w-full rounded-2xl bg-kiwi text-base font-extrabold text-white shadow-kiwi-glow hover:bg-kiwi-dark"
              >
                {index + 1 >= queue.length
                  ? t("study.finish")
                  : t("study.next")}
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={!value.trim()}
                whileTap={{ scale: 0.96 }}
                className="min-h-[56px] w-full rounded-2xl bg-kiwi text-base font-extrabold text-white shadow-kiwi-glow transition-opacity hover:bg-kiwi-dark disabled:opacity-40"
              >
                {t("study.check")}
              </motion.button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
