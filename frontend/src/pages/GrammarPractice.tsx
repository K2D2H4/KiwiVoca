// 문법 연습 — 몰입형 풀스크린 세션. 셸 밖(StudySession처럼) 라우트.
// 진입: 필터/범위/개수 미지정 시 옵션 시트 → 시작. 쿼리로 직접 진입도 지원.
// 라우트: /grammar/practice?decks=1,2&levels=초급,중급&categories=시제&scope=all|unlearned&limit=0|N&order=weak|random
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Info, BookOpen, RotateCcw, Home, ChevronDown } from "lucide-react";
import KiwiMark from "../components/KiwiMark";
import KiwiBuddy, { type KiwiMood } from "../components/KiwiBuddy";
import StudyTopBar from "../components/study/StudyTopBar";
import ScoreChip from "../components/study/ScoreChip";
import GrammarOptionsSheet, {
  type GrammarPracticeOptions,
} from "../components/study/GrammarOptionsSheet";
import { Button, Card } from "../components/ui";
import {
  useGrammarFilters,
  useGrammarItemsForDecks,
  usePractice,
  useGrammarAnswer,
} from "../hooks/useGrammar";
import { useCountUp } from "../hooks/useCountUp";
import { useSound } from "../hooks/useSound";
import { isAnswerCorrect, shuffle } from "../lib/grading";
import { spring, questionVariants, shakeKeyframes, shakeTransition } from "../lib/motion";
import type { PracticeProblem } from "../types/grammar";

interface Outcome {
  problemId: number; // 출제 순서 인덱스(고유 키 — problem_id 미저장)
  itemId: number;
  isCorrect: boolean;
  userAnswer: string; // 결과 리뷰 "내 답 vs 정답"용
}

export default function GrammarPractice() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // decks(콤마) → deck ids
  const deckIds = useMemo<string[]>(() => {
    const raw = params.get("decks");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);

  // 단일 항목 연습 — items(콤마) → item ids. 있으면 itemMode(필터 숨김).
  const itemIds = useMemo<number[]>(() => {
    const raw = params.get("items");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [params]);
  const itemMode = itemIds.length > 0;

  // 필터/옵션 쿼리 — 하나라도 있으면 "구성됨"으로 보고 시트 생략
  const levels = useMemo(() => splitParam(params.get("levels")), [params]);
  const categories = useMemo(
    () => splitParam(params.get("categories")),
    [params]
  );
  const scope = (params.get("scope") as "all" | "unlearned") ?? "all";
  const order = (params.get("order") as "weak" | "random") ?? "weak";
  const limitRaw = params.get("limit");
  const limit = limitRaw != null ? Number(limitRaw) : 0;
  const configured = params.get("start") === "1";

  const filtersQuery = useGrammarFilters(deckIds);
  // QA-18: 옵션 시트에서 연습할 문법 항목을 직접 고를 수 있게 항목 목록 로드
  const itemsQuery = useGrammarItemsForDecks(itemMode ? [] : deckIds);
  const practice = usePractice();
  const {
    mutate: runPractice,
    reset: resetPractice,
    status: practiceStatus,
    isPending,
    isError,
    isSuccess,
    data: problemsData,
  } = practice;

  // 옵션 시트 — 미구성 진입 시 자동 오픈
  const [sheetOpen, setSheetOpen] = useState(!configured);

  // 현재 쿼리(덱/필터/옵션) 시그니처 — 같은 구성에서 중복 생성 방지용.
  const sig = useMemo(() => {
    // 덱 또는 항목 중 하나는 있어야 구성됨
    if (!configured || (deckIds.length === 0 && itemIds.length === 0))
      return null;
    return JSON.stringify({
      deckIds: [...deckIds].sort(),
      itemIds: [...itemIds].sort((a, b) => a - b),
      levels: [...levels].sort(),
      categories: [...categories].sort(),
      scope,
      limit,
      order,
    });
  }, [configured, deckIds, itemIds, levels, categories, scope, limit, order]);

  // 구성되면 즉석 생성 호출. 시그니처가 바뀌었을 때만 새로 요청.
  // ⚠️ 딥링크(start=1) 직진입 시 행 방지: ref만으로 가드하면
  //    StrictMode 더블마운트/리셋 시 mutation이 버려져도 ref가 남아 재호출이 막힘.
  //    → "요청한 sig"와 "mutation이 idle(미시작)"을 함께 보고, idle이면 다시 트리거.
  const requestedSig = useRef<string | null>(null);
  useEffect(() => {
    if (sig == null) return;
    // 같은 구성에 대해 이미 요청을 보냈고, mutation이 살아있으면(진행/성공/실패) 스킵.
    if (requestedSig.current === sig && practiceStatus !== "idle") return;
    requestedSig.current = sig;
    runPractice({
      deckIds,
      itemIds,
      levels,
      categories,
      scope,
      limit: Number.isFinite(limit) ? limit : 0,
      order,
    });
  }, [
    sig,
    practiceStatus,
    deckIds,
    itemIds,
    levels,
    categories,
    scope,
    limit,
    order,
    runPractice,
  ]);

  const close = () => navigate("/study");

  const startWith = useCallback(
    (opts: GrammarPracticeOptions) => {
      // 새 구성 → 이전 생성 결과 폐기하고 재요청 허용
      requestedSig.current = null;
      resetPractice();
      const next = new URLSearchParams(params);
      next.set("start", "1");
      if (opts.levels.length) next.set("levels", opts.levels.join(","));
      else next.delete("levels");
      if (opts.categories.length)
        next.set("categories", opts.categories.join(","));
      else next.delete("categories");
      // QA-18: 시트에서 항목을 골랐으면 items 로 전달(전체 선택이면 필터 방식 유지).
      // itemMode(딥링크 진입)의 기존 items 파라미터는 건드리지 않는다.
      if (opts.itemIds.length) next.set("items", opts.itemIds.join(","));
      else if (!itemMode) next.delete("items");
      next.set("scope", opts.scope);
      next.set("limit", String(opts.limit));
      setParams(next, { replace: true });
      setSheetOpen(false);
    },
    [params, setParams, resetPractice, itemMode]
  );

  // 덱·항목 모두 미지정 — 잘못된 진입
  if (deckIds.length === 0 && itemIds.length === 0) {
    return <CenteredNotice text={t("grammar.practice.noDeck")} onBack={close} />;
  }

  // 옵션 시트 (구성 전)
  if (!configured) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <KiwiBuddy mood="happy" size={88} float />
        <p className="text-body-sm font-bold text-seed/55">
          {t("grammar.practice.choosePrompt")}
        </p>
        <GrammarOptionsSheet
          open={sheetOpen}
          levels={filtersQuery.data?.levels ?? []}
          loading={filtersQuery.isLoading}
          items={itemsQuery.data}
          itemsLoading={itemsQuery.isLoading}
          itemMode={itemMode}
          onClose={close}
          onStart={startWith}
        />
        {!sheetOpen && (
          <Button variant="secondary" size="lg" onClick={() => setSheetOpen(true)}>
            {t("grammar.practice.openOptions")}
          </Button>
        )}
      </div>
    );
  }

  // 구성됨 — 즉석 생성 로딩(Gemini, 수초)
  if (isPending || (!isSuccess && !isError)) {
    return <GeneratingScreen onCancel={close} />;
  }
  if (isError) {
    return <CenteredNotice text={t("grammar.practice.loadError")} onBack={close} />;
  }
  const problems = problemsData ?? [];
  if (problems.length === 0) {
    return (
      <CenteredNotice
        text={t("grammar.practice.emptyResult")}
        onBack={() => {
          // 다시 옵션을 고를 수 있게 초기 상태로
          requestedSig.current = null;
          resetPractice();
          const next = new URLSearchParams(params);
          next.delete("start");
          setParams(next, { replace: true });
          setSheetOpen(true);
        }}
        backLabel={t("grammar.practice.changeFilter")}
      />
    );
  }

  return <PracticeRunner problems={problems} onClose={close} />;
}

// 즉석 생성 로딩 — Gemini가 문제를 만드는 동안. 100dvh, 키위 스피너.
function GeneratingScreen({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-orchard flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* 회전하는 키위 링 */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-kiwi/15 border-t-kiwi [animation-duration:1.1s]"
        />
        <KiwiBuddy mood="happy" size={72} float />
      </div>
      <div>
        <p className="text-body font-black text-seed">
          {t("grammar.practice.generating")}
        </p>
        <p className="mt-1 text-caption font-bold text-seed/50">
          {t("grammar.practice.generatingHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[44px] rounded-full px-5 text-caption font-bold text-seed/45 outline-none transition active:scale-95 hover:text-seed/70"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}

// ── 실제 진행 러너 (문제 집합 고정) ───────────────────────────
function PracticeRunner({
  problems,
  onClose,
}: {
  problems: PracticeProblem[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { play } = useSound();
  const answerMut = useGrammarAnswer();

  // 출제 순서 셔플(한 번)
  const queue = useMemo(() => shuffle(problems), [problems]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [done, setDone] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const problem = queue[index];
  // outcomes 는 출제 순서대로 쌓임 — index 위치에 있으면 이미 답한 문제(리뷰)
  const reviewOutcome = outcomes[index];

  const handleAnswered = useCallback(
    (ok: boolean, userAnswer: string) => {
      if (!problem || outcomes[index]) return;
      play(ok ? "correct" : "wrong");
      if (ok) setScore((s) => s + 1);
      setOutcomes((o) => [
        ...o,
        { problemId: index, itemId: problem.item_id, isCorrect: ok, userAnswer },
      ]);
      // 진척 기록(후속, 실패해도 흐름 진행)
      answerMut.mutate({ item_id: problem.item_id, is_correct: ok });
    },
    [problem, index, outcomes, play, answerMut]
  );

  const next = useCallback(() => {
    setShowContext(false);
    if (index + 1 >= queue.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
  }, [index, queue.length]);

  // 이전 문제 — 답한 문제는 리뷰(공개 상태)로 보임
  const goPrev = useCallback(() => {
    setShowContext(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  if (done) {
    return (
      <GrammarResult
        outcomes={outcomes}
        problems={queue}
        onClose={onClose}
        onRestart={() => {
          setIndex(0);
          setScore(0);
          setOutcomes([]);
          setDone(false);
          setShowContext(false);
        }}
      />
    );
  }

  if (!problem) return null;

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden">
      <StudyTopBar
        onClose={onClose}
        current={index + 1}
        total={queue.length}
        right={<ScoreChip score={score} />}
        dirty={outcomes.length > 0}
        onPrev={goPrev}
        prevDisabled={index === 0}
      />

      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* 문법 메타 + 컨텍스트 토글 */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="rounded-full bg-kiwi/12 px-2.5 py-1 text-caption font-black text-kiwi-dark">
              {problem.level}
            </span>
            <span className="truncate text-caption font-bold text-seed/45">
              {problem.category}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowContext((v) => !v)}
            aria-pressed={showContext}
            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-ink-100/80 px-3 text-caption font-bold text-seed/70 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-kiwi-400"
          >
            <Info size={13} strokeWidth={2.6} />
            {t("grammar.practice.contextToggle")}
          </button>
        </div>

        {/* 문법 컨텍스트(point/explanation) */}
        <AnimatePresence initial={false}>
          {showContext && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 rounded-3xl bg-kiwi/8 p-4 ring-1 ring-kiwi/15">
                <p className="flex items-center gap-1.5 text-body-sm font-black text-kiwi-dark">
                  <BookOpen size={15} strokeWidth={2.6} />
                  {problem.point}
                </p>
                <p className="mt-1.5 text-caption font-medium leading-relaxed text-seed/65">
                  {problem.item_explanation}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 문제 카드 + 보기/입력 */}
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
            {problem.kind === "choice" ? (
              <ChoiceProblem
                problem={problem}
                review={reviewOutcome}
                onAnswered={handleAnswered}
                onNext={next}
                isLast={index + 1 >= queue.length}
              />
            ) : (
              <TypingProblem
                problem={problem}
                review={reviewOutcome}
                onAnswered={handleAnswered}
                onNext={next}
                isLast={index + 1 >= queue.length}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// 빈칸 ___ 슬롯 렌더.
// - 미공개: 코랄 밑줄의 "필 슬롯"(baseline 정렬, 적정 너비, 살짝 강조).
// - 공개 후(filled 전달): 슬롯 자리에 정답을 채워 문장을 완성.
//   filled 는 항상 "정답"(학습 대상)이므로 맞고 틀림과 무관하게 키위그린으로 표시한다.
function PromptText({
  prompt,
  filled,
}: {
  prompt: string;
  filled?: string | null; // 공개 후 빈칸에 채울 정답(없으면 빈 슬롯)
}) {
  const parts = prompt.split(/(_{2,})/g);
  return (
    <span className="break-words text-[clamp(1.35rem,5.5vw,1.85rem)] font-black leading-snug text-seed">
      {parts.map((p, i) => {
        if (!/^_{2,}$/.test(p)) return <span key={i}>{p}</span>;
        // 공개 후 — 정답으로 채운 슬롯 (정답이라 항상 키위그린)
        if (filled != null) {
          return (
            <span
              key={i}
              className="mx-1 inline-flex items-baseline rounded-lg bg-kiwi/12 px-2 pb-0.5 align-baseline font-black text-kiwi-dark"
            >
              {filled}
            </span>
          );
        }
        // 미공개 — 빈 슬롯(키위 그린 밑줄 칩)
        return (
          <span
            key={i}
            className="mx-1 inline-block h-[1.15em] min-w-[3.5ch] translate-y-[0.18em] rounded-md border-b-[3px] border-kiwi/70 bg-kiwi/8 align-baseline"
            aria-hidden="true"
          />
        );
      })}
    </span>
  );
}

// 기본형 힌트 칩 — 빈칸의 원형(예 "먹다")을 알려줘 빈칸을 풀 수 있게.
function BaseFormHint({ baseForm }: { baseForm?: string | null }) {
  const { t } = useTranslation();
  if (!baseForm) return null;
  return (
    <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-kiwi/15 px-3 py-1.5 text-caption font-bold text-kiwi-dark ring-1 ring-inset ring-kiwi/30">
      <span className="shrink-0 text-kiwi-dark/70">
        {t("grammar.practice.baseFormLabel")}
      </span>
      <span className="truncate font-black text-kiwi-dark">{baseForm}</span>
    </span>
  );
}

// ── 객관식 ───────────────────────────────────────────────────
function ChoiceProblem({
  problem,
  review,
  onAnswered,
  onNext,
  isLast,
}: {
  problem: PracticeProblem;
  review?: Outcome; // 이전으로 돌아온 문제 — 답한 상태(리뷰)로 표시
  onAnswered: (ok: boolean, userAnswer: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () => shuffle(problem.options ?? []),
    [problem.options]
  );
  // index 변경 시 리마운트(key=index)되므로 초기값으로 리뷰 상태 복원
  const [picked, setPicked] = useState<string | null>(
    review?.userAnswer ?? null
  );
  const revealed = picked !== null;
  const correct = problem.answer;

  const choose = (opt: string) => {
    if (revealed) return;
    setPicked(opt);
    onAnswered(isAnswerCorrect(opt, correct), opt);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-3 flex min-h-[22dvh] flex-col items-center justify-center rounded-3xl bg-surface p-7 text-center shadow-soft">
        <span className="mb-3 text-[10px] font-black uppercase tracking-widest text-kiwi-dark/55">
          {t("grammar.practice.fillBlank")}
        </span>
        <PromptText
          prompt={problem.prompt}
          filled={revealed ? correct : null}
        />
        {/* 정답 공개 후엔 빈칸이 채워져 힌트 불필요 */}
        {!revealed && <BaseFormHint baseForm={problem.base_form} />}
      </div>

      <div className="mt-4 grid gap-2.5">
        {options.map((opt) => {
          const isCorrectOpt = isAnswerCorrect(opt, correct);
          const isPicked = picked === opt;
          const state = !revealed
            ? "idle"
            : isCorrectOpt
              ? "correct"
              : isPicked
                ? "wrong"
                : "dim";
          return (
            <motion.button
              key={opt}
              type="button"
              disabled={revealed}
              onClick={() => choose(opt)}
              whileTap={revealed ? undefined : { scale: 0.97 }}
              animate={
                state === "correct"
                  ? { scale: [1, 1.04, 1] }
                  : state === "wrong"
                    ? { x: shakeKeyframes.x }
                    : { scale: 1, x: 0 }
              }
              transition={state === "wrong" ? shakeTransition : spring.snappy}
              className={[
                "min-h-[56px] rounded-2xl border-2 px-4 text-left text-body font-extrabold transition-colors",
                state === "idle" &&
                  "border-transparent bg-surface text-seed shadow-soft",
                state === "correct" &&
                  "border-kiwi bg-kiwi/12 text-kiwi-dark shadow-kiwi-glow",
                state === "wrong" && "border-pop bg-pop/12 text-pop-dark",
                state === "dim" && "border-transparent bg-ink-100/60 text-seed/35",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words">{opt}</span>
                {state === "correct" && (
                  <Check size={20} strokeWidth={3} className="shrink-0" />
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* 해설 + 다음 */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.snappy}
            className="mt-auto pt-4"
          >
            {problem.explanation && (
              <p className="mb-3 rounded-2xl bg-bark/8 px-4 py-2.5 text-caption font-medium leading-relaxed text-bark">
                {problem.explanation}
              </p>
            )}
            <motion.button
              type="button"
              onClick={onNext}
              whileTap={{ scale: 0.96 }}
              className="min-h-[56px] w-full rounded-2xl bg-kiwi text-base font-extrabold text-white shadow-kiwi-glow hover:bg-kiwi-dark"
            >
              {isLast ? t("study.finish") : t("study.next")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 타이핑 ───────────────────────────────────────────────────
function TypingProblem({
  problem,
  review,
  onAnswered,
  onNext,
  isLast,
}: {
  problem: PracticeProblem;
  review?: Outcome; // 이전으로 돌아온 문제 — 답한 상태(리뷰)로 표시
  onAnswered: (ok: boolean, userAnswer: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  // index 변경 시 리마운트(key=index)되므로 초기값으로 리뷰 상태 복원
  const [value, setValue] = useState(review?.userAnswer ?? "");
  const [phase, setPhase] = useState<"input" | "correct" | "wrong">(
    review ? (review.isCorrect ? "correct" : "wrong") : "input"
  );
  const revealed = phase !== "input";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== "input" || !value.trim()) return;
    const ok = isAnswerCorrect(value, problem.answer);
    setPhase(ok ? "correct" : "wrong");
    onAnswered(ok, value);
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="mt-3 flex min-h-[22dvh] flex-col items-center justify-center rounded-3xl bg-surface p-7 text-center shadow-soft">
        <span className="mb-3 text-[10px] font-black uppercase tracking-widest text-kiwi-dark/55">
          {t("grammar.practice.fillBlankType")}
        </span>
        <PromptText
          prompt={problem.prompt}
          filled={revealed ? problem.answer : null}
        />
        {/* 정답 공개 후엔 빈칸이 채워져 힌트 불필요 */}
        {!revealed && <BaseFormHint baseForm={problem.base_form} />}
      </div>

      <div className="mt-4">
        <motion.div
          animate={phase === "wrong" ? { x: shakeKeyframes.x } : { x: 0 }}
          transition={phase === "wrong" ? shakeTransition : { duration: 0 }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={revealed}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("grammar.practice.typeHere")}
            className={`min-h-[56px] w-full rounded-2xl border-2 bg-surface px-4 text-lg font-extrabold text-seed shadow-soft transition-[border-color,box-shadow] duration-200 placeholder:text-seed/30 focus:outline-none ${
              phase === "correct"
                ? "border-kiwi shadow-kiwi-glow"
                : phase === "wrong"
                  ? "border-pop shadow-pop"
                  : "border-transparent focus:border-kiwi focus:shadow-[0_0_0_4px_rgba(107,191,89,0.15)]"
            }`}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === "correct" && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.snappy}
              className="mt-3 flex items-center gap-2 rounded-2xl bg-kiwi/12 px-4 py-3 text-sm font-extrabold text-kiwi-dark"
            >
              <Check size={18} strokeWidth={2.8} />
              {t("study.correctMsg")}
            </motion.div>
          )}
          {phase === "wrong" && (
            <motion.div
              key="ng"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0 }}
              transition={spring.snappy}
              className="mt-3 overflow-hidden rounded-2xl bg-pop/12 px-4 py-3"
            >
              <p className="text-xs font-bold text-pop">{t("study.wrongMsg")}</p>
              <p className="mt-1 text-base font-black text-seed">
                {problem.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {revealed && problem.explanation && (
          <p className="mt-3 rounded-2xl bg-bark/8 px-4 py-2.5 text-caption font-medium leading-relaxed text-bark">
            {problem.explanation}
          </p>
        )}
      </div>

      <div className="mt-auto pt-4">
        {revealed ? (
          <motion.button
            type="button"
            onClick={onNext}
            whileTap={{ scale: 0.96 }}
            className="min-h-[56px] w-full rounded-2xl bg-kiwi text-base font-extrabold text-white shadow-kiwi-glow hover:bg-kiwi-dark"
          >
            {isLast ? t("study.finish") : t("study.next")}
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
  );
}

// ── 결과 ─────────────────────────────────────────────────────
function GrammarResult({
  outcomes,
  problems,
  onClose,
  onRestart,
}: {
  outcomes: Outcome[];
  problems: PracticeProblem[];
  onClose: () => void;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.isCorrect).length;
  const wrong = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const accCount = useCountUp(accuracy, 1.0, 0.35);

  // problemId 는 출제 순서 인덱스 — queue(problems)에서 바로 조회. 내 답과 함께 묶음.
  const wrongEntries = outcomes
    .filter((o) => !o.isCorrect)
    .map((o) => ({ outcome: o, problem: problems[o.problemId] }))
    .filter((e): e is { outcome: Outcome; problem: PracticeProblem } =>
      Boolean(e.problem)
    );

  const tier = accuracy >= 90 ? "perfect" : accuracy >= 60 ? "good" : "keepGoing";
  const mood: KiwiMood =
    tier === "perfect" ? "love" : tier === "good" ? "happy" : "neutral";

  return (
    <div className="bg-orchard relative flex h-[100dvh] flex-col overflow-hidden">
      {/* 스크롤 영역 — 통계 + (길어질 수 있는) 틀린 문법 복습 목록. 액션바에 가리지 않게 패딩. */}
      <div className="relative z-raised flex-1 overflow-y-auto px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-screen-sm">
        <div className="flex flex-col items-center text-center">
          <motion.div
            animate={
              tier === "perfect" && !reduce
                ? { rotate: [0, -8, 8, -5, 0], y: [0, -6, 0] }
                : {}
            }
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <KiwiBuddy mood={mood} size={104} />
          </motion.div>
          <p className="mt-4 text-body-sm font-bold uppercase tracking-wide text-kiwi-700">
            {t(`study.reaction.${tier}`)}
          </p>
          <div className="mt-1 flex items-end justify-center gap-1">
            <span className="font-display text-[5rem] font-bold leading-none text-seed tabular-nums">
              {accCount}
            </span>
            <span className="mb-2 text-h1 font-bold text-seed/35">%</span>
          </div>
          <p className="mt-1 text-caption font-bold text-seed/50">
            {t("study.accuracy")}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card padding="md" className="text-center">
            <p className="font-display text-h1 font-bold text-kiwi-700 tabular-nums">
              {correct}
            </p>
            <p className="mt-1 text-caption font-bold text-seed/50">
              {t("study.correct")}
            </p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="font-display text-h1 font-bold text-pop-dark tabular-nums">
              {wrong}
            </p>
            <p className="mt-1 text-caption font-bold text-seed/50">
              {t("study.wrong")}
            </p>
          </Card>
        </div>

        {wrongEntries.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 px-1 text-caption font-bold uppercase tracking-wide text-seed/40">
              {t("grammar.practice.reviewList")}
            </p>
            <ul className="space-y-2">
              {wrongEntries.map(({ problem: p, outcome }, i) => (
                <li key={`${p.item_id}-${i}`}>
                  <WrongProblemRow problem={p} outcome={outcome} />
                </li>
              ))}
            </ul>
          </div>
        )}

        </div>
      </div>

      {/* 액션바 — 화면 하단 고정. 복습 목록이 길어도 항상 보임(몰입형, 탭바 없음). */}
      <div className="relative z-raised border-t border-ink-100/70 bg-surface/85 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(46,58,36,0.07)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-screen-sm space-y-2.5">
          {/* 보조 액션 — 다시 연습 */}
          <Button
            variant="secondary"
            size="md"
            fullWidth
            leftIcon={<RotateCcw size={18} strokeWidth={2.4} />}
            onClick={onRestart}
          >
            {t("study.restart")}
          </Button>
          {/* 메인 완료 CTA — 활성 primary(키위 그린)로 명확하게 */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<Home size={18} strokeWidth={2.4} />}
            onClick={onClose}
          >
            {t("study.backHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 틀린 문법 문제 행 — 아코디언으로 "내 답 vs 정답" + 문제 해설 + 문법 설명 즉시 리뷰
function WrongProblemRow({
  problem,
  outcome,
}: {
  problem: PracticeProblem;
  outcome: Outcome;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card padding="none" elevation="sm" className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left outline-none transition active:bg-ink-50/60 focus-visible:ring-2 focus-visible:ring-kiwi-400"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-pop" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-sm font-bold text-seed">
            {problem.point}
          </span>
          <span className="block truncate text-caption font-medium text-seed/45">
            {problem.prompt}
          </span>
        </span>
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
                  {problem.answer}
                </span>
              </div>
              {/* 문제 해설 */}
              {problem.explanation && (
                <p className="rounded-xl bg-bark/8 px-3 py-2 text-caption font-medium leading-relaxed text-bark">
                  {problem.explanation}
                </p>
              )}
              {/* 해당 문법 설명 */}
              <div className="rounded-xl bg-kiwi/8 px-3 py-2 ring-1 ring-kiwi/15">
                <p className="flex items-center gap-1.5 text-caption font-black text-kiwi-dark">
                  <BookOpen size={13} strokeWidth={2.6} />
                  {problem.point}
                </p>
                <p className="mt-1 text-caption font-medium leading-relaxed text-seed/65">
                  {problem.item_explanation}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── 공용 ─────────────────────────────────────────────────────
function CenteredNotice({
  text,
  onBack,
  backLabel,
}: {
  text: string;
  onBack: () => void;
  backLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <KiwiMark size={72} />
      <p className="text-sm font-bold text-seed/60">{text}</p>
      <button
        type="button"
        onClick={onBack}
        className="min-h-[48px] rounded-2xl bg-kiwi px-6 text-sm font-extrabold text-white shadow-kiwi-glow transition active:scale-95"
      >
        {backLabel ?? t("common.back")}
      </button>
    </div>
  );
}

function splitParam(raw: string | null): string[] {
  return raw ? raw.split(",").filter(Boolean) : [];
}
