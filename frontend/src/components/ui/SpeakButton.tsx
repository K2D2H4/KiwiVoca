// SpeakButton — 단어 발음 재생 버튼. useTTS 기반, lucide 스피커 아이콘.
// 미지원 브라우저면 렌더 생략. 카드/리스트 내부 클릭 이벤트와 분리(stopPropagation).
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import IconButton from "./IconButton";
import { useTTS } from "../../hooks/useTTS";

interface SpeakButtonProps {
  text: string; // 읽을 단어(term)
  lang?: string; // 덱 lang_term (학습 대상 언어)
  variant?: "ghost" | "solid" | "soft";
  size?: "sm" | "md";
  className?: string;
}

export default function SpeakButton({
  text,
  lang,
  variant = "ghost",
  size = "sm",
  className = "",
}: SpeakButtonProps) {
  const { t } = useTranslation();
  const { speak, speaking, supported } = useTTS();

  // 미지원 환경이면 버튼 자체를 숨김
  if (!supported || !text.trim()) return null;

  return (
    <span className="relative inline-flex shrink-0">
      {/* 재생 중 펄스 링 — 가벼운 시각 피드백 */}
      {speaking && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-kiwi/30"
        />
      )}
      <IconButton
        label={t("tts.play")}
        variant={variant}
        size={size}
        aria-pressed={speaking}
        className={`relative ${speaking ? "text-kiwi" : ""} ${className}`}
        onClick={(e) => {
          // 카드 flip/swipe·행 편집 등 부모 클릭과 분리
          e.stopPropagation();
          speak(text, lang);
        }}
      >
        <Volume2 size={size === "md" ? 20 : 18} aria-hidden />
      </IconButton>
    </span>
  );
}
