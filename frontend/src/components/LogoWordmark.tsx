// 브랜드 워드마크 로고 — 전 언어 동일 이미지(Vite import로 번들/해시).
// 텍스트 타이틀(아이콘+span)을 대체. 밝은 배경은 plain, 녹색 헤더는 pill 배경으로 대비 확보.
import { useTranslation } from "react-i18next";
import logoWordmark from "../assets/logo-wordmark.png";

interface LogoWordmarkProps {
  /** 로고 높이(px). 비율(429×192)은 자동 유지. */
  height?: number;
  /** 녹색 배경 위에서 가독성 확보용 흰/크림 pill 배경을 깐다. */
  onColor?: boolean;
  className?: string;
}

export default function LogoWordmark({
  height = 32,
  onColor = false,
  className = "",
}: LogoWordmarkProps) {
  const { t } = useTranslation();

  const img = (
    <img
      src={logoWordmark}
      alt={t("app.name")}
      height={height}
      style={{ height }}
      className="w-auto select-none"
      draggable={false}
    />
  );

  if (!onColor) return <span className={className}>{img}</span>;

  // 녹색 헤더: 은은한 흰 pill로 로고를 항상 또렷하게 분리
  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 shadow-[0_2px_10px_rgba(46,58,36,0.16)] ${className}`}
    >
      {img}
    </span>
  );
}
