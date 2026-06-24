// 플래시카드 — 스택 덱 + 3D flip + 드래그 비례 회전/색힌트 + 속도 기반 throw-off
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import StudyTopBar from "./StudyTopBar";
import { SpeakButton } from "../ui";
import { spring, tap } from "../../lib/motion";
import type { StudyCard, StudyOutcome } from "../../types/study";

interface FlashcardsProps {
  cards: StudyCard[];
  onClose: () => void;
  onAnswer: (cardId: string | number, isCorrect: boolean) => void;
  onComplete: (outcomes: StudyOutcome[]) => void;
  langTerm?: string; // term 발음 언어(덱 lang_term)
}

const SWIPE_OFFSET = 110; // 거리 임계값
const SWIPE_VELOCITY = 480; // 속도 임계값(빠르게 던지면 거리 미달도 인정)

export default function Flashcards({
  cards,
  onClose,
  onAnswer,
  onComplete,
  langTerm,
}: FlashcardsProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [outcomes, setOutcomes] = useState<StudyOutcome[]>([]);
  // 버튼으로 날릴 때 방향 강제(+1=앎 우, -1=모름 좌)
  const [flyAway, setFlyAway] = useState<-1 | 0 | 1>(0);
  // throw-off 1회당 advance 1회만 보장 — 리셋/스냅백 애니메이션 완료로 인한 중복 차단
  const advancingRef = useRef(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const knewOpacity = useTransform(x, [30, 130], [0, 1]);
  const dontOpacity = useTransform(x, [-130, -30], [1, 0]);
  // 드래그할수록 카드 살짝 들림(scale up)
  const lift = useTransform(x, [-180, 0, 180], [1.04, 1, 1.04]);

  const card = cards[index];

  const advance = useCallback(
    (isCorrect: boolean) => {
      if (!card) return;
      onAnswer(card.id, isCorrect);
      const next = [...outcomes, { cardId: card.id, isCorrect }];
      setOutcomes(next);
      if (index + 1 >= cards.length) {
        onComplete(next);
      } else {
        setIndex((p) => p + 1);
        setFlipped(false);
        setFlyAway(0);
        x.set(0);
        // 가드 해제는 여기서 하지 않음(동일 exit 애니메이션의 중복 콜백 레이스 방지).
        // 다음 카드 mount 시 onAnimationStart에서 해제한다.
      }
    },
    [card, cards.length, index, onAnswer, onComplete, outcomes, x]
  );

  // 드래그 종료 — 거리 또는 속도 기반 판정
  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const past =
      info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY;
    const pastLeft =
      info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY;
    if (past) setFlyAway(1);
    else if (pastLeft) setFlyAway(-1);
    // 미달이면 dragSnapToOrigin이 스냅백 처리
  };

  // 버튼 클릭 — 동일 이탈 애니메이션 트리거
  const triggerButton = (isCorrect: boolean) => {
    if (flyAway !== 0) return;
    setFlyAway(isCorrect ? 1 : -1);
  };

  if (!card) return null;

  // throw-off 목표 위치
  const exitX = flyAway === 1 ? 560 : flyAway === -1 ? -560 : 0;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden">
      <StudyTopBar onClose={onClose} current={index + 1} total={cards.length} />

      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-5">
        {/* 카드 영역 — 스택 덱 */}
        <div
          className="relative flex flex-1 items-center justify-center py-4"
          style={{ perspective: 1400 }}
        >
          {/* 뒤에 깔린 다음 카드 2장(깊이감) */}
          {[2, 1].map((depth) => {
            const peek = cards[index + depth];
            if (!peek) return null;
            return (
              <motion.div
                key={`peek-${peek.id}`}
                aria-hidden
                className="absolute h-[55dvh] w-full rounded-3xl bg-surface shadow-soft"
                initial={false}
                animate={{
                  scale: 1 - depth * 0.05,
                  y: depth * 14,
                  opacity: 1 - depth * 0.18,
                }}
                transition={spring.smooth}
              />
            );
          })}

          {/* 현재 카드 */}
          <AnimatePresence initial={false}>
            <motion.div
              key={card.id}
              className="absolute w-full will-change-transform"
              style={{
                x,
                rotate: reduce ? 0 : rotate,
                scale: reduce ? 1 : lift,
              }}
              drag={reduce ? false : "x"}
              dragSnapToOrigin
              dragElastic={0.55}
              onDragEnd={onDragEnd}
              initial={{ scale: 0.94, y: 14, opacity: 0 }}
              animate={
                flyAway !== 0
                  ? {
                      x: exitX,
                      rotate: flyAway * 22,
                      opacity: 0,
                      transition: { duration: 0.32, ease: [0.4, 0, 0.6, 1] },
                    }
                  : { scale: 1, y: 0, opacity: 1, transition: spring.smooth }
              }
              onAnimationStart={() => {
                // 새 카드 enter(flyAway===0) 시작 시 가드 재무장
                if (flyAway === 0) advancingRef.current = false;
              }}
              onAnimationComplete={() => {
                // exit(throw-off)만 처리 + 1회 가드 — enter/스냅백/중복 콜백 재발화 차단
                if (flyAway !== 0 && !advancingRef.current) {
                  advancingRef.current = true;
                  advance(flyAway === 1);
                }
              }}
            >
              {/* 스와이프 힌트 배지 */}
              <motion.span
                style={{ opacity: reduce ? 0 : knewOpacity }}
                className="pointer-events-none absolute left-4 top-4 z-10 rotate-[-8deg] rounded-2xl border-2 border-kiwi bg-kiwi/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-kiwi-dark"
              >
                {t("study.knew")}
              </motion.span>
              <motion.span
                style={{ opacity: reduce ? 0 : dontOpacity }}
                className="pointer-events-none absolute right-4 top-4 z-10 rotate-[8deg] rounded-2xl border-2 border-pop bg-pop/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-pop"
              >
                {t("study.didntKnow")}
              </motion.span>

              {/* 3D flip 컨테이너 */}
              <motion.button
                type="button"
                onClick={() => setFlipped((p) => !p)}
                className="relative block w-full text-left"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 26 }
                }
                aria-label={t("study.tapToFlip")}
              >
                {/* 앞면 — term */}
                <span
                  className="relative flex h-[55dvh] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-surface p-7 text-center shadow-soft"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {/* term 발음 — 카드 flip/swipe와 분리(SpeakButton 내부 stopPropagation) */}
                  <span className="absolute right-3 top-3">
                    <SpeakButton
                      text={card.term}
                      lang={langTerm}
                      variant="soft"
                      size="sm"
                    />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-kiwi-dark/55">
                    {t("study.frontLabel")}
                  </span>
                  <span className="break-words text-[clamp(1.75rem,8vw,2.5rem)] font-black leading-tight text-seed">
                    {card.term}
                  </span>
                  {card.reading && (
                    <span className="text-base font-bold text-bark">
                      {card.reading}
                    </span>
                  )}
                  <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-seed/35">
                    <FlipIcon />
                    {t("study.tapToFlip")}
                  </span>
                </span>

                {/* 뒷면 — definition + example */}
                <span
                  className="absolute inset-0 flex h-[55dvh] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-kiwi to-kiwi-dark p-7 text-center text-white shadow-pop"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                    {t("study.backLabel")}
                  </span>
                  <span className="break-words text-[clamp(1.5rem,6.5vw,2rem)] font-black leading-snug">
                    {card.definition}
                  </span>
                  {card.example && (
                    <span className="mt-1 max-w-xs break-words text-sm font-semibold text-white/80">
                      “{card.example}”
                    </span>
                  )}
                </span>
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 모름 / 앎 버튼 (스와이프 대체 — 접근성/데스크탑) */}
        <div className="grid grid-cols-2 gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <motion.button
            type="button"
            onClick={() => triggerButton(false)}
            whileTap={tap}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-surface text-base font-extrabold text-pop shadow-soft"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            {t("study.didntKnow")}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => triggerButton(true)}
            whileTap={tap}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-kiwi text-base font-extrabold text-white shadow-pop"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {t("study.knew")}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  );
}
