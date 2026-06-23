// 키위 캐릭터 — 단면 키위에 표정을 입힌 마스코트.
// 빈 상태 / 성공 / 로딩 / 에러 / 기본 무드를 표현. 일러스트 전용, 토큰 컬러 사용.
import { motion } from "framer-motion";

export type KiwiMood = "happy" | "neutral" | "sad" | "sleepy" | "wow" | "love";

interface KiwiBuddyProps {
  mood?: KiwiMood;
  size?: number;
  className?: string;
  /** 둥실 떠다니는 모션 (빈 상태/로딩에서 활용) */
  float?: boolean;
}

// 표정별 눈/입 패스
function Face({ mood }: { mood: KiwiMood }) {
  const eyeFill = "#2E3A24";
  switch (mood) {
    case "happy":
      return (
        <>
          {/* 반달 눈 */}
          <path d="M38 46c1.5-2.4 5.5-2.4 7 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M55 46c1.5-2.4 5.5-2.4 7 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* 활짝 웃는 입 */}
          <path d="M40 56c4 6 16 6 20 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* 볼터치 */}
          <circle cx="34" cy="54" r="3.5" fill="#FF8A7A" opacity="0.5" />
          <circle cx="66" cy="54" r="3.5" fill="#FF8A7A" opacity="0.5" />
        </>
      );
    case "love":
      return (
        <>
          <path d="M40 47c0-2 3-2.6 1.5 0.6M40 47c0-2-3-2.6-1.5 0.6M40 47l-1.5-0.4M40 47l1.5-0.4" stroke="#FF8A7A" strokeWidth="3" strokeLinecap="round" fill="#FF8A7A" />
          <path d="M40 44.5l2 2 2-2c1.2-1.2-0.8-3.2-2-1.6-1.2-1.6-3.2 0.4-2 1.6z" fill="#FF8A7A" />
          <path d="M58 44.5l2 2 2-2c1.2-1.2-0.8-3.2-2-1.6-1.2-1.6-3.2 0.4-2 1.6z" fill="#FF8A7A" />
          <path d="M41 56c4 6 14 6 18 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="34" cy="54" r="3.5" fill="#FF8A7A" opacity="0.55" />
          <circle cx="66" cy="54" r="3.5" fill="#FF8A7A" opacity="0.55" />
        </>
      );
    case "wow":
      return (
        <>
          <circle cx="41" cy="46" r="3.4" fill={eyeFill} />
          <circle cx="59" cy="46" r="3.4" fill={eyeFill} />
          <circle cx="42" cy="45" r="1.1" fill="#fff" />
          <circle cx="60" cy="45" r="1.1" fill="#fff" />
          {/* 동그란 입 */}
          <ellipse cx="50" cy="58" rx="4" ry="5" fill={eyeFill} />
        </>
      );
    case "sad":
      return (
        <>
          <path d="M38 47c1.5 2.2 5.5 2.2 7 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M55 47c1.5 2.2 5.5 2.2 7 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* 처진 입 */}
          <path d="M41 60c4-6 14-6 18 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M37 47h8M55 47h8" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" />
          <path d="M44 58c2 2 8 2 10 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* zzz */}
          <text x="68" y="34" fontSize="11" fontWeight="800" fill="#2E3A24" opacity="0.55">z</text>
          <text x="74" y="26" fontSize="8" fontWeight="800" fill="#2E3A24" opacity="0.4">z</text>
        </>
      );
    default: // neutral
      return (
        <>
          <circle cx="41" cy="46" r="3" fill={eyeFill} />
          <circle cx="59" cy="46" r="3" fill={eyeFill} />
          <circle cx="42" cy="45" r="1" fill="#fff" />
          <circle cx="60" cy="45" r="1" fill="#fff" />
          <path d="M43 57c3 3 11 3 14 0" stroke={eyeFill} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
  }
}

export default function KiwiBuddy({
  mood = "happy",
  size = 96,
  className,
  float = false,
}: KiwiBuddyProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="키위 캐릭터"
      className={className}
    >
      {/* 껍질 */}
      <circle cx="50" cy="50" r="46" fill="#A67C52" />
      <circle cx="50" cy="50" r="46" fill="url(#kbFuzz)" opacity="0.25" />
      {/* 흰 테두리 */}
      <circle cx="50" cy="50" r="40" fill="#F4F0E4" />
      {/* 과육 */}
      <circle cx="50" cy="50" r="36" fill="#A8E08F" />
      <circle cx="50" cy="50" r="36" fill="url(#kbGlow)" />
      {/* 씨앗 — 바깥 방사 (표정 영역은 비움) */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 30;
        const y = 50 + Math.sin(a) * 30;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="1.7"
            ry="3"
            fill="#2E3A24"
            opacity="0.85"
            transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}
          />
        );
      })}
      {/* 표정 */}
      <Face mood={mood} />
      <defs>
        <radialGradient id="kbGlow" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#CDEFB5" />
          <stop offset="100%" stopColor="#8FCF73" />
        </radialGradient>
        <radialGradient id="kbFuzz" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#D6B38A" />
          <stop offset="100%" stopColor="#8A6440" />
        </radialGradient>
      </defs>
    </svg>
  );

  if (float) {
    return (
      <motion.div
        animate={{ y: [0, -6, 0], rotate: [0, -2.5, 0] }}
        transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity }}
        className={className ? undefined : "inline-block"}
      >
        {svg}
      </motion.div>
    );
  }
  return svg;
}
