// 단어장 추가 — 사진 추출 또는 테마 AI 생성 → (Gemini 로딩) → 검수/편집 → 커밋.
// 진입 시 ?method=photo|ai (통합 만들기 시트에서 전달, 기본 photo).
// 모바일 우선: 풀폭 스텝, 카메라 업로드, 바텀 sticky CTA, 커밋은 바텀시트.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import KiwiBuddy from "../components/KiwiBuddy";
import {
  Button,
  IconButton,
  TextField,
  Select,
  SegmentedControl,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  Sheet,
  useToast,
} from "../components/ui";
import { LANG_OPTIONS, getLastLangPair, saveLastLangPair } from "../lib/languages";
import { useDecks } from "../hooks/useDecks";
import { useExtract, useGenerateVocab, useCommit } from "../hooks/useImport";
import type { DeckKind } from "../types/deck";
import type { CommitCard, CommitPayload, ExtractCandidate } from "../types/import";

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB / 장

// 검수 단계에서 행에 안정적인 key를 주기 위한 래퍼
interface DraftRow extends ExtractCandidate {
  _key: string;
}

let rowSeq = 0;
const nextKey = () => `r${rowSeq++}`;

type Step = "upload" | "review";
type Method = "photo" | "ai";

export default function ImportPhoto() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const presetDeck = params.get("deck") ?? "";
  const method: Method = params.get("method") === "ai" ? "ai" : "photo";

  const [step, setStep] = useState<Step>("upload");

  // 스텝1: 파일 + 설정
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // URL 파라미터 우선, 없으면 마지막 사용 언어쌍 복원
  const lastLang = getLastLangPair();
  const [langTerm, setLangTerm] = useState(params.get("lang_term") || lastLang.term);
  const [langDef, setLangDef] = useState(params.get("lang_def") || lastLang.def);
  // 언어 변경 시 마지막 사용 언어쌍으로 기억
  const updateLangTerm = (v: string) => {
    setLangTerm(v);
    saveLastLangPair(v, langDef);
  };
  const updateLangDef = (v: string) => {
    setLangDef(v);
    saveLastLangPair(langTerm, v);
  };
  // 이 화면은 단어(vocab) 전용 — grammar 진입은 아래 effect에서 /grammar/new로 리다이렉트
  const kind: DeckKind = "vocab";
  const [fileError, setFileError] = useState<string | null>(null);

  // AI 생성 입력 (테마/레벨/개수)
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState("");
  const [count, setCount] = useState(10);

  // 스텝2: 후보 행
  const [rows, setRows] = useState<DraftRow[]>([]);

  // 스텝3: 커밋 선택 시트
  const [commitOpen, setCommitOpen] = useState(false);
  const [target, setTarget] = useState<"new" | "existing">(
    presetDeck ? "existing" : "new"
  );
  const [newTitle, setNewTitle] = useState("");
  const [existingDeckId, setExistingDeckId] = useState(presetDeck);

  const extract = useExtract();
  const generate = useGenerateVocab();
  const commit = useCommit();
  const { data: decks } = useDecks();

  // grammar 덱에 카드가 들어가는 경로 차단 — kind=grammar로 들어오면 문법 생성으로 보냄
  useEffect(() => {
    if (params.get("kind") === "grammar") {
      const search = new URLSearchParams();
      if (presetDeck) search.set("deck", presetDeck);
      search.set("lang_term", langTerm);
      search.set("lang_def", langDef);
      navigate(`/grammar/new?${search.toString()}`, { replace: true });
    }
    // 진입 시 1회 판정 — 마운트 시점의 값 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // objectURL 미리보기 — 파일 변경 시 재생성, 언마운트 시 revoke
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const onPick = (picked: FileList | null) => {
    if (!picked) return;
    setFileError(null);
    const incoming = Array.from(picked);
    const valid: File[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) {
        setFileError(t("import.errNotImage"));
        continue;
      }
      if (f.size > MAX_BYTES) {
        setFileError(t("import.errTooLarge"));
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) {
        setFileError(t("import.errTooMany", { max: MAX_FILES }));
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  // 사진 추출 또는 AI 생성 — 후보를 받아 검수 행으로 변환
  const toRows = (candidates: ExtractCandidate[]) =>
    candidates.map((c) => ({
      _key: nextKey(),
      term: c.term ?? "",
      reading: c.reading ?? "",
      definition: c.definition ?? "",
      example: c.example ?? "",
    }));

  const onRun = async () => {
    try {
      if (method === "ai") {
        if (theme.trim().length === 0) return;
        const res = await generate.mutateAsync({
          lang_term: langTerm,
          lang_def: langDef,
          theme: theme.trim(),
          level: level.trim() || undefined,
          count,
        });
        setRows(toRows(res.candidates ?? []));
      } else {
        if (files.length === 0) return;
        const res = await extract.mutateAsync({
          files,
          lang_term: langTerm,
          lang_def: langDef,
          kind,
        });
        setRows(toRows(res.candidates ?? []));
      }
      setStep("review");
    } catch {
      toast.error(method === "ai" ? t("import.generateError") : t("import.extractError"));
    }
  };

  const updateRow = (key: string, patch: Partial<ExtractCandidate>) =>
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...patch } : r))
    );
  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r._key !== key));
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { _key: nextKey(), term: "", reading: "", definition: "", example: "" },
    ]);

  // 커밋 가능한 행 (term + definition 채워진 것만)
  const validCards: CommitCard[] = rows
    .filter((r) => r.term.trim() && r.definition.trim())
    .map((r) => ({
      term: r.term.trim(),
      reading: r.reading?.trim() || undefined,
      definition: r.definition.trim(),
      example: r.example?.trim() || undefined,
    }));

  const canCommit =
    validCards.length > 0 &&
    !commit.isPending &&
    (target === "new"
      ? newTitle.trim().length > 0
      : existingDeckId.length > 0);

  const onCommit = async () => {
    if (!canCommit) return;
    const payload: CommitPayload =
      target === "new"
        ? {
            new_deck: {
              title: newTitle.trim(),
              lang_term: langTerm,
              lang_def: langDef,
              kind,
            },
            cards: validCards,
          }
        : { deck_id: existingDeckId, cards: validCards };
    try {
      const res = await commit.mutateAsync(payload);
      const deckId =
        res.deck?.id ?? (target === "existing" ? existingDeckId : "");
      navigate(`/decks/${deckId}`, {
        replace: true,
        state: { imported: validCards.length },
      });
    } catch {
      toast.error(t("import.commitError"));
    }
  };

  // ── 추출/생성 로딩 ─────────────────────────────────────────
  if (extract.isPending || generate.isPending) {
    return (
      <div className="min-h-[100dvh] md:min-h-0">
        <PageHeader title={method === "ai" ? t("import.aiTitle") : t("import.title")} />
        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <KiwiBuddy mood="sleepy" size={104} float />
          <p className="mt-7 font-display text-lg font-bold text-seed">
            {method === "ai" ? t("import.generating") : t("import.extracting")}
          </p>
          <p className="mt-1.5 text-body-sm text-seed/55">
            {t("import.extractingHint")}
          </p>
          <div className="mt-8 w-full max-w-sm space-y-3">
            {[90, 70, 80].map((w, i) => (
              <Skeleton
                key={i}
                className="h-10"
                rounded="lg"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] md:min-h-0">
      <PageHeader
        title={method === "ai" ? t("import.aiTitle") : t("import.title")}
        onBack={() => (step === "review" ? setStep("upload") : navigate(-1))}
      />

      {/* 스텝 표시 — 씨앗 점 진행바 */}
      <div className="mx-auto flex max-w-screen-sm items-center justify-center gap-2 px-5 pt-4">
        <StepDot active={step === "upload"} done={step === "review"} n={1} />
        <span
          className={[
            "h-0.5 w-10 rounded-full transition-colors",
            step === "review" ? "bg-kiwi" : "bg-ink-200",
          ].join(" ")}
        />
        <StepDot active={step === "review"} done={false} n={2} />
      </div>

      <div className="mx-auto max-w-screen-sm">
        {step === "upload" ? (
          <UploadStep
            method={method}
            previews={previews}
            fileCount={files.length}
            fileError={fileError}
            langTerm={langTerm}
            langDef={langDef}
            theme={theme}
            level={level}
            count={count}
            onPick={onPick}
            onRemove={removeFile}
            onLangTerm={updateLangTerm}
            onLangDef={updateLangDef}
            onTheme={setTheme}
            onLevel={setLevel}
            onCount={setCount}
            onRun={onRun}
          />
        ) : (
          <ReviewStep
            rows={rows}
            validCount={validCards.length}
            onUpdate={updateRow}
            onRemove={removeRow}
            onAdd={addRow}
            onRetake={() => {
              setRows([]);
              setStep("upload");
            }}
            onContinue={() => setCommitOpen(true)}
          />
        )}
      </div>

      {/* 커밋 선택 바텀시트 */}
      <CommitSheet
        open={commitOpen}
        target={target}
        newTitle={newTitle}
        existingDeckId={existingDeckId}
        decks={decks}
        cardCount={validCards.length}
        loading={commit.isPending}
        canCommit={canCommit}
        onTarget={setTarget}
        onNewTitle={setNewTitle}
        onExistingDeck={setExistingDeckId}
        onCancel={() => setCommitOpen(false)}
        onConfirm={onCommit}
      />
    </div>
  );
}

// ── 스텝 점 ─────────────────────────────────────────────────
function StepDot({
  active,
  done,
  n,
}: {
  active: boolean;
  done: boolean;
  n: number;
}) {
  return (
    <span
      className={[
        "flex h-7 w-7 items-center justify-center rounded-full text-caption font-bold transition",
        active
          ? "bg-kiwi text-white shadow-kiwi-glow"
          : done
            ? "bg-kiwi-100 text-kiwi-700"
            : "bg-ink-100 text-seed/40",
      ].join(" ")}
    >
      {done ? <Check size={15} strokeWidth={3} /> : n}
    </span>
  );
}

// ── 스텝 1: 업로드(사진) / 테마 입력(AI) ────────────────────
function UploadStep({
  method,
  previews,
  fileCount,
  fileError,
  langTerm,
  langDef,
  theme,
  level,
  count,
  onPick,
  onRemove,
  onLangTerm,
  onLangDef,
  onTheme,
  onLevel,
  onCount,
  onRun,
}: {
  method: Method;
  previews: string[];
  fileCount: number;
  fileError: string | null;
  langTerm: string;
  langDef: string;
  theme: string;
  level: string;
  count: number;
  onPick: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  onLangTerm: (v: string) => void;
  onLangDef: (v: string) => void;
  onTheme: (v: string) => void;
  onLevel: (v: string) => void;
  onCount: (v: number) => void;
  onRun: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const isAi = method === "ai";
  const canRun = isAi ? theme.trim().length > 0 : fileCount > 0;

  return (
    <div className="space-y-5 px-5 pt-5">
      <p className="text-body-sm text-seed/60">
        {isAi ? t("import.aiIntro") : t("import.uploadIntro")}
      </p>

      {isAi ? (
        <AiVocabInput
          theme={theme}
          level={level}
          count={count}
          onTheme={onTheme}
          onLevel={onLevel}
          onCount={onCount}
        />
      ) : (
        <PhotoArea
          inputRef={inputRef}
          cameraRef={cameraRef}
          previews={previews}
          fileCount={fileCount}
          fileError={fileError}
          onPick={onPick}
          onRemove={onRemove}
        />
      )}

      {/* 학습 설정 — AI(테마)는 단어 전용이라 kind 토글 숨김 */}
      <Card padding="sm">
        <p className="mb-3 text-caption font-bold uppercase tracking-wide text-kiwi-700">
          {t("import.settings")}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            id="imp-lang-term"
            label={t("deck.fieldLangTerm")}
            value={langTerm}
            onChange={(e) => onLangTerm(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
          <Select
            id="imp-lang-def"
            label={t("deck.fieldLangDef")}
            value={langDef}
            onChange={(e) => onLangDef(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* 실행 CTA — sticky */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-raised pt-1 md:static md:bottom-auto">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={isAi ? <Sparkles size={18} /> : undefined}
          disabled={!canRun}
          onClick={onRun}
        >
          {isAi
            ? t("import.generateCta")
            : fileCount === 0
              ? t("import.extractCtaEmpty")
              : t("import.extractCta", { count: fileCount })}
        </Button>
      </div>
      <div className="h-2" />
    </div>
  );
}

// 테마 기반 단어 AI 입력 — 테마(필수) + 레벨(선택) + 개수
function AiVocabInput({
  theme,
  level,
  count,
  onTheme,
  onLevel,
  onCount,
}: {
  theme: string;
  level: string;
  count: number;
  onTheme: (v: string) => void;
  onLevel: (v: string) => void;
  onCount: (v: number) => void;
}) {
  const { t } = useTranslation();
  const LEVEL_PRESETS = [
    t("grammar.levelBeginner"),
    t("grammar.levelIntermediate"),
    t("grammar.levelAdvanced"),
  ];
  return (
    <div className="space-y-4">
      <TextField
        label={t("import.fieldTheme")}
        value={theme}
        onChange={(e) => onTheme(e.target.value)}
        placeholder={t("import.themePlaceholder")}
        maxLength={80}
        autoFocus
      />

      <div>
        <TextField
          label={t("import.fieldLevelOptional")}
          value={level}
          onChange={(e) => onLevel(e.target.value)}
          placeholder={t("grammar.levelPlaceholder")}
          maxLength={50}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVEL_PRESETS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => onLevel(level === lv ? "" : lv)}
              className={[
                "min-h-[36px] rounded-full px-3.5 text-caption font-bold transition active:scale-95",
                level === lv
                  ? "bg-kiwi text-white shadow-kiwi-glow"
                  : "bg-kiwi-50 text-kiwi-700 ring-1 ring-kiwi-200 hover:bg-kiwi-100",
              ].join(" ")}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-caption font-bold uppercase tracking-wide text-seed/50">
          {t("grammar.fieldCount")}
        </p>
        <SegmentedControl<string>
          layoutId="import-count"
          ariaLabel={t("grammar.fieldCount")}
          value={String(count)}
          onChange={(v) => onCount(Number(v))}
          segments={[5, 10, 15, 20].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
      </div>
    </div>
  );
}

// 사진 업로드 영역 — 드롭존/썸네일 + 카메라/갤러리
function PhotoArea({
  inputRef,
  cameraRef,
  previews,
  fileCount,
  fileError,
  onPick,
  onRemove,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  cameraRef: React.RefObject<HTMLInputElement>;
  previews: string[];
  fileCount: number;
  fileError: string | null;
  onPick: (f: FileList | null) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* 드롭존 / 썸네일 그리드 */}
      <div className="rounded-3xl border-2 border-dashed border-bark/30 bg-surface/60 p-4">
        {previews.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl py-8 text-center outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-kiwi-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-700">
              <ImageIcon size={28} />
            </span>
            <span className="font-display text-body font-bold text-seed">
              {t("import.pickPhotos")}
            </span>
            <span className="text-caption text-seed/45">
              {t("import.pickHint", { max: MAX_FILES })}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {previews.map((src, i) => (
              <div
                key={src}
                className="relative aspect-square overflow-hidden rounded-2xl bg-cream shadow-soft"
              >
                <img
                  src={src}
                  alt={t("import.thumbAlt", { n: i + 1 })}
                  className="h-full w-full object-cover"
                />
                <IconButton
                  label={t("import.removePhoto")}
                  onClick={() => onRemove(i)}
                  className="absolute right-1 top-1 h-11 w-11 bg-seed/60 text-white backdrop-blur hover:bg-seed/75"
                >
                  <X size={16} strokeWidth={3} />
                </IconButton>
              </div>
            ))}
            {/* 추가 타일 */}
            {fileCount < MAX_FILES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label={t("import.addMore")}
                className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-bark/30 text-bark outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-kiwi-400"
              >
                <Plus size={24} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 카메라 촬영 — 갤러리 선택은 위 드롭존/추가 타일과 중복이라 버튼 제거 */}
      <Button
        variant="secondary"
        size="md"
        fullWidth
        leftIcon={<Camera size={18} />}
        onClick={() => cameraRef.current?.click()}
      >
        {t("import.takePhoto")}
      </Button>

      {/* 숨은 input — 갤러리(multiple) + 카메라(capture) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />

      {fileError && (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-body-sm font-bold text-danger">
          {fileError}
        </p>
      )}
    </>
  );
}

// ── 스텝 2: 검수/편집 ────────────────────────────────────────
function ReviewStep({
  rows,
  validCount,
  onUpdate,
  onRemove,
  onAdd,
  onRetake,
  onContinue,
}: {
  rows: DraftRow[];
  validCount: number;
  onUpdate: (key: string, patch: Partial<ExtractCandidate>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onRetake: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();

  // 추출 0개 — 빈 상태 + 다시 시도
  if (rows.length === 0) {
    return (
      <div className="px-5 pt-6">
        <Card padding="md">
          <EmptyState
            mood="sad"
            title={t("import.emptyTitle")}
            description={t("import.emptyHint")}
            action={
              <Button variant="primary" size="lg" fullWidth onClick={onRetake}>
                {t("import.retake")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-seed">
            {t("import.reviewTitle")}
          </h2>
          <p className="truncate text-caption text-seed/55">
            {t("import.reviewHint", { count: rows.length })}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={onRetake}
        >
          {t("import.retake")}
        </Button>
      </div>

      <ul className="space-y-3 pb-4">
        {rows.map((row, i) => (
          <ReviewRow
            key={row._key}
            row={row}
            index={i}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </ul>

      {/* 행 추가 — 스크롤 영역 안 */}
      <button
        type="button"
        onClick={onAdd}
        className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-kiwi-300 text-body-sm font-bold text-kiwi-700 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-kiwi-400"
      >
        <Plus size={18} strokeWidth={2.4} />
        {t("import.addRow")}
      </button>

      {/* 스티키 저장 바가 마지막 행을 가리지 않도록 여백 확보 */}
      <div className="h-24" />

      {/* 항상 보이는 하단 저장 바 — 추출 개수 + 저장(다음). 스크롤 무관·탭바 위·safe-area */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-raised md:bottom-0">
        <div className="border-t border-border bg-surface/95 px-5 pb-3 pt-3 shadow-[0_-6px_20px_rgba(46,58,36,0.08)] backdrop-blur md:pb-3">
          <div className="mx-auto flex max-w-screen-sm items-center gap-3">
            {/* 추출/유효 개수 표시 */}
            <div className="min-w-0 shrink-0">
              <p className="font-display text-h3 font-bold leading-none text-seed">
                {validCount}
              </p>
              <p className="mt-0.5 text-caption font-bold text-seed/45">
                {t("import.saveBarCount")}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={validCount === 0}
              onClick={onContinue}
            >
              {t("import.continueCta", { count: validCount })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 검수 행 — term/reading/definition/example 인라인 편집
function ReviewRow({
  row,
  index,
  onUpdate,
  onRemove,
}: {
  row: DraftRow;
  index: number;
  onUpdate: (key: string, patch: Partial<ExtractCandidate>) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  // term 또는 definition 비면 "확인 필요" 강조
  const incomplete = !row.term.trim() || !row.definition.trim();

  return (
    <li>
      <Card
        padding="sm"
        className={incomplete ? "ring-2 ring-warning/45" : undefined}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-caption font-bold text-seed/40">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1">
            {incomplete && (
              <Badge tone="warning" size="sm">
                {t("import.needsCheck")}
              </Badge>
            )}
            <IconButton
              label={t("common.delete")}
              variant="ghost"
              className="text-seed/45 hover:bg-pop-soft hover:text-pop"
              onClick={() => onRemove(row._key)}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField
            value={row.term}
            onChange={(e) => onUpdate(row._key, { term: e.target.value })}
            placeholder={t("card.term") + " *"}
          />
          <TextField
            value={row.reading ?? ""}
            onChange={(e) => onUpdate(row._key, { reading: e.target.value })}
            placeholder={t("card.reading")}
          />
          <div className="sm:col-span-2">
            <TextField
              value={row.definition}
              onChange={(e) =>
                onUpdate(row._key, { definition: e.target.value })
              }
              placeholder={t("card.definition") + " *"}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              value={row.example ?? ""}
              onChange={(e) => onUpdate(row._key, { example: e.target.value })}
              placeholder={t("card.example")}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}

// ── 스텝 3: 커밋 선택 바텀시트 ───────────────────────────────
function CommitSheet({
  open,
  target,
  newTitle,
  existingDeckId,
  decks,
  cardCount,
  loading,
  canCommit,
  onTarget,
  onNewTitle,
  onExistingDeck,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  target: "new" | "existing";
  newTitle: string;
  existingDeckId: string;
  decks: { id: string | number; title: string }[] | undefined;
  cardCount: number;
  loading: boolean;
  canCommit: boolean;
  onTarget: (t: "new" | "existing") => void;
  onNewTitle: (v: string) => void;
  onExistingDeck: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={t("import.saveTitle")}
      ariaLabel={t("import.saveTitle")}
    >
      <p className="-mt-1 text-body-sm text-seed/55">
        {t("import.saveSubtitle", { count: cardCount })}
      </p>

      {/* 대상 토글 */}
      <div className="mt-4">
        <SegmentedControl<"new" | "existing">
          layoutId="commit-target"
          ariaLabel={t("import.saveTitle")}
          value={target}
          onChange={onTarget}
          segments={[
            { value: "new", label: t("import.saveAsNew") },
            { value: "existing", label: t("import.addToExisting") },
          ]}
        />
      </div>

      {/* 입력 영역 */}
      <div className="mt-3">
        {target === "new" ? (
          <TextField
            value={newTitle}
            onChange={(e) => onNewTitle(e.target.value)}
            placeholder={t("deck.titlePlaceholder")}
            maxLength={80}
            autoFocus
          />
        ) : decks && decks.length > 0 ? (
          <Select
            value={existingDeckId}
            onChange={(e) => onExistingDeck(e.target.value)}
          >
            <option value="" disabled>
              {t("import.selectDeck")}
            </option>
            {decks.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.title}
              </option>
            ))}
          </Select>
        ) : (
          <p className="rounded-2xl bg-cream px-4 py-3 text-body-sm font-bold text-seed/50">
            {t("import.noDecks")}
          </p>
        )}
      </div>

      {/* 액션 */}
      <div className="mt-5 flex gap-2.5">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!canCommit}
          onClick={onConfirm}
        >
          {t("import.saveCta")}
        </Button>
      </div>
    </Sheet>
  );
}
