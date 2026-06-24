// 키위 캐릭터 마크 — 단면 키위(껍질/과육/씨앗) SVG 일러스트
interface KiwiMarkProps {
  size?: number;
  className?: string;
}

export default function KiwiMark({ size = 72, className }: KiwiMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="키위"
      className={className}
    >
      {/* 껍질 */}
      <circle cx="50" cy="50" r="46" fill="#A67C52" />
      <circle cx="50" cy="50" r="46" fill="url(#kiwiFuzz)" opacity="0.25" />
      {/* 흰 테두리 */}
      <circle cx="50" cy="50" r="40" fill="#F4F0E4" />
      {/* 과육 */}
      <circle cx="50" cy="50" r="36" fill="#A8E08F" />
      <circle cx="50" cy="50" r="36" fill="url(#kiwiGlow)" />
      {/* 중심 흰 별 */}
      <circle cx="50" cy="50" r="8" fill="#FBF8F0" />
      {/* 씨앗 — 두 줄 방사형 */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 26;
        const y = 50 + Math.sin(a) * 26;
        return (
          <ellipse
            key={`s1-${i}`}
            cx={x}
            cy={y}
            rx="2"
            ry="3.4"
            fill="#2E3A24"
            transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
          />
        );
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const x = 50 + Math.cos(a) * 16;
        const y = 50 + Math.sin(a) * 16;
        return (
          <ellipse
            key={`s2-${i}`}
            cx={x}
            cy={y}
            rx="1.6"
            ry="2.8"
            fill="#2E3A24"
            transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
          />
        );
      })}
      <defs>
        <radialGradient id="kiwiGlow" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#C8EDB0" />
          <stop offset="100%" stopColor="#8FCF73" />
        </radialGradient>
        <radialGradient id="kiwiFuzz" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#D6B38A" />
          <stop offset="100%" stopColor="#8A6440" />
        </radialGradient>
      </defs>
    </svg>
  );
}
