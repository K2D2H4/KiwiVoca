// 인증 전역 상태 — zustand + localStorage 영속
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../lib/api";
import type { TokenResponse, User } from "../types/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // 로그인/가입 성공 시 토큰 저장 (api.ts가 읽는 키에도 함께 동기화)
  setTokens: (tokens: TokenResponse) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setTokens: (tokens) => {
        // axios 인터셉터가 참조하는 raw 키에도 저장
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
        if (tokens.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
        }
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          isAuthenticated: true,
        });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "kiwivoca.auth",
      // 토큰/유저만 영속, 파생 플래그는 재계산
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
