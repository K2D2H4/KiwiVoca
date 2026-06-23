// 학습 세션 — study set fetch → 모드별 게임 렌더 → 결과 화면. /study/:deckId/:mode
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import KiwiMark from "../components/KiwiMark";
import StudyResult from "../components/study/StudyResult";
import Flashcards from "../components/study/Flashcards";
import ChoiceQuiz from "../components/study/ChoiceQuiz";
import TypingQuiz from "../components/study/TypingQuiz";
import MatchGame from "../components/study/MatchGame";
import { useStudySet, useAnswer } from "../hooks/useStudy";
import type { StudyCard, StudyMode, StudyOutcome } from "../types/study";

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
  const { deckId = "", mode = "" } = useParams();

  const isValidMode = VALID_MODES.includes(mode as StudyMode);
  const studyMode = mode as StudyMode;

  const { data, isLoading, isError } = useStudySet(deckId);
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

  const close = () => navigate(`/decks/${deckId}`);

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

  return (
    <div key={roundKey}>
      {studyMode === "flashcards" && <Flashcards {...shared} />}
      {studyMode === "choice" && <ChoiceQuiz {...shared} />}
      {studyMode === "typing" && <TypingQuiz {...shared} />}
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
