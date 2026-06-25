// 학습 옵션 바텀시트 — 범위(전체/미완료) + 개수(20/50/전체/직접입력) 선택 후 시작.
// summary 로 "미완료 N개" 안내. ModeSheet 뒤에 등장. Orchard Pop 디자인.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Play } from "lucide-react";
import { Sheet, SegmentedControl, Button, TextField } from "../ui";
import type { StudyScope, StudySummary } from "../../types/study";

interface StudyOptionsSheetProps {
  open: boolean;
  summary?: StudySummary;
  summaryLoading?: boolean;
  onClose: () => void;
  onStart: (opts: { scope: StudyScope; limit: number }) => void;
}

// 프리셋 개수 칩. value 0 = 전체.
const COUNT_PRESETS = [20, 50, 0] as const;

export default function StudyOptionsSheet({
  open,
  summary,
  summaryLoading,
  onClose,
  onStart,
}: StudyOptionsSheetProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<StudyScope>("all");
  // count: 프리셋(20/50/0) 또는 "custom"
  const [count, setCount] = useState<number | "custom">(20);
  const [customValue, setCustomValue] = useState("");

  // 시트 열릴 때 기본값 리셋
  useEffect(() => {
    if (open) {
      setScope("all");
      setCount(20);
      setCustomValue("");
    }
  }, [open]);

  // 선택 범위에 해당하는 가용 카드 수
  const available = useMemo(() => {
    if (!summary) return undefined;
    return scope === "unlearned" ? summary.unlearned : summary.total;
  }, [summary, scope]);

  // 실제 전송할 limit (0 = 전체). custom 은 1 이상 정수만.
  const resolvedLimit = useMemo(() => {
    if (count === "custom") {
      const n = parseInt(customValue, 10);
      return Number.isFinite(n) && n > 0 ? n : NaN;
    }
    return count;
  }, [count, customValue]);

  const canStart =
    (scope === "unlearned" ? (available ?? 1) > 0 : true) &&
    (count !== "custom" || Number.isFinite(resolvedLimit));

  const handleStart = () => {
    if (!canStart) return;
    onStart({ scope, limit: Number.isFinite(resolvedLimit) ? resolvedLimit : 0 });
  };

  const countLabel = (v: (typeof COUNT_PRESETS)[number]) =>
    v === 0 ? t("study.countAll") : String(v);

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t("study.optionsTitle")}>
      <div className="mb-4">
        <h2 className="text-h3 font-bold text-seed">{t("study.optionsTitle")}</h2>
        <p className="mt-0.5 text-body-sm text-seed/50">
          {t("study.optionsHint")}
        </p>
      </div>

      {/* 범위 선택 */}
      <div className="mb-5">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-seed/45">
          {t("study.scopeLabel")}
        </p>
        <SegmentedControl<StudyScope>
          layoutId="study-scope"
          ariaLabel={t("study.scopeLabel")}
          value={scope}
          onChange={setScope}
          segments={[
            { value: "all", label: t("study.scopeAll") },
            { value: "unlearned", label: t("study.scopeUnlearned") },
          ]}
        />
        {/* summary 안내 — 선택 범위의 가용 개수 */}
        <p className="mt-2 flex items-center gap-1.5 px-1 text-caption font-bold text-kiwi-700">
          <Sparkles size={13} strokeWidth={2.6} />
          {summaryLoading || available === undefined
            ? t("study.summaryLoading")
            : scope === "unlearned"
              ? t("study.summaryUnlearned", { count: available })
              : t("study.summaryTotal", { count: available })}
        </p>
      </div>

      {/* 개수 선택 — 프리셋 칩 + 직접입력 */}
      <div className="mb-5">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-seed/45">
          {t("study.countLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {COUNT_PRESETS.map((v) => {
            const active = count === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => setCount(v)}
                className={[
                  "min-h-[44px] min-w-[64px] rounded-full px-4 text-body-sm font-bold tracking-tight outline-none transition active:scale-95",
                  "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active
                    ? "bg-kiwi text-white shadow-kiwi-glow"
                    : "bg-ink-100/80 text-seed/70 ring-1 ring-border/60 hover:text-seed",
                ].join(" ")}
              >
                {countLabel(v)}
              </button>
            );
          })}
          {/* 직접입력 칩 */}
          <button
            type="button"
            aria-pressed={count === "custom"}
            onClick={() => setCount("custom")}
            className={[
              "min-h-[44px] min-w-[64px] rounded-full px-4 text-body-sm font-bold tracking-tight outline-none transition active:scale-95",
              "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              count === "custom"
                ? "bg-kiwi text-white shadow-kiwi-glow"
                : "bg-ink-100/80 text-seed/70 ring-1 ring-border/60 hover:text-seed",
            ].join(" ")}
          >
            {t("study.countCustom")}
          </button>
        </div>
        {count === "custom" && (
          <div className="mt-2.5">
            <TextField
              type="number"
              inputMode="numeric"
              min={1}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={t("study.countCustomPlaceholder")}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* 시작 */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        leftIcon={<Play size={18} fill="currentColor" />}
        disabled={!canStart}
        onClick={handleStart}
      >
        {t("study.startCta")}
      </Button>
    </Sheet>
  );
}
