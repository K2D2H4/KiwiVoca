// axios 인스턴스 — baseURL, JWT 부착, 401 토큰 정리
import axios from "axios";

export const ACCESS_TOKEN_KEY = "kiwivoca.access_token";
export const REFRESH_TOKEN_KEY = "kiwivoca.refresh_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
});

// 요청마다 localStorage access_token을 Authorization 헤더에 부착
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 응답 시 토큰 정리 (zustand authStore가 storage 변화를 보고 로그아웃 처리)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);
