// 정답률 링 게이지 — "잘 익은 키위" 컨셉. 0~100% 를 원형 게이지로.
// 채움 컬러는 익을수록 그린, 낮으면 코랄. 중앙에 큰 % + 라벨.
import { motion, useReducedMotion } from "framer-motion";

interface AccuracyRingProps {
  value: number; // 0~100
  size?: number;
  stroke?: number;
  label?: string;
  /** 중앙 숫자 위에 표시할 작은 캡션 */
  caption?: string;
}

export default function AccuracyRing({
  value,
  size = 168,
  stroke = 14,
  label,
  caption,
}: AccuracyRingProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  // 익을수록 그린(pop→kiwi). 60% 미만은 코랄 톤으로 "덜 익음" 표현.
  const ripe = clamped >= 60;
  const gradId = ripe ? "ringRipe" : "ringRaw";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringRipe" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#84CF6A" />
            <stop offset="100%" stopColor="#5FA63C" />
          </linearGradient>
          <linearGradient id="ringRaw" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8A7A" />
            <stop offset="100%" stopColor="#F0654F" />
          </linearGradient>
        </defs>
        {/* 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ink-100"
        />
        {/* 채움 */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>

      {/* 중앙 텍스트 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {caption && (
          <span className="text-caption font-bold uppercase tracking-wide text-seed/40">
            {caption}
          </span>
        )}
        <span className="font-display text-display font-bold leading-none text-seed tabular-nums">
          {Math.round(clamped)}
          <span className="text-h2 align-top text-seed/45">%</span>
        </span>
        {label && (
          <span className="mt-1 text-body-sm font-bold text-seed/55">{label}</span>
        )}
      </div>
    </div>
  );
}
