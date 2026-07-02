// 전역 UI 상태 — AI 생성(단어/문법) 진행 여부. 생성 중엔 만들기 FAB 비활성화.
// 여러 생성이 겹치거나 마운트/언마운트가 엇갈려도 안전하도록 ref-count 방식.
import { useEffect } from "react";
import { create } from "zustand";

interface UiState {
  busyCount: number;
  incBusy: () => void;
  decBusy: () => void;
}

const useUiStore = create<UiState>((set) => ({
  busyCount: 0,
  incBusy: () => set((s) => ({ busyCount: s.busyCount + 1 })),
  decBusy: () => set((s) => ({ busyCount: Math.max(0, s.busyCount - 1) })),
}));

// AI 생성/추출이 진행되는 페이지에서 pending 상태를 전역에 보고한다.
// active 동안만 카운트를 점유하고, false 전환/언마운트 시 자동 반납.
export function useReportBusy(active: boolean) {
  const incBusy = useUiStore((s) => s.incBusy);
  const decBusy = useUiStore((s) => s.decBusy);
  useEffect(() => {
    if (!active) return;
    incBusy();
    return () => decBusy();
  }, [active, incBusy, decBusy]);
}

// 생성 진행 중이면 true.
export const useIsBusy = () => useUiStore((s) => s.busyCount > 0);
