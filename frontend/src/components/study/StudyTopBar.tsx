// 학습 상단 바 — 닫기 IconButton + 진행 바 + 점수/카운트 슬롯. 모든 모드 공용.
// 진행 계산/모션 로직 유지, 비주얼만 디자인 시스템화.
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { IconButton, ProgressBar } from "../ui";

interface StudyTopBarProps {
  onClose: () => void;
  current: number; // 1-based 진행
  total: number;
  right?: React.ReactNode; // 점수/타이머 등
}

export default function StudyTopBar({
  onClose,
  current,
  total,
  right,
}: StudyTopBarProps) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <header className="sticky top-0 z-header bg-cream/85 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-screen-md items-center gap-3">
        <IconButton
          label={t("common.back")}
          variant="ghost"
          onClick={onClose}
          className="-ml-1"
        >
          <X size={22} strokeWidth={2.6} />
        </IconButton>

        {/* 진행 바 — 프리미티브 스프링 채움 */}
        <ProgressBar
          value={pct}
          size="md"
          className="flex-1 shadow-inner-soft"
          label={t("study.title")}
        />

        {right ? (
          <div className="shrink-0">{right}</div>
        ) : (
          <span className="shrink-0 text-body-sm font-bold tabular-nums text-seed/55">
            {Math.min(current, total)}/{total}
          </span>
        )}
      </div>
    </header>
  );
}
