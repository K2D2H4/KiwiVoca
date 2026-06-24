// useSound — 게임에서 효과음 재생. soundStore가 켜진 경우에만 합성 엔진 호출.
// play는 stable(렌더 유발 X) — 게임 컴포넌트 의존성 배열에 안전하게 넣을 수 있다.
import { useCallback } from "react";
import { playSound, type SoundName } from "../lib/sound";
import { useSoundStore } from "../store/soundStore";

export function useSound() {
  const play = useCallback((name: SoundName) => {
    if (useSoundStore.getState().enabled) playSound(name);
  }, []);
  return { play };
}
