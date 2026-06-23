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
