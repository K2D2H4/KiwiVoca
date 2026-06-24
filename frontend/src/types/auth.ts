// 인증/유저 도메인 타입 — 백엔드 /api/auth/* 계약 기준
export type AuthProvider = "local" | "google" | "kakao";

export interface User {
  id: string | number;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  auth_provider?: AuthProvider;
  created_at?: string;
  updated_at?: string;
}

// POST /auth/login → 토큰 묶음
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

// POST /auth/register 응답은 토큰만 줄 수도, 유저를 함께 줄 수도 있어 유연 처리
export interface RegisterResponse extends TokenResponse {
  user?: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
}
