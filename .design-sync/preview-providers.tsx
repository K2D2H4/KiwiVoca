// Preview-only provider wrapper for design-sync cards.
// A few KiwiVoca primitives (Sheet, ConfirmSheet, SpeakButton) call
// react-i18next's useTranslation; without an i18n instance their labels render
// as raw keys. This initialises i18next with the app's real Korean locale
// (the app is Korean-first: index.html lang="ko", fallbackLng "ko") so cards
// show the genuine labels. Wired via cfg.provider + cfg.extraEntries.
import { type ReactNode } from "react";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import ko from "../frontend/src/i18n/locales/ko/common.json";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "ko",
    fallbackLng: "ko",
    resources: { ko: { common: ko } },
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function PreviewProviders({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
