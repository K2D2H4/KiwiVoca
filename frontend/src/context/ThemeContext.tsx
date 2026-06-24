// 테마 컨텍스트 — light | dark | system.
// localStorage("kiwivoca.theme") 영속, system은 prefers-color-scheme 추종.
// <html class="dark"> 토글로 CSS 변수 테마(index.css :root/.dark)를 전환한다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "kiwivoca.theme";

interface ThemeContextValue {
  /** 사용자가 고른 설정값 (light/dark/system) */
  mode: ThemeMode;
  /** 실제 적용된 테마 (system 해석 결과 포함) */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

// mode를 실제 light/dark로 해석
function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

// <html> 클래스 + theme-color 메타 동기화
function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    // 라이트: 키위 그린 / 다크: 딥 페이지 배경
    meta.setAttribute("content", resolved === "dark" ? "#141B12" : "#6BBF59");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolve(getStoredMode())
  );

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setModeState(next);
    const r = resolve(next);
    setResolved(r);
    applyTheme(r);
  }, []);

  // mode 변경 시 적용
  useEffect(() => {
    const r = resolve(mode);
    setResolved(r);
    applyTheme(r);
  }, [mode]);

  // system 모드일 때 OS 테마 변화 추종
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = systemPrefersDark() ? "dark" : "light";
      setResolved(r);
      applyTheme(r);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
