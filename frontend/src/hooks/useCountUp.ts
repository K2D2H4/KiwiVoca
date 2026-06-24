// 숫자 카운트업 — 0(또는 이전값)에서 target까지 부드럽게. reduced-motion이면 즉시.
import { useEffect, useState } from "react";
import {
  animate,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";

export function useCountUp(target: number, duration = 0.9, delay = 0): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    let controls: AnimationPlaybackControls | null = null;
    const id = window.setTimeout(() => {
      controls = animate(0, target, {
        duration,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => setValue(Math.round(v)),
      });
    }, delay * 1000);
    return () => {
      window.clearTimeout(id);
      controls?.stop();
    };
  }, [target, duration, delay, reduce]);

  return value;
}
