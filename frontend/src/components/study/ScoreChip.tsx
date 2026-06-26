// 점수 칩 — 값이 오를 때 스프링 팝. 객관식·타이핑 공용.
import { motion } from "framer-motion";
import { spring } from "../../lib/motion";

export default function ScoreChip({ score }: { score: number }) {
  return (
    <motion.span
      key={score}
      initial={{ scale: 0.7 }}
      animate={{ scale: [1.25, 1] }}
      transition={spring.gentle}
      className="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-kiwi px-3 py-1 text-sm font-black tabular-nums text-white shadow-kiwi-glow"
    >
      {score}
    </motion.span>
  );
}
