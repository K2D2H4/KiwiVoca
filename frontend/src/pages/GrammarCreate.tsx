// 문법 만들기 — 방식(직접/사진/AI) → 입력 → (Gemini 추출/생성) → 항목 검수/편집 → 커밋.
// 연습문제는 연습 시 즉석 생성되므로 여기서는 "항목"(point/explanation/example/level/category)만 다룬다.
// 진입 시 ?method= 로 방식 결정(통합 만들기 시트에서 전달). direct 면 빈 항목부터 바로 검수.
// 모바일 우선: 풀폭 스텝, 카메라 업로드, 바텀 sticky 저장 바, 커밋은 바텀시트.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Camera,
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
import {
  useExtractGrammar,
  useGenerateGrammar,
  useCommitGrammar,
} from "../hooks/useGrammar";
import type {
  GrammarCommitPayload,
  GrammarItemCandidate,
} from "../types/grammar";

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB / 장

// 항목에 안정적인 key 부여 (리스트 재렌더 안정성)
let seq = 0;
const nextKey = () => `g${seq++}`;

// 검수 단계 드래프트 — 항목만(연습문제 없음)
interface DraftItem {
  _key: string;
  point: string;
  explanation: string;
  example: string;
  level: string;
  category: string;
}

type Method = "direct" | "photo" | "ai";
type Step = "input" | "review";

// 후보 → 드래프트(키 부여). 백엔드가 problems 없이 항목만 반환.
const toDraft = (c: GrammarItemCandidate): DraftItem => ({
  _key: nextKey(),
  point: c.point ?? "",
  explanation: c.explanation ?? "",
  example: c.example ?? "",
  level: c.level ?? "",
  category: c.category ?? "",
});

const emptyItem = (): DraftItem => ({
  _key: nextKey(),
  point: "",
  explanation: "",
  example: "",
  level: "",
  category: "",
});

export default function GrammarCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const presetDeck = params.get("deck") ?? "";
  const method: Method = ((): Method => {
    const m = params.get("method");
    return m === "photo" || m === "direct" || m === "ai" ? m : "ai";
  })();

  // 직접 입력은 입력 스텝 없이 빈 항목으로 바로 검수
  const [step, setStep] = useState<Step>(method === "direct" ? "review" : "input");

  // 공통 언어 설정 — URL 파라미터 우선, 없으면 마지막 사용 언어쌍 복원
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

  // 사진 입력
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // AI 입력
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);

  // 검수 항목 — 직접 입력이면 빈 항목 하나로 시작
  const [items, setItems] = useState<DraftItem[]>(
    method === "direct" ? [emptyItem()] : []
  );

  // 커밋 시트
  const [commitOpen, setCommitOpen] = useState(false);
  const [target, setTarget] = useState<"new" | "existing">(
    presetDeck ? "existing" : "new"
  );
  const [newTitle, setNewTitle] = useState("");
  const [existingDeckId, setExistingDeckId] = useState(presetDeck);

  const extract = useExtractGrammar();
  const generate = useGenerateGrammar();
  const commit = useCommitGrammar();
  const { data: decks } = useDecks();
  // 기존 덱 선택지는 문법 덱만
  const grammarDecks = (decks ?? []).filter((d) => d.kind === "grammar");

  const loading = extract.isPending || generate.isPending;

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

  // 추출/생성 실행 → 검수로
  const onRun = async () => {
    try {
      const res =
        method === "photo"
          ? await extract.mutateAsync({
              files,
              lang_term: langTerm,
              lang_def: langDef,
            })
          : await generate.mutateAsync({
              lang_term: langTerm,
              lang_def: langDef,
              level: level.trim(),
              topic: topic.trim() || undefined,
              count,
            });
      const drafts = (res.candidates ?? []).map(toDraft);
      // 결과가 비면 빈 항목 하나로 검수 진입 (직접 보완 가능)
      setItems(drafts.length > 0 ? drafts : [emptyItem()]);
      setStep("review");
    } catch {
      toast.error(
        method === "photo"
          ? t("import.extractError")
          : t("grammar.generateError")
      );
    }
  };

  // ── 항목 편집 헬퍼 ──────────────────────────────────────────
  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...patch } : it))
    );
  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((it) => it._key !== key));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  // 커밋 가능한 항목 정규화 (백엔드 검증과 일치 — point/explanation 필수)
  const validItems: GrammarItemCandidate[] = items
    .map((it) => ({
      point: it.point.trim(),
      explanation: it.explanation.trim(),
      example: it.example.trim() || undefined,
      level: it.level.trim(),
      category: it.category.trim(),
      problems: [], // 연습문제는 연습 시 생성 — 커밋엔 빈 배열
    }))
    .filter((it) => it.point && it.explanation);

  const canCommit =
    validItems.length > 0 &&
    !commit.isPending &&
    (target === "new" ? newTitle.trim().length > 0 : existingDeckId.length > 0);

  const onCommit = async () => {
    if (!canCommit) return;
    const payload: GrammarCommitPayload =
      target === "new"
        ? {
            new_deck: {
              title: newTitle.trim(),
              lang_term: langTerm,
              lang_def: langDef,
            },
            items: validItems,
          }
        : { deck_id: existingDeckId, items: validItems };
    try {
      const res = await commit.mutateAsync(payload);
      const deckId =
        res.deck?.id ?? (target === "existing" ? existingDeckId : "");
      navigate(`/decks/${deckId}`, {
        replace: true,
        state: { grammarImported: res.item_count },
      });
    } catch {
      toast.error(t("import.commitError"));
    }
  };

  // ── 추출/생성 로딩 ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[100dvh] md:min-h-0">
        <PageHeader title={t("grammar.addTitle")} />
        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <KiwiBuddy mood="sleepy" size={104} float />
          <p className="mt-7 font-display text-lg font-bold text-seed">
            {method === "photo" ? t("grammar.extracting") : t("grammar.generating")}
          </p>
          <p className="mt-1.5 text-body-sm text-seed/55">
            {t("import.extractingHint")}
          </p>
          <div className="mt-8 w-full max-w-sm space-y-3">
            {[90, 70, 80].map((w, i) => (
              <Skeleton key={i} className="h-10" rounded="lg" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const onBack = () => {
    // 직접 입력은 입력 스텝이 없으므로 검수에서 바로 뒤로
    if (step === "review" && method !== "direct") setStep("input");
    else navigate(-1);
  };

  return (
    <div className="min-h-[100dvh] md:min-h-0">
      <PageHeader title={t("grammar.addTitle")} onBack={onBack} />

      <div className="mx-auto max-w-screen-sm">
        {step === "input" && (
          <InputStep
            method={method === "direct" ? "ai" : method}
            langTerm={langTerm}
            langDef={langDef}
            onLangTerm={updateLangTerm}
            onLangDef={updateLangDef}
            // photo
            previews={previews}
            fileCount={files.length}
            fileError={fileError}
            onPickFiles={onPick}
            onRemoveFile={removeFile}
            // ai
            level={level}
            topic={topic}
            count={count}
            onLevel={setLevel}
            onTopic={setTopic}
            onCount={setCount}
            // run
            onRun={onRun}
          />
        )}

        {step === "review" && (
          <ReviewStep
            items={items}
            validCount={validItems.length}
            onPatchItem={patchItem}
            onRemoveItem={removeItem}
            onAddItem={addItem}
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
        decks={grammarDecks}
        itemCount={validItems.length}
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

// ── 스텝 1: 입력 (사진 / AI) ────────────────────────────────
function InputStep(props: {
  method: "photo" | "ai";
  langTerm: string;
  langDef: string;
  onLangTerm: (v: string) => void;
  onLangDef: (v: string) => void;
  previews: string[];
  fileCount: number;
  fileError: string | null;
  onPickFiles: (f: FileList | null) => void;
  onRemoveFile: (i: number) => void;
  level: string;
  topic: string;
  count: number;
  onLevel: (v: string) => void;
  onTopic: (v: string) => void;
  onCount: (v: number) => void;
  onRun: () => void;
}) {
  const { t } = useTranslation();
  const {
    method,
    langTerm,
    langDef,
    onLangTerm,
    onLangDef,
    previews,
    fileCount,
    fileError,
    onPickFiles,
    onRemoveFile,
    level,
    topic,
    count,
    onLevel,
    onTopic,
    onCount,
    onRun,
  } = props;

  const canRun = method === "photo" ? fileCount > 0 : level.trim().length > 0;

  return (
    <div className="space-y-5 px-5 pt-5">
      {method === "photo" ? (
        <PhotoInput
          previews={previews}
          fileCount={fileCount}
          fileError={fileError}
          onPick={onPickFiles}
          onRemove={onRemoveFile}
        />
      ) : (
        <AiInput
          level={level}
          topic={topic}
          count={count}
          onLevel={onLevel}
          onTopic={onTopic}
          onCount={onCount}
        />
      )}

      {/* 언어 설정 */}
      <Card padding="sm">
        <p className="mb-3 text-caption font-bold uppercase tracking-wide text-kiwi-700">
          {t("grammar.langSettings")}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            id="gr-lang-term"
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
            id="gr-lang-def"
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
          leftIcon={method === "ai" ? <Sparkles size={18} /> : undefined}
          disabled={!canRun}
          onClick={onRun}
        >
          {method === "photo"
            ? fileCount === 0
              ? t("import.extractCtaEmpty")
              : t("import.extractCta", { count: fileCount })
            : t("grammar.generateCta")}
        </Button>
      </div>
      <div className="h-2" />
    </div>
  );
}

// 사진 입력 — 드롭존/썸네일 + 카메라/갤러리 (import 패턴 재사용)
function PhotoInput({
  previews,
  fileCount,
  fileError,
  onPick,
  onRemove,
}: {
  previews: string[];
  fileCount: number;
  fileError: string | null;
  onPick: (f: FileList | null) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <p className="text-body-sm text-seed/60">{t("grammar.photoIntro")}</p>

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

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          leftIcon={<Camera size={18} />}
          onClick={() => cameraRef.current?.click()}
        >
          {t("import.takePhoto")}
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          leftIcon={<ImageIcon size={18} />}
          onClick={() => inputRef.current?.click()}
        >
          {t("import.fromGallery")}
        </Button>
      </div>

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
    </div>
  );
}

// AI 입력 — 레벨/주제/개수
function AiInput({
  level,
  topic,
  count,
  onLevel,
  onTopic,
  onCount,
}: {
  level: string;
  topic: string;
  count: number;
  onLevel: (v: string) => void;
  onTopic: (v: string) => void;
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
      <p className="text-body-sm text-seed/60">{t("grammar.aiIntro")}</p>

      <div>
        <TextField
          label={t("grammar.fieldLevel")}
          value={level}
          onChange={(e) => onLevel(e.target.value)}
          placeholder={t("grammar.levelPlaceholder")}
          maxLength={50}
        />
        {/* 레벨 빠른 선택 칩 */}
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVEL_PRESETS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => onLevel(lv)}
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

      <TextField
        label={t("grammar.fieldTopic")}
        value={topic}
        onChange={(e) => onTopic(e.target.value)}
        placeholder={t("grammar.topicPlaceholder")}
        maxLength={200}
      />

      <div>
        <p className="mb-1.5 text-caption font-bold uppercase tracking-wide text-seed/50">
          {t("grammar.fieldCount")}
        </p>
        <SegmentedControl<string>
          layoutId="grammar-count"
          ariaLabel={t("grammar.fieldCount")}
          value={String(count)}
          onChange={(v) => onCount(Number(v))}
          segments={[3, 5, 8, 10].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
      </div>
    </div>
  );
}

// ── 스텝 2: 검수 (항목만) ────────────────────────────────────
function ReviewStep({
  items,
  validCount,
  onPatchItem,
  onRemoveItem,
  onAddItem,
  onContinue,
}: {
  items: DraftItem[];
  validCount: number;
  onPatchItem: (key: string, patch: Partial<DraftItem>) => void;
  onRemoveItem: (key: string) => void;
  onAddItem: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="px-5 pt-6">
        <Card padding="md">
          <EmptyState
            mood="sad"
            title={t("grammar.emptyTitle")}
            description={t("grammar.emptyHint")}
            action={
              <Button variant="primary" size="lg" fullWidth onClick={onAddItem}>
                {t("grammar.addItem")}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div className="mb-3">
        <h2 className="font-display text-base font-bold text-seed">
          {t("grammar.reviewTitle")}
        </h2>
        <p className="text-caption text-seed/55">
          {t("grammar.reviewHint", { count: items.length })}
        </p>
      </div>

      <ul className="space-y-3 pb-4">
        {items.map((it, i) => (
          <ItemEditor
            key={it._key}
            item={it}
            index={i}
            onPatch={onPatchItem}
            onRemove={onRemoveItem}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddItem}
        className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-kiwi-300 text-body-sm font-bold text-kiwi-700 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-kiwi-400"
      >
        <Plus size={18} strokeWidth={2.4} />
        {t("grammar.addItem")}
      </button>

      {/* 스티키 저장 바가 마지막 항목을 가리지 않도록 여백 */}
      <div className="h-24" />

      {/* 하단 저장 바 — 단어 import와 동일 패턴 */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-raised md:bottom-0">
        <div className="border-t border-border bg-surface/95 px-5 pb-3 pt-3 shadow-[0_-6px_20px_rgba(46,58,36,0.08)] backdrop-blur md:pb-3">
          <div className="mx-auto flex max-w-screen-sm items-center gap-3">
            <div className="min-w-0 shrink-0">
              <p className="font-display text-h3 font-bold leading-none text-seed">
                {validCount}
              </p>
              <p className="mt-0.5 text-caption font-bold text-seed/45">
                {t("grammar.saveBarCount")}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={validCount === 0}
              onClick={onContinue}
            >
              {t("grammar.continueCta", { count: validCount })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 문법 항목 편집 카드 — point/explanation/example/level/category (연습문제 없음)
function ItemEditor({
  item,
  index,
  onPatch,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  onPatch: (key: string, patch: Partial<DraftItem>) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  const incomplete = !item.point.trim() || !item.explanation.trim();

  return (
    <li>
      <Card padding="sm" className={incomplete ? "ring-2 ring-warning/45" : undefined}>
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
              onClick={() => onRemove(item._key)}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
        </div>

        <div className="space-y-2">
          <TextField
            value={item.point}
            onChange={(e) => onPatch(item._key, { point: e.target.value })}
            placeholder={t("grammar.fieldPoint") + " *"}
          />
          <textarea
            value={item.explanation}
            onChange={(e) => onPatch(item._key, { explanation: e.target.value })}
            placeholder={t("grammar.fieldExplanation") + " *"}
            rows={2}
            className="w-full resize-y rounded-2xl border-2 border-transparent bg-cream/70 px-4 py-3 text-base text-seed placeholder:text-seed/30 shadow-inner-soft transition focus:border-kiwi focus:bg-surface focus:outline-none"
          />
          <TextField
            value={item.example}
            onChange={(e) => onPatch(item._key, { example: e.target.value })}
            placeholder={t("grammar.fieldExample")}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextField
              value={item.level}
              onChange={(e) => onPatch(item._key, { level: e.target.value })}
              placeholder={t("grammar.fieldLevel")}
            />
            <TextField
              value={item.category}
              onChange={(e) => onPatch(item._key, { category: e.target.value })}
              placeholder={t("grammar.fieldCategory")}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}

// ── 커밋 선택 바텀시트 ───────────────────────────────────────
function CommitSheet({
  open,
  target,
  newTitle,
  existingDeckId,
  decks,
  itemCount,
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
  decks: { id: string | number; title: string }[];
  itemCount: number;
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
      title={t("grammar.saveTitle")}
      ariaLabel={t("grammar.saveTitle")}
    >
      <p className="-mt-1 text-body-sm text-seed/55">
        {t("grammar.saveSubtitle", { count: itemCount })}
      </p>

      <div className="mt-4">
        <SegmentedControl<"new" | "existing">
          layoutId="grammar-commit-target"
          ariaLabel={t("grammar.saveTitle")}
          value={target}
          onChange={onTarget}
          segments={[
            { value: "new", label: t("grammar.saveAsNew") },
            { value: "existing", label: t("grammar.addToExisting") },
          ]}
        />
      </div>

      <div className="mt-3">
        {target === "new" ? (
          <TextField
            value={newTitle}
            onChange={(e) => onNewTitle(e.target.value)}
            placeholder={t("grammar.deckTitlePlaceholder")}
            maxLength={80}
            autoFocus
          />
        ) : decks.length > 0 ? (
          <Select
            value={existingDeckId}
            onChange={(e) => onExistingDeck(e.target.value)}
          >
            <option value="" disabled>
              {t("grammar.selectDeck")}
            </option>
            {decks.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.title}
              </option>
            ))}
          </Select>
        ) : (
          <p className="rounded-2xl bg-cream px-4 py-3 text-body-sm font-bold text-seed/50">
            {t("grammar.noDecks")}
          </p>
        )}
      </div>

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
