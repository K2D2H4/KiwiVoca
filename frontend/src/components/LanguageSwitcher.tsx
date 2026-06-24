// 언어 토글 — SegmentedControl 프리미티브 기반. i18n.changeLanguage 호출.
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, LANG_LABELS, type SupportedLang } from "../i18n";
import SegmentedControl from "./ui/SegmentedControl";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  // 'ko-KR' 같은 지역 코드도 base로 매칭
  const current = (i18n.resolvedLanguage || i18n.language || "ko").split(
    "-"
  )[0] as SupportedLang;

  return (
    <SegmentedControl<SupportedLang>
      ariaLabel={t("common.language")}
      size="sm"
      layoutId="lang-switch"
      value={current}
      onChange={(lng) => i18n.changeLanguage(lng)}
      segments={SUPPORTED_LANGS.map((lng) => ({
        value: lng,
        label: LANG_LABELS[lng],
      }))}
    />
  );
}
