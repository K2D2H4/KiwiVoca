// 매칭 — 타일 짝 그리드(최대 6쌍). 성공: 팝→글로우→shrink+fade 소멸 + layout 재배치. 불일치: shake.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import StudyTopBar from "./StudyTopBar";
import { useSound } from "../../hooks/useSound";
import { shuffle } from "../../lib/grading";
import { spring, shakeKeyframes, shakeTransition } from "../../lib/motion";
import type { StudyCard, StudyOutcome } from "../../types/study";

interface MatchGameProps {
  cards: StudyCard[];
  onClose: () => void;
  onAnswer: (cardId: string | number, isCorrect: boolean) => void;
  onComplete: (outcomes: StudyOutcome[]) => void;
}

const PAIRS_PER_BOARD = 6;

interface Tile {
  key: string;
  cardId: string | number;
  text: string;
  side: "term" | "def";
}

// 카드 → 타일 2개(term/def). 한 보드는 최대 6쌍.
function buildTiles(cards: StudyCard[]): Tile[] {
  const tiles: Tile[] = [];
  cards.forEach((c) => {
    tiles.push({ key: `${c.id}-t`, cardId: c.id, text: c.term, side: "term" });
    tiles.push({ key: `${c.id}-d`, cardId: c.id, text: c.definition, side: "def" });
  });
  return shuffle(tiles);
}

export default function MatchGame({
  cards,
  onClose,
  onAnswer,
  onComplete,
}: MatchGameProps) {
  const { t } = useTranslation();
  const { play } = useSound();

  const boardCards = useMemo(
    () => shuffle(cards).slice(0, PAIRS_PER_BOARD),
    [cards]
  );
  const tiles = useMemo(() => buildTiles(boardCards), [boardCards]);

  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [vanished, setVanished] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const outcomesRef = useRef<StudyOutcome[]>([]);
  const completedRef = useRef(false);

  // 경과 타이머 — cleanup 필수
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 전부 맞추면 완료
  useEffect(() => {
    if (
      !completedRef.current &&
      boardCards.length > 0 &&
      matched.size === boardCards.length * 2
    ) {
      completedRef.current = true;
      const id = window.setTimeout(
        () => onComplete(outcomesRef.current),
        700
      );
      return () => window.clearTimeout(id);
    }
  }, [matched, boardCards.length, onComplete]);

  const onTap = (tile: Tile) => {
    if (matched.has(tile.key) || wrongPair) return;
    if (!selected) {
      play("tap"); // 첫 타일 선택 — 말랑한 팝
      setSelected(tile);
      return;
    }
    if (selected.key === tile.key) {
      setSelected(null); // 같은 타일 재탭 → 선택 해제
      return;
    }

    // 짝 판정
    const isMatch =
      selected.cardId === tile.cardId && selected.side !== tile.side;
    if (isMatch) {
      play("match");
      onAnswer(tile.cardId, true);
      outcomesRef.current.push({ cardId: tile.cardId, isCorrect: true });
      const a = selected.key;
      const b = tile.key;
      // 즉시 matched 표시(팝/글로우 단계) → 약간 뒤 vanished(소멸)
      setMatched((prev) => new Set(prev).add(a).add(b));
      setSelected(null);
      window.setTimeout(() => {
        setVanished((prev) => new Set(prev).add(a).add(b));
      }, 260);
    } else {
      // 오답 — shake 후 해제
      play("wrong");
      setWrongPair([selected.key, tile.key]);
      window.setTimeout(() => {
        setWrongPair(null);
        setSelected(null);
      }, 480);
    }
  };

  const matchedCount = matched.size / 2;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden">
      <StudyTopBar
        onClose={onClose}
        current={matchedCount}
        total={boardCards.length}
        dirty={matched.size > 0}
        right={
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-black tabular-nums text-seed shadow-soft">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" strokeLinecap="round" />
            </svg>
            {mm}:{ss}
          </span>
        }
      />

      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="py-2 text-center text-xs font-bold text-seed/45">
          {t("study.matchHint")}
        </p>
        <LayoutGroup>
          <motion.div
            layout
            className="grid flex-1 grid-cols-2 content-start gap-2.5 sm:grid-cols-3"
          >
            <AnimatePresence>
              {tiles
                .filter((tile) => !vanished.has(tile.key))
                .map((tile) => {
                  const isMatched = matched.has(tile.key);
                  const isSelected = selected?.key === tile.key;
                  const isWrong = wrongPair?.includes(tile.key);

                  let style =
                    tile.side === "term"
                      ? "bg-surface text-seed shadow-soft"
                      : "bg-cream text-seed/90 shadow-soft";
                  if (isSelected) style = "bg-kiwi text-white shadow-kiwi-glow";
                  if (isMatched) style = "bg-kiwi text-white shadow-kiwi-glow";
                  if (isWrong) style = "bg-pop text-white shadow-pop";

                  return (
                    <motion.button
                      key={tile.key}
                      layout
                      type="button"
                      onClick={() => onTap(tile)}
                      disabled={isMatched}
                      aria-pressed={isSelected}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={
                        isMatched
                          ? // 성공: 팝(scale-up) — vanish 직전 글로우
                            { opacity: 1, scale: 1.08 }
                          : isWrong
                            ? { x: shakeKeyframes.x, scale: 1 }
                            : isSelected
                              ? { opacity: 1, scale: 1.04 }
                              : { opacity: 1, scale: 1 }
                      }
                      // 소멸: shrink + fade
                      exit={{ opacity: 0, scale: 0.3 }}
                      transition={
                        isWrong
                          ? shakeTransition
                          : isMatched
                            ? spring.gentle
                            : spring.snappy
                      }
                      whileTap={isMatched ? undefined : { scale: 0.94 }}
                      className={`flex min-h-[68px] items-center justify-center break-words rounded-2xl px-3 py-2 text-center text-sm font-bold leading-tight ${style}`}
                    >
                      {tile.text}
                    </motion.button>
                  );
                })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </div>
  );
}
