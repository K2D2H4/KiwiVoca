// 통합 만들기 시트 — FAB "+" 진입. 2스텝: ①무엇을(단어/문법) ②어떻게(직접/사진/AI).
// 조합별 라우팅으로 기존 생성 플로우(/decks/new · /import · /grammar/new)에 method 쿼리 전달.
// 모바일 우선 바텀시트. 터치≥44px. 키 닫힘은 Sheet가 처리.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookText,
  Camera,
  ChevronLeft,
  GraduationCap,
  PencilLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Sheet from "../ui/Sheet";

type What = "vocab" | "grammar";
type How = "direct" | "photo" | "ai";

// 조합별 목적지. 각 페이지는 ?method= 로 진입 모드를 받음(단어 직접만 전용 페이지).
function routeFor(what: What, how: How): string {
  if (what === "vocab") {
    if (how === "direct") return "/decks/new?kind=vocab";
    if (how === "photo") return "/import?kind=vocab&method=photo";
    return "/import?kind=vocab&method=ai";
  }
  // grammar
  if (how === "direct") return "/grammar/new?method=direct";
  if (how === "photo") return "/grammar/new?method=photo";
  return "/grammar/new?method=ai";
}

interface CreateSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateSheet({ open, onClose }: CreateSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [what, setWhat] = useState<What | null>(null);

  // 시트 닫힐 때 스텝 초기화 (다음 진입 시 스텝1부터)
  useEffect(() => {
    if (!open) {
      const tid = setTimeout(() => setWhat(null), 200);
      return () => clearTimeout(tid);
    }
  }, [open]);

  const go = (how: How) => {
    if (!what) return;
    const to = routeFor(what, how);
    onClose();
    // 시트 닫힘(상태 반영) 후 라우팅 — 같은 틱에서 navigate 시 닫힘이 묻히는 문제 방지
    requestAnimationFrame(() => navigate(to));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={what ? t("create.howTitle") : t("create.whatTitle")}
      ariaLabel={t("create.title")}
    >
      {!what ? (
        // ── 스텝 1: 무엇을 만들까? ──
        <div className="space-y-3">
          <p className="-mt-1 text-body-sm text-seed/55">
            {t("create.whatHint")}
          </p>
          <WhatCard
            icon={BookText}
            tone="kiwi"
            title={t("create.vocabTitle")}
            desc={t("create.vocabDesc")}
            onClick={() => setWhat("vocab")}
          />
          <WhatCard
            icon={GraduationCap}
            tone="bark"
            title={t("create.grammarTitle")}
            desc={t("create.grammarDesc")}
            onClick={() => setWhat("grammar")}
          />
        </div>
      ) : (
        // ── 스텝 2: 어떻게 만들까? ──
        <div>
          <button
            type="button"
            onClick={() => setWhat(null)}
            className="-mt-1 mb-2 flex min-h-[44px] items-center gap-1 text-body-sm font-bold text-seed/55 outline-none transition active:scale-95 focus-visible:text-kiwi-700"
          >
            <ChevronLeft size={18} strokeWidth={2.6} />
            {what === "vocab"
              ? t("create.vocabTitle")
              : t("create.grammarTitle")}
          </button>
          <p className="mb-3 text-body-sm text-seed/55">{t("create.howHint")}</p>
          <div className="space-y-2.5">
            <HowRow
              icon={PencilLine}
              title={t("create.directTitle")}
              desc={
                what === "vocab"
                  ? t("create.directVocabDesc")
                  : t("create.directGrammarDesc")
              }
              onClick={() => go("direct")}
            />
            <HowRow
              icon={Camera}
              title={t("create.photoTitle")}
              desc={t("create.photoDesc")}
              onClick={() => go("photo")}
            />
            <HowRow
              icon={Sparkles}
              accent
              title={t("create.aiTitle")}
              desc={t("create.aiDesc")}
              onClick={() => go("ai")}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}

// 스텝1 큰 카드 — 단어(키위 그린) / 문법(브라운) 정체성 구분
function WhatCard({
  icon: Icon,
  tone,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  tone: "kiwi" | "bark";
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const iconBox =
    tone === "kiwi"
      ? "bg-kiwi-100 text-kiwi-700"
      : "bg-bark/15 text-bark";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-soft outline-none ring-1 ring-border transition active:scale-[0.99] hover:ring-kiwi-300 focus-visible:ring-2 focus-visible:ring-kiwi-400"
    >
      <span
        className={[
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
          iconBox,
        ].join(" ")}
      >
        <Icon size={26} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-body font-bold text-seed">
          {title}
        </span>
        <span className="mt-0.5 block text-body-sm text-seed/55">{desc}</span>
      </span>
      <ChevronLeft size={20} className="shrink-0 rotate-180 text-seed/30" />
    </button>
  );
}

// 스텝2 방식 행 — AI 는 pop 코랄 강조
function HowRow({
  icon: Icon,
  title,
  desc,
  accent,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3.5 rounded-2xl bg-surface p-3.5 text-left shadow-soft outline-none ring-1 transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-kiwi-400",
        accent
          ? "ring-pop/40 hover:ring-pop/70"
          : "ring-border hover:ring-kiwi-300",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          accent ? "bg-pop-soft text-pop-dark" : "bg-kiwi-50 text-kiwi-700",
        ].join(" ")}
      >
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-sm font-bold text-seed">{title}</span>
        <span className="mt-0.5 block text-caption text-seed/55">{desc}</span>
      </span>
      <ChevronLeft size={18} className="shrink-0 rotate-180 text-seed/30" />
    </button>
  );
}
