// 사진으로 단어장 추가 — 3스텝: 업로드 → (Gemini 추출 로딩) → 검수/편집 → 커밋
// 모바일 우선: 풀폭 스텝, 카메라 업로드, 바텀 sticky CTA, 커밋은 바텀시트.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Check, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
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
import { LANG_OPTIONS } from "../lib/languages";
import { useDecks } from "../hooks/useDecks";
import { useExtract, useCommit } from "../hooks/useImport";
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

export default function ImportPhoto() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();

  const presetDeck = params.get("deck") ?? "";

  const [step, setStep] = useState<Step>("upload");

  // 스텝1: 파일 + 설정
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [langTerm, setLangTerm] = useState(params.get("lang_term") || "en");
  const [langDef, setLangDef] = useState(params.get("lang_def") || "ko");
  const [kind, setKind] = useState<DeckKind>(
    (params.get("kind") as DeckKind) || "vocab"
  );
  const [fileError, setFileError] = useState<string | null>(null);

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
  const commit = useCommit();
  const { data: decks } = useDecks();

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

  const onExtract = async () => {
    if (files.length === 0) return;
    try {
      const res = await extract.mutateAsync({
        files,
        lang_term: langTerm,
        lang_def: langDef,
        kind,
      });
      setRows(
        (res.candidates ?? []).map((c) => ({
          _key: nextKey(),
          term: c.term ?? "",
          reading: c.reading ?? "",
          definition: c.definition ?? "",
          example: c.example ?? "",
        }))
      );
      setStep("review");
    } catch {
      toast.error(t("import.extractError"));
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

  // ── 추출 로딩 ──────────────────────────────────────────────
  if (extract.isPending) {
    return (
      <div className="min-h-[100dvh]">
        <PageHeader title={t("import.title")} />
        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <KiwiBuddy mood="sleepy" size={104} float />
          <p className="mt-7 font-display text-lg font-bold text-seed">
            {t("import.extracting")}
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
    <div className="min-h-[100dvh]">
      <PageHeader
        title={t("import.title")}
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
            previews={previews}
            fileCount={files.length}
            fileError={fileError}
            langTerm={langTerm}
            langDef={langDef}
            kind={kind}
            onPick={onPick}
            onRemove={removeFile}
            onLangTerm={setLangTerm}
            onLangDef={setLangDef}
            onKind={setKind}
            onExtract={onExtract}
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

// ── 스텝 1: 업로드 ───────────────────────────────────────────
function UploadStep({
  previews,
  fileCount,
  fileError,
  langTerm,
  langDef,
  kind,
  onPick,
  onRemove,
  onLangTerm,
  onLangDef,
  onKind,
  onExtract,
}: {
  previews: string[];
  fileCount: number;
  fileError: string | null;
  langTerm: string;
  langDef: string;
  kind: DeckKind;
  onPick: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  onLangTerm: (v: string) => void;
  onLangDef: (v: string) => void;
  onKind: (k: DeckKind) => void;
  onExtract: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5 px-5 pt-5">
      <p className="text-body-sm text-seed/60">{t("import.uploadIntro")}</p>

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

      {/* 카메라 촬영 + 갤러리 선택 */}
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
        <p className="rounded-2xl bg-pop-soft px-4 py-3 text-body-sm font-bold text-pop-dark">
          {fileError}
        </p>
      )}

      {/* 학습 설정 */}
      <Card padding="sm">
        <p className="mb-3 text-caption font-bold uppercase tracking-wide text-kiwi-700">
          {t("import.settings")}
        </p>
        <div className="mb-3">
          <SegmentedControl<DeckKind>
            layoutId="import-kind"
            ariaLabel={t("deck.fieldKind")}
            value={kind}
            onChange={onKind}
            segments={[
              { value: "vocab", label: t("deck.kindVocab") },
              { value: "grammar", label: t("deck.kindGrammar") },
            ]}
          />
        </div>
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

      {/* 추출 CTA — sticky */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-raised pt-1 md:static md:bottom-auto">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={fileCount === 0}
          onClick={onExtract}
        >
          {fileCount === 0
            ? t("import.extractCtaEmpty")
            : t("import.extractCta", { count: fileCount })}
        </Button>
      </div>
      <div className="h-2" />
    </div>
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
        className={incomplete ? "ring-2 ring-pop/45" : undefined}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-caption font-bold text-seed/40">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1">
            {incomplete && (
              <Badge tone="pop" size="sm">
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
