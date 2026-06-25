// 학습 세션 — study set fetch → 모드별 게임 렌더 → 결과 화면.
// 라우트: /study/play?decks=1,2,3&mode=flashcards&scope=all|unlearned&limit=20|0&order=weak
// 레거시 /study/:deckId/:mode 는 단일 덱으로 정규화되어 진입.
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import KiwiMark from "../components/KiwiMark";
import StudyResult from "../components/study/StudyResult";
import Flashcards from "../components/study/Flashcards";
import ChoiceQuiz from "../components/study/ChoiceQuiz";
import TypingQuiz from "../components/study/TypingQuiz";
import MatchGame from "../components/study/MatchGame";
import { useStudySet, useAnswer } from "../hooks/useStudy";
import { useDeck } from "../hooks/useDecks";
import type {
  StudyCard,
  StudyMode,
  StudyOutcome,
  StudyScope,
} from "../types/study";

// 모드별 최소 카드 수 (객관식·매칭은 4장 필요)
const MIN_CARDS: Record<StudyMode, number> = {
  flashcards: 1,
  typing: 1,
  choice: 4,
  match: 4,
};

const VALID_MODES: StudyMode[] = ["flashcards", "choice", "typing", "match"];

export default function StudySession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 레거시 경로 파라미터(:deckId/:mode) + 신규 쿼리(?decks&mode&scope&limit) 양쪽 지원
  const { deckId: routeDeckId, mode: routeMode } = useParams();
  const [params] = useSearchParams();

  // deck_ids: 쿼리 decks=1,2,3 우선, 없으면 레거시 단일 :deckId
  const deckIds = useMemo<string[]>(() => {
    const fromQuery = params.get("decks");
    if (fromQuery) return fromQuery.split(",").filter(Boolean);
    return routeDeckId ? [routeDeckId] : [];
  }, [params, routeDeckId]);

  const mode = params.get("mode") ?? routeMode ?? "";
  const scope = (params.get("scope") as StudyScope) ?? "all";
  const limitParam = params.get("limit");
  const limit = limitParam != null ? Number(limitParam) : 20;
  const order = params.get("order") ?? "weak";

  const isValidMode = VALID_MODES.includes(mode as StudyMode);
  const studyMode = mode as StudyMode;

  const { data, isLoading, isError } = useStudySet(deckIds, {
    scope,
    limit: Number.isFinite(limit) ? limit : 20,
    order,
  });
  // 발음 재생용 학습 언어(lang_term) — 단일 덱일 때만 의미 있음(멀티덱이면 첫 덱 기준)
  const { data: deck } = useDeck(deckIds[0]);
  const answer = useAnswer();

  // 라운드 상태: 한 번 시작하면 카드 집합 고정(재시도 시 부분집합으로 갱신)
  const fetched = useMemo<StudyCard[]>(() => data?.cards ?? [], [data]);
  const [roundCards, setRoundCards] = useState<StudyCard[] | null>(null);
  const [outcomes, setOutcomes] = useState<StudyOutcome[] | null>(null);
  const [roundKey, setRoundKey] = useState(0); // 게임 컴포넌트 강제 리마운트

  // 최초 진입 시 fetch 완료되면 라운드 카드 초기화
  const activeCards = roundCards ?? fetched;

  const recordAnswer = useCallback(
    (cardId: string | number, isCorrect: boolean) => {
      answer.mutate({ card_id: cardId, is_correct: isCorrect });
    },
    [answer]
  );

  const handleComplete = useCallback((res: StudyOutcome[]) => {
    setOutcomes(res);
  }, []);

  const restart = useCallback(() => {
    setRoundCards(fetched);
    setOutcomes(null);
    setRoundKey((k) => k + 1);
  }, [fetched]);

  const retryWrong = useCallback((wrong: StudyCard[]) => {
    setRoundCards(wrong);
    setOutcomes(null);
    setRoundKey((k) => k + 1);
  }, []);

  // 종료: 레거시 단일 덱 진입이면 해당 덱으로, 멀티덱/허브 진입이면 학습 허브로
  const close = () =>
    navigate(routeDeckId && deckIds.length === 1 ? `/decks/${routeDeckId}` : "/study");

  // --- 상태 화면들 ---
  if (!isValidMode) {
    return <CenteredNotice text={t("study.invalidMode")} onBack={close} />;
  }
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4">
        <KiwiMark size={72} className="animate-pop-bounce" />
        <p className="text-sm font-bold text-seed/50">{t("common.loading")}</p>
      </div>
    );
  }
  if (isError) {
    return <CenteredNotice text={t("study.loadError")} onBack={close} />;
  }

  const minNeeded = MIN_CARDS[studyMode];
  if (activeCards.length < minNeeded) {
    return (
      <CenteredNotice
        text={t("study.needMoreCards", { count: minNeeded })}
        onBack={close}
      />
    );
  }

  // --- 결과 화면 ---
  if (outcomes) {
    return (
      <StudyResult
        outcomes={outcomes}
        cards={activeCards}
        onRetryWrong={retryWrong}
        onRestart={restart}
        onHome={close}
      />
    );
  }

  // --- 모드별 게임 ---
  const shared = {
    cards: activeCards,
    onClose: close,
    onAnswer: recordAnswer,
    onComplete: handleComplete,
  };
  const langTerm = deck?.lang_term; // term(학습 언어) 발음 기준

  return (
    <div key={roundKey}>
      {studyMode === "flashcards" && (
        <Flashcards {...shared} langTerm={langTerm} />
      )}
      {studyMode === "choice" && <ChoiceQuiz {...shared} langTerm={langTerm} />}
      {studyMode === "typing" && <TypingQuiz {...shared} langTerm={langTerm} />}
      {studyMode === "match" && <MatchGame {...shared} />}
    </div>
  );
}

function CenteredNotice({
  text,
  onBack,
}: {
  text: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <KiwiMark size={72} />
      <p className="text-sm font-bold text-seed/60">{text}</p>
      <button
        type="button"
        onClick={onBack}
        className="min-h-[48px] rounded-2xl bg-kiwi px-6 text-sm font-extrabold text-white shadow-pop transition active:scale-95"
      >
        {t("common.back")}
      </button>
    </div>
  );
}
