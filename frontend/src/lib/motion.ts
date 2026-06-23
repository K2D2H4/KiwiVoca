// 학습 게임 모션 프리셋 — spring 물리 / easing 통일. transform·opacity만 애니메이트(60fps).
import type { Transition, Variants } from "framer-motion";

// --- Spring 프리셋 ---
export const spring = {
  // UI 탭/보기 리빌 — 또렷하고 빠른 정착
  snappy: { type: "spring", stiffness: 380, damping: 30 } as Transition,
  // 카드 전환/레이아웃 — 부드러운 감속
  smooth: { type: "spring", stiffness: 260, damping: 28 } as Transition,
  // 셀레브레이션/큰 리빌 — 통통한 바운스
  gentle: { type: "spring", stiffness: 180, damping: 16 } as Transition,
  // 스냅백 — 드래그 미달 시 제자리 복귀
  stiff: { type: "spring", stiffness: 520, damping: 34 } as Transition,
} as const;

// --- Easing (CSS transition용) ---
export const EASE_OUT = "cubic-bezier(0.22,1,0.36,1)";

// --- 공용 인터랙션 ---
export const tap = { scale: 0.96 } as const; // whileTap
export const tapSoft = { scale: 0.98 } as const;

// 보기 stagger 등장 컨테이너/아이템
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
};

// 문제 전환 — 좌우 슬라이드 + 페이드
export const questionVariants: Variants = {
  enter: { opacity: 0, x: 28, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -28, scale: 0.98 },
};

// 오답 흔들기 — transform만 (mutable 배열로 반환)
export const shakeX = (): number[] => [0, -9, 9, -7, 7, -4, 0];
export const shakeKeyframes = { x: shakeX() };
export const shakeTransition: Transition = { duration: 0.42, ease: "easeInOut" };
