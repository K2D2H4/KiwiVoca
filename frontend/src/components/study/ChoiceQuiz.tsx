// 객관식 — 문제 슬라이드 전환, 보기 stagger 등장, 정답 체크 바운스 / 오답 shake + 정답 강조
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import StudyTopBar from "./StudyTopBar";
import ScoreChip from "./ScoreChip";
import { SpeakButton } from "../ui";
import { useTTS } from "../../hooks/useTTS";
import { useSound } from "../../hooks/useSound";
import { shuffle } from "../../lib/grading";
import {
  spring,
  staggerParent,
  staggerItem,
  questionVariants,
  shakeKeyframes,
  shakeTransition,
} from "../../lib/motion";
import type { StudyCard, StudyOutcome } from "../../types/study";

interface ChoiceQuizProps {
  cards: StudyCard[];
  onClose: () => void;
  onAnswer: (cardId: string | number, isCorrect: boolean) => void;
  onComplete: (outcomes: StudyOutcome[]) => void;
  langTerm?: string; // term 발음 언어(덱 lang_term)
}

interface Question {
  card: StudyCard;
  options: string[]; // definition 보기 (정답 포함, 셔플됨)
  answer: string;
}

// 라운드 시작 시 문제/보기 1회 생성 — 정답 1 + distractor 3
function buildQuestions(cards: StudyCard[]): Question[] {
  const allDefs = Array.from(new Set(cards.map((c) => c.definition)));
  return shuffle(cards).map((card) => {
    const distractors = shuffle(
      allDefs.filter((d) => d !== card.definition)
    ).slice(0, 3);
    const options = shuffle([card.definition, ...distractors]);
    return { card, options, answer: card.definition };
  });
}

export default function ChoiceQuiz({
  cards,
  onClose,
  onAnswer,
  onComplete,
  langTerm,
}: ChoiceQuizProps) {
  const { t } = useTranslation();
  const { prefetch } = useTTS();
  const { play } = useSound();
  const questions = useMemo(() => buildQuestions(cards), [cards]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [outcomes, setOutcomes] = useState<StudyOutcome[]>([]);

  const q = questions[index];

  // 현재+다음 문항 term 을 미리 합성해 발음 버튼 지연 완화(캐시 워밍)
  useEffect(() => {
    const cur = questions[index]?.card.term;
    const nxt = questions[index + 1]?.card.term;
    if (cur) prefetch(cur, langTerm);
    if (nxt) prefetch(nxt, langTerm);
  }, [index, questions, langTerm, prefetch]);

  const onPick = (opt: string) => {
    if (picked !== null || !q) return; // 잠금
    const isCorrect = opt === q.answer;
    setPicked(opt);
    play(isCorrect ? "correct" : "wrong");
    if (isCorrect) setScore((p) => p + 1);
    onAnswer(q.card.id, isCorrect);
    const next = [...outcomes, { cardId: q.card.id, isCorrect }];
    setOutcomes(next);

    // 피드백 후 자동 진행
    window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        onComplete(next);
      } else {
        setIndex((p) => p + 1);
        setPicked(null);
      }
    }, 900);
  };

  if (!q) return null;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden">
      <StudyTopBar
        onClose={onClose}
        current={index + 1}
        total={questions.length}
        right={<ScoreChip score={score} />}
      />

      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* 문제 + 보기 — 문제 index가 바뀌면 슬라이드 전환 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            variants={questionVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.smooth}
            className="flex flex-1 flex-col"
          >
            {/* 문제 */}
            <div className="flex min-h-[32dvh] flex-col items-center justify-center rounded-3xl bg-surface p-7 text-center shadow-soft">
              <span className="text-[10px] font-black uppercase tracking-widest text-kiwi-dark/55">
                {t("study.chooseMeaning")}
              </span>
              <span className="mt-3 break-words text-[clamp(1.75rem,7vw,2.25rem)] font-black leading-tight text-seed">
                {q.card.term}
              </span>
              {q.card.reading && (
                <span className="mt-2 text-sm font-bold text-bark">
                  {q.card.reading}
                </span>
              )}
              {/* term 발음 */}
              <span className="mt-3">
                <SpeakButton
                  text={q.card.term}
                  lang={langTerm}
                  variant="soft"
                  size="sm"
                />
              </span>
            </div>

            {/* 보기 — stagger 등장 */}
            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="mt-4 grid grid-cols-1 gap-2.5"
            >
              {q.options.map((opt) => (
                <OptionButton
                  key={opt}
                  opt={opt}
                  isAnswer={opt === q.answer}
                  isPicked={picked === opt}
                  revealed={picked !== null}
                  onPick={() => onPick(opt)}
                />
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function OptionButton({
  opt,
  isAnswer,
  isPicked,
  revealed,
  onPick,
}: {
  opt: string;
  isAnswer: boolean;
  isPicked: boolean;
  revealed: boolean;
  onPick: () => void;
}) {
  let style = "bg-surface text-seed shadow-soft";
  if (revealed && isAnswer) style = "bg-kiwi text-white shadow-kiwi-glow";
  else if (revealed && isPicked && !isAnswer) style = "bg-pop text-white shadow-pop";
  else if (revealed) style = "bg-surface text-seed/30 shadow-soft";

  const wrongPick = revealed && isPicked && !isAnswer;

  return (
    <motion.button
      type="button"
      variants={staggerItem}
      disabled={revealed}
      onClick={onPick}
      whileTap={revealed ? undefined : { scale: 0.97 }}
      // 정답 강조 시 살짝 팝, 오답 클릭 시 shake
      animate={
        revealed && isAnswer
          ? { scale: [1, 1.05, 1], transition: spring.gentle }
          : wrongPick
            ? { x: shakeKeyframes.x, transition: shakeTransition }
            : {}
      }
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-bold ${style}`}
    >
      <span className="min-w-0 flex-1 break-words">{opt}</span>
      <AnimatePresence>
        {revealed && isAnswer && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.gentle}
          >
            <CheckIcon />
          </motion.span>
        )}
        {wrongPick && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.snappy}>
            <CrossIcon />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function CheckIcon() {
  return (
    <svg className="shrink-0" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg className="shrink-0" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
