// 인증 관련 TanStack Query 훅 — login/register/me
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type {
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  TokenResponse,
  User,
} from "../types/auth";

// POST /auth/login → 토큰 저장 후 /auth/me로 유저 채움
export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<TokenResponse>("/auth/login", payload);
      setTokens(data);
      const me = await api.get<User>("/auth/me");
      setUser(me.data);
      return me.data;
    },
  });
}

// POST /auth/register → (토큰 포함 시) 저장 + me 조회
export function useRegister() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await api.post<RegisterResponse>(
        "/auth/register",
        payload
      );
      // 가입 응답이 토큰을 주면 바로 로그인 상태로, 아니면 호출부에서 로그인 유도
      if (data.access_token) {
        setTokens(data);
        if (data.user) {
          setUser(data.user);
        } else {
          const me = await api.get<User>("/auth/me");
          setUser(me.data);
        }
      }
      return data;
    },
  });
}

// GET /auth/me — 인증된 경우에만 활성화, 전역 스토어 동기화
export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  return useQuery({
    queryKey: ["auth", "me"],
    enabled: isAuthenticated,
    queryFn: async () => {
      try {
        const { data } = await api.get<User>("/auth/me");
        setUser(data);
        return data;
      } catch (err) {
        // 토큰 만료/무효 시 로그아웃 정리
        logout();
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}
