// i18next 초기화 — 키위보카 다국어(ko 기본, en/ru/ja)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ko from "./locales/ko/common.json";
import en from "./locales/en/common.json";
import ru from "./locales/ru/common.json";
import ja from "./locales/ja/common.json";

export const SUPPORTED_LANGS = ["ko", "en", "ru", "ja"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

// 언어 토글 표시용 라벨 (각 언어의 자국어 표기)
export const LANG_LABELS: Record<SupportedLang, string> = {
  ko: "한국어",
  en: "EN",
  ru: "RU",
  ja: "日本語",
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { common: ko },
      en: { common: en },
      ru: { common: ru },
      ja: { common: ja },
    },
    fallbackLng: "ko",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: "common",
    ns: ["common"],
    detection: {
      // localStorage 우선 → 브라우저 언어 순으로 감지, 선택값은 localStorage에 저장
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "kiwivoca.lang",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // React가 XSS 이스케이프 처리
    },
    returnNull: false,
  });

export default i18n;
