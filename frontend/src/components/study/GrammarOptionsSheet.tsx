// 문법 연습 옵션 — 다단계 필터(레벨 → 카테고리) + 범위 + 개수. StudyOptionsSheet 패턴의 문법 전용 변형.
// 레벨 다중 선택 → 선택된 각 레벨의 카테고리를 다층 다중 선택. 선택 카운트로 가용 문제 수 안내.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Play, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SegmentedControl, Button, TextField } from "../ui";
import type { GrammarFilterLevel } from "../../types/grammar";

export type PracticeScope = "all" | "unlearned";

export interface GrammarPracticeOptions {
  levels: string[];
  categories: string[];
  scope: PracticeScope;
  limit: number; // 생성할 문제 수
}

interface GrammarOptionsSheetProps {
  open: boolean;
  levels: GrammarFilterLevel[];
  loading?: boolean;
  // 단일 항목 연습 모드 — 레벨/카테고리/범위 숨기고 "문제 수"만 고름
  itemMode?: boolean;
  onClose: () => void;
  onStart: (opts: GrammarPracticeOptions) => void;
}

// 생성할 문제 수(반복 학습) 프리셋
const COUNT_PRESETS = [10, 20, 30] as const;
const DEFAULT_COUNT = 10;

// 카테고리 키 — 레벨이 달라도 같은 이름 카테고리를 구분(레벨::카테고리)
const catKey = (level: string, category: string) => `${level}::${category}`;

const chipClass = (active: boolean) =>
  [
    "min-h-[44px] rounded-full px-4 text-body-sm font-bold tracking-tight outline-none transition active:scale-95",
    "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    active
      ? "bg-kiwi text-white shadow-kiwi-glow"
      : "bg-ink-100/80 text-seed/70 ring-1 ring-border/60 hover:text-seed",
  ].join(" ");

export default function GrammarOptionsSheet({
  open,
  levels,
  loading,
  itemMode = false,
  onClose,
  onStart,
}: GrammarOptionsSheetProps) {
  const { t } = useTranslation();

  // 선택된 레벨(이름) / 선택된 카테고리(레벨::카테고리 키)
  const [selLevels, setSelLevels] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [scope, setScope] = useState<PracticeScope>("all");
  const [count, setCount] = useState<number | "custom">(DEFAULT_COUNT);
  const [customValue, setCustomValue] = useState("");

  // 시트 열릴 때 기본값 리셋(필터 미선택 = 전체)
  useEffect(() => {
    if (open) {
      setSelLevels([]);
      setSelCats([]);
      setScope("all");
      setCount(DEFAULT_COUNT);
      setCustomValue("");
    }
  }, [open]);

  const toggleLevel = (level: string) => {
    setSelLevels((prev) => {
      const has = prev.includes(level);
      if (has) {
        // 레벨 해제 시 그 레벨의 카테고리 선택도 정리
        setSelCats((cats) => cats.filter((k) => !k.startsWith(`${level}::`)));
        return prev.filter((l) => l !== level);
      }
      return [...prev, level];
    });
  };

  const toggleCat = (level: string, category: string) => {
    const key = catKey(level, category);
    setSelCats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // 선택된 레벨들(있으면 그 레벨만, 없으면 전체 레벨 — 카테고리 영역 표시용)
  const activeLevels = useMemo(
    () => levels.filter((l) => selLevels.includes(l.level)),
    [levels, selLevels]
  );

  // 가용 문제 수 추정 — 선택에 따라 계층 카운트 합산.
  // 레벨 미선택: 전체 / 레벨만 선택: 그 레벨 합 / 카테고리까지 선택: 선택 카테고리 합.
  const available = useMemo(() => {
    if (!levels.length) return 0;
    const totalAll = levels.reduce((s, l) => s + l.count, 0);
    if (selLevels.length === 0) return totalAll;

    // 레벨별로: 그 레벨에서 선택된 카테고리가 있으면 그 합, 없으면 레벨 전체
    return activeLevels.reduce((sum, l) => {
      const chosen = l.categories.filter((c) =>
        selCats.includes(catKey(l.level, c.category))
      );
      const levelHasCatSel = l.categories.some((c) =>
        selCats.includes(catKey(l.level, c.category))
      );
      return (
        sum + (levelHasCatSel ? chosen.reduce((s, c) => s + c.count, 0) : l.count)
      );
    }, 0);
  }, [levels, selLevels, selCats, activeLevels]);

  const resolvedLimit = useMemo(() => {
    if (count === "custom") {
      const n = parseInt(customValue, 10);
      return Number.isFinite(n) && n > 0 ? n : NaN;
    }
    return count;
  }, [count, customValue]);

  // limit = 생성할 문제 수이므로 양수여야 시작 가능.
  // 항목 모드는 필터 가용수와 무관(특정 항목만 연습) → available 게이트 제외.
  const canStart =
    Number.isFinite(resolvedLimit) &&
    resolvedLimit > 0 &&
    (itemMode || available > 0);

  const handleStart = () => {
    if (!canStart) return;
    // 카테고리 키(level::category) → 백엔드는 카테고리 이름만 받음. 중복 제거.
    const cats = Array.from(
      new Set(selCats.map((k) => k.split("::").slice(1).join("::")))
    );
    onStart({
      levels: itemMode ? [] : selLevels,
      categories: itemMode ? [] : cats,
      scope: itemMode ? "all" : scope,
      limit: resolvedLimit,
    });
  };

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t("grammar.practice.optionsTitle")}>
      <div className="mb-4">
        <h2 className="text-h3 font-bold text-seed">
          {itemMode
            ? t("grammar.practice.optionsTitleItem")
            : t("grammar.practice.optionsTitle")}
        </h2>
        <p className="mt-0.5 text-body-sm text-seed/50">
          {itemMode
            ? t("grammar.practice.optionsHintItem")
            : t("grammar.practice.optionsHint")}
        </p>
      </div>

      {/* 레벨 선택 (다중) — 덱 모드만 */}
      {!itemMode && (
      <div className="mb-4">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-seed/45">
          {t("grammar.filter.levelLabel")}
        </p>
        {loading ? (
          <p className="text-body-sm text-seed/40">{t("common.loading")}</p>
        ) : levels.length === 0 ? (
          <p className="text-body-sm text-seed/40">
            {t("grammar.filter.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => {
              const active = selLevels.includes(l.level);
              return (
                <button
                  key={l.level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLevel(l.level)}
                  className={chipClass(active)}
                >
                  {l.level}
                  <span
                    className={`ml-1.5 text-caption font-bold tabular-nums ${active ? "text-white/70" : "text-seed/40"}`}
                  >
                    {l.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 px-1 text-caption font-medium text-seed/40">
          {selLevels.length === 0
            ? t("grammar.filter.levelAllHint")
            : t("grammar.filter.levelSelected", { count: selLevels.length })}
        </p>
      </div>
      )}

      {/* 카테고리 선택 (선택된 각 레벨별 다층) — 덱 모드만 */}
      {!itemMode && (
      <AnimatePresence initial={false}>
        {activeLevels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="mb-4 overflow-hidden"
          >
            <p className="mb-2 flex items-center gap-1 text-caption font-bold uppercase tracking-wide text-seed/45">
              <ChevronDown size={13} strokeWidth={2.8} />
              {t("grammar.filter.categoryLabel")}
            </p>
            <div className="space-y-3 rounded-3xl bg-ink-50/60 p-3 ring-1 ring-border/40">
              {activeLevels.map((l) => (
                <div key={l.level}>
                  <p className="mb-1.5 px-1 text-caption font-bold text-kiwi-700">
                    {l.level}
                  </p>
                  {l.categories.length === 0 ? (
                    <p className="px-1 text-caption text-seed/35">
                      {t("grammar.filter.noCategories")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {l.categories.map((c) => {
                        const active = selCats.includes(
                          catKey(l.level, c.category)
                        );
                        return (
                          <button
                            key={c.category}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleCat(l.level, c.category)}
                            className={[
                              "min-h-[40px] rounded-full px-3 text-caption font-bold tracking-tight outline-none transition active:scale-95",
                              "focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                              active
                                ? "bg-kiwi text-white shadow-kiwi-glow"
                                : "bg-surface text-seed/65 ring-1 ring-border/50 hover:text-seed",
                            ].join(" ")}
                          >
                            {c.category}
                            <span
                              className={`ml-1 tabular-nums ${active ? "text-white/70" : "text-seed/35"}`}
                            >
                              {c.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      )}

      {/* 범위 — 덱 모드만 */}
      {!itemMode && (
      <div className="mb-4">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-seed/45">
          {t("study.scopeLabel")}
        </p>
        <SegmentedControl<PracticeScope>
          layoutId="grammar-scope"
          ariaLabel={t("study.scopeLabel")}
          value={scope}
          onChange={setScope}
          segments={[
            { value: "all", label: t("study.scopeAllGrammar") },
            { value: "unlearned", label: t("study.scopeUnlearned") },
          ]}
        />
        <p className="mt-2 flex items-center gap-1.5 px-1 text-caption font-bold text-kiwi-700">
          <Sparkles size={13} strokeWidth={2.6} />
          {loading
            ? t("grammar.practice.summaryAvailableLoading")
            : t("grammar.practice.summaryAvailableItems", { count: available })}
        </p>
      </div>
      )}

      {/* 문제 수 — 생성할 연습 문제 개수(반복 학습) */}
      <div className="mb-5">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-seed/45">
          {t("grammar.practice.problemCountLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {COUNT_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={count === v}
              onClick={() => setCount(v)}
              className={chipClass(count === v)}
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={count === "custom"}
            onClick={() => setCount("custom")}
            className={chipClass(count === "custom")}
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
        {/* 프리뷰 — 생성할 연습 문제 수를 명확히 안내 */}
        {Number.isFinite(resolvedLimit) && resolvedLimit > 0 && (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-caption font-bold text-kiwi-700">
            <Sparkles size={13} strokeWidth={2.6} />
            {t("grammar.practice.problemCountPreview", { count: resolvedLimit })}
          </p>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        leftIcon={<Play size={18} fill="currentColor" />}
        disabled={!canStart}
        onClick={handleStart}
      >
        {t("grammar.practice.startCta")}
      </Button>
    </Sheet>
  );
}
