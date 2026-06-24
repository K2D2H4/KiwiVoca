// Call — Gemini Live 가상 전화 화면. 몰입형 풀스크린(셸 밖, 100dvh, safe-area).
// 통화 전: 덱 정보 + "전화 걸기". 통화 중: KiwiBuddy 펄스 + 학습 단어 칩 + 타이머 + mute/종료.
// 통화 후: 통화 시간 요약 + 다시 걸기/학습으로. 에러: 친화 메시지 + 재시도.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import KiwiBuddy from "../components/KiwiBuddy";
import { Button, Badge, Skeleton } from "../components/ui";
import { useDeck } from "../hooks/useDecks";
import { useCall, type CallErrorCode } from "../hooks/useCall";
import { langLabel } from "../lib/languages";
import { spring } from "../lib/motion";

// 에러 코드 → i18n 키
const ERROR_KEY: Record<CallErrorCode, string> = {
  auth: "call.errAuth",
  deck_forbidden: "call.errDeckForbidden",
  deck_not_found: "call.errDeckNotFound",
  server: "call.errServer",
  mic_denied: "call.errMicDenied",
  mic_unavailable: "call.errMicUnavailable",
  connection: "call.errConnection",
  unknown: "call.errUnknown",
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Call() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deckId = "" } = useParams();
  const { data: deck, isLoading: deckLoading } = useDeck(deckId);

  const {
    status,
    errorCode,
    targetWords,
    muted,
    aiSpeaking,
    micLevel,
    startCall,
    endCall,
    toggleMute,
  } = useCall(deckId);

  // 통화 타이머 — in_call 진입 시점부터
  const [elapsed, setElapsed] = useState(0);
  // 통화 종료 시 보존되는 최종 시간 — state로 두어 종료 화면 재렌더 보장
  const [finalDuration, setFinalDuration] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "in_call") {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      const id = window.setInterval(() => {
        if (startedAtRef.current !== null) {
          setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
      return () => window.clearInterval(id);
    }
    if (status === "ended" || status === "error") {
      // 통화 종료 시 최종 시간 보존(effect는 commit 후 실행 → 재렌더로 반영)
      if (startedAtRef.current !== null) {
        setFinalDuration(
          Math.floor((Date.now() - startedAtRef.current) / 1000)
        );
      }
    }
    if (status === "idle") {
      startedAtRef.current = null;
      setElapsed(0);
    }
  }, [status]);

  const handleStart = () => {
    startedAtRef.current = null;
    setFinalDuration(0);
    setElapsed(0);
    void startCall();
  };

  const statusText = useMemo(() => {
    switch (status) {
      case "connecting":
        return t("call.connecting");
      case "connected":
        return t("call.connecting");
      case "in_call":
        return aiSpeaking ? t("call.talking") : t("call.inCall");
      default:
        return "";
    }
  }, [status, aiSpeaking, t]);

  const isConnecting = status === "connecting" || status === "connected";
  const isActive = status === "in_call" || isConnecting;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-orchard bg-cream pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      {/* 상단 바: 뒤로(통화 중 아닐 때만) */}
      <header className="flex shrink-0 items-center justify-between px-4 pt-3">
        {!isActive ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("common.back")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-seed/70 transition-colors hover:bg-ink-100/70"
          >
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>
        ) : (
          <span className="h-11 w-11" aria-hidden="true" />
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1.5 text-caption font-bold text-seed/70 ring-1 ring-border backdrop-blur">
          <Phone size={13} strokeWidth={2.6} className="text-kiwi-600" />
          {t("call.kicker")}
        </span>
        <span className="h-11 w-11" aria-hidden="true" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {/* ---------- 에러 ---------- */}
          {status === "error" && errorCode ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className="flex w-full max-w-sm flex-col items-center text-center"
            >
              <KiwiBuddy mood="sad" size={120} />
              <h2 className="mt-5 text-h2 font-display font-bold text-seed">
                {t("call.errTitle")}
              </h2>
              <p className="mt-2 text-body-sm text-seed/65">
                {t(ERROR_KEY[errorCode])}
              </p>
              <div className="mt-7 flex w-full flex-col gap-2.5">
                {errorCode === "auth" ? (
                  <Button fullWidth size="lg" onClick={() => navigate("/login")}>
                    {t("call.relogin")}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    size="lg"
                    leftIcon={<RotateCcw size={18} strokeWidth={2.4} />}
                    onClick={handleStart}
                  >
                    {t("call.retry")}
                  </Button>
                )}
                <Button
                  fullWidth
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate(-1)}
                >
                  {t("call.toStudy")}
                </Button>
              </div>
            </motion.div>
          ) : status === "ended" ? (
            /* ---------- 통화 후 요약 ---------- */
            <motion.div
              key="ended"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className="flex w-full max-w-sm flex-col items-center text-center"
            >
              <KiwiBuddy mood="love" size={128} float />
              <h2 className="mt-6 text-h2 font-display font-bold text-seed">
                {t("call.endedTitle")}
              </h2>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-sm ring-1 ring-border">
                <Phone size={15} strokeWidth={2.4} className="text-kiwi-600" />
                <span className="text-body font-bold tabular-nums text-seed">
                  {formatDuration(finalDuration)}
                </span>
              </div>
              <p className="mt-3 text-body-sm text-seed/65">
                {t("call.endedSubtitle")}
              </p>
              <div className="mt-7 flex w-full flex-col gap-2.5">
                <Button
                  fullWidth
                  size="lg"
                  leftIcon={<Phone size={18} strokeWidth={2.4} />}
                  onClick={handleStart}
                >
                  {t("call.again")}
                </Button>
                <Button
                  fullWidth
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate("/study")}
                >
                  {t("call.toStudy")}
                </Button>
              </div>
            </motion.div>
          ) : isActive ? (
            /* ---------- 통화 중 ---------- */
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className="flex w-full max-w-sm flex-col items-center text-center"
            >
              {/* 펄스 링 + KiwiBuddy */}
              <div className="relative flex h-44 w-44 items-center justify-center">
                {/* 음성 레벨 반응 펄스 (마이크 입력 or AI 발화) */}
                <motion.span
                  className="absolute inset-0 rounded-full bg-kiwi/20"
                  animate={{
                    scale: aiSpeaking
                      ? [1, 1.18, 1]
                      : 1 + Math.min(micLevel, 1) * 0.35,
                    opacity: aiSpeaking ? [0.5, 0.15, 0.5] : 0.35,
                  }}
                  transition={
                    aiSpeaking
                      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.12 }
                  }
                />
                <motion.span
                  className="absolute inset-4 rounded-full bg-kiwi/25"
                  animate={{
                    scale: aiSpeaking ? [1, 1.1, 1] : 1 + Math.min(micLevel, 1) * 0.2,
                  }}
                  transition={
                    aiSpeaking
                      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.15 }
                      : { duration: 0.12 }
                  }
                />
                <motion.div
                  animate={
                    aiSpeaking
                      ? { y: [0, -5, 0], rotate: [0, -3, 3, 0] }
                      : { y: [0, -4, 0] }
                  }
                  transition={{
                    duration: aiSpeaking ? 0.9 : 3.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative z-10"
                >
                  <KiwiBuddy mood={aiSpeaking ? "happy" : "neutral"} size={132} />
                </motion.div>
              </div>

              {/* 상태 텍스트 */}
              <div className="mt-6 flex items-center gap-2">
                {isConnecting && (
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-kiwi-600"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                  </span>
                )}
                <span className="text-body font-bold text-seed">{statusText}</span>
              </div>

              {/* 통화 타이머 */}
              {status === "in_call" && (
                <span className="mt-1.5 text-body-sm tabular-nums text-seed/55">
                  {formatDuration(elapsed)}
                </span>
              )}

              {/* 학습 단어 칩 */}
              {targetWords.length > 0 && (
                <div className="mt-6 w-full">
                  <p className="mb-2 flex items-center justify-center gap-1.5 text-caption font-bold uppercase tracking-wide text-seed/45">
                    <Sparkles size={13} strokeWidth={2.4} />
                    {t("call.targetWords")}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {targetWords.map((w, i) => (
                      <motion.span
                        key={`${w}-${i}`}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...spring.snappy, delay: i * 0.04 }}
                      >
                        <Badge tone="kiwi" size="md">
                          {w}
                        </Badge>
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* ---------- 통화 전 ---------- */
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className="flex w-full max-w-sm flex-col items-center text-center"
            >
              <KiwiBuddy mood="happy" size={132} float />
              <h1 className="mt-6 text-h1 font-display font-bold text-seed">
                {t("call.title")}
              </h1>
              <p className="mt-2 text-body-sm text-seed/65">
                {t("call.subtitle")}
              </p>

              {/* 덱 정보 */}
              <div className="mt-6 w-full rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-border">
                {deckLoading ? (
                  <Skeleton className="h-12 rounded-2xl" />
                ) : deck ? (
                  <div className="flex items-center gap-3 text-left">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700">
                      <GraduationCap size={22} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-seed">
                        {deck.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="kiwi" size="sm">
                          {t("deck.cardCount", { count: deck.card_count ?? 0 })}
                        </Badge>
                        <Badge tone="outline" size="sm">
                          {langLabel(deck.lang_term)} → {langLabel(deck.lang_def)}
                        </Badge>
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="text-body-sm text-seed/60">
                    {t("call.errDeckNotFound")}
                  </p>
                )}
              </div>

              {/* 마이크 권한 안내 */}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-seed/50">
                <Mic size={13} strokeWidth={2.4} />
                {t("call.micPermission")}
              </p>

              <Button
                className="mt-6"
                fullWidth
                size="lg"
                leftIcon={<Phone size={20} strokeWidth={2.4} />}
                onClick={handleStart}
                disabled={!deck}
              >
                {t("call.start")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 하단 통화 컨트롤 — 통화 중에만 */}
      <AnimatePresence>
        {isActive && (
          <motion.footer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={spring.smooth}
            className="flex shrink-0 items-center justify-center gap-6 px-6 pb-2 pt-4"
          >
            {/* Mute 토글 */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              aria-label={muted ? t("call.unmute") : t("call.mute")}
              aria-pressed={muted}
              className={[
                "inline-flex h-14 w-14 items-center justify-center rounded-full ring-1 transition-colors",
                muted
                  ? "bg-seed text-cream ring-seed"
                  : "bg-surface text-seed ring-border hover:bg-kiwi-50",
              ].join(" ")}
            >
              {muted ? (
                <MicOff size={24} strokeWidth={2.2} />
              ) : (
                <Mic size={24} strokeWidth={2.2} />
              )}
            </motion.button>

            {/* 통화 종료 */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={endCall}
              aria-label={t("call.end")}
              className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-pop transition-colors hover:bg-pop-dark"
            >
              <PhoneOff size={26} strokeWidth={2.3} />
            </motion.button>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
