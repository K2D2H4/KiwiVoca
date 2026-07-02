// 학습 상단 바 — 닫기 IconButton + (선택)이전 문제 버튼 + 진행 바 + 점수/카운트 슬롯. 모든 모드 공용.
// dirty(답변 있음)면 닫기 시 확인 시트를 먼저 띄운다(진행 유실 방지).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ChevronLeft } from "lucide-react";
import { IconButton, ProgressBar, ConfirmSheet } from "../ui";

interface StudyTopBarProps {
  onClose: () => void;
  current: number; // 1-based 진행
  total: number;
  right?: React.ReactNode; // 점수/타이머 등
  // QA-17: 진행 중(답변 있음)일 때 닫기 확인 시트 표시
  dirty?: boolean;
  // QA-14: 이전 문제로 이동(전달 시 버튼 노출, 첫 문제면 prevDisabled)
  onPrev?: () => void;
  prevDisabled?: boolean;
}

export default function StudyTopBar({
  onClose,
  current,
  total,
  right,
  dirty = false,
  onPrev,
  prevDisabled = false,
}: StudyTopBarProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  // 아무 답도 안 했으면 바로 종료, 진행 중이면 확인 먼저
  const requestClose = () => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  };

  return (
    <header className="sticky top-0 z-header bg-cream/85 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-screen-md items-center gap-3">
        <IconButton
          label={t("common.back")}
          variant="ghost"
          onClick={requestClose}
          className="-ml-1"
        >
          <X size={22} strokeWidth={2.6} />
        </IconButton>

        {/* 이전 문제 — 퀴즈 모드에서만 전달됨 */}
        {onPrev && (
          <IconButton
            label={t("study.prevQuestion")}
            variant="ghost"
            onClick={onPrev}
            disabled={prevDisabled}
            className="-ml-2 disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </IconButton>
        )}

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

      {/* QA-17: 이탈 확인 — 답변이 저장되지 않음을 안내 */}
      <ConfirmSheet
        open={confirmOpen}
        title={t("study.exitConfirmTitle")}
        message={t("study.exitConfirmMessage")}
        confirmLabel={t("study.exitConfirmCta")}
        danger
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </header>
  );
}
