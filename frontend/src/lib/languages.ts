// 덱 생성 시 선택 가능한 언어 목록 + 코드→라벨 매핑
// 라벨은 각 언어 자국어 표기 (UI 언어와 무관하게 일관)
export interface LangOption {
  code: string;
  label: string;
}

export const LANG_OPTIONS: LangOption[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "vi", label: "Tiếng Việt" },
];

const LABEL_MAP = new Map(LANG_OPTIONS.map((l) => [l.code, l.label]));

// 코드 → 짧은 라벨 (덱 카드 뱃지용). 미등록 코드는 대문자 코드 표시.
export function langLabel(code: string): string {
  return LABEL_MAP.get(code) ?? code.toUpperCase();
}

// ── 마지막 사용 언어쌍 기억 ──────────────────────────────────
// 사진/AI 생성 화면(단어·문법)에서 마지막으로 고른 학습언어(term)/모국어(def)를
// localStorage에 저장해, 다음 생성 시 기본값으로 복원한다.
const LAST_LANG_KEY = "kiwivoca.lastLangPair";
const DEFAULT_LANG_TERM = "en";
const DEFAULT_LANG_DEF = "ko";

export interface LangPair {
  term: string;
  def: string;
}

// 저장된 값 → 기본값(en/ko) 순으로 복원. SSR/접근 불가 환경은 기본값.
export function getLastLangPair(): LangPair {
  try {
    const raw = localStorage.getItem(LAST_LANG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LangPair>;
      if (typeof parsed.term === "string" && typeof parsed.def === "string") {
        return { term: parsed.term, def: parsed.def };
      }
    }
  } catch {
    // 파싱 실패/접근 불가 시 기본값 fallback
  }
  return { term: DEFAULT_LANG_TERM, def: DEFAULT_LANG_DEF };
}

// 현재 선택을 기억 (생성 화면에서 언어 변경 시 호출).
export function saveLastLangPair(term: string, def: string): void {
  try {
    localStorage.setItem(LAST_LANG_KEY, JSON.stringify({ term, def }));
  } catch {
    // 저장 실패는 무시 (기능 비핵심)
  }
}
