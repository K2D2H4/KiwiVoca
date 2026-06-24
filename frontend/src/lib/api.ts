// axios 인스턴스 — baseURL, JWT 부착, 401 시 refresh 토큰으로 자동 재발급·재시도.
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "kiwivoca.access_token";
export const REFRESH_TOKEN_KEY = "kiwivoca.refresh_token";
// refresh 실패(세션 만료)를 앱에 알리는 이벤트 — authStore가 구독해 로그아웃 처리
export const AUTH_LOGOUT_EVENT = "kiwivoca:auth-logout";

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

// 세션 만료 처리 — 토큰 클리어 + 앱에 통지(authStore가 로그아웃/리다이렉트)
function forceLogout() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

// --- refresh 동시성 제어 ---
// 여러 요청이 동시에 401을 받아도 refresh는 한 번만 호출하고,
// 진행 중이면 같은 Promise를 공유한다(중복 리프레시 방지).
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error("no refresh token");

  // 인터셉터 없는 별도 클라이언트로 호출(무한 루프 방지)
  const base = import.meta.env.VITE_API_BASE || "/api";
  const { data } = await axios.post<{
    access_token: string;
    refresh_token?: string;
  }>(`${base}/auth/refresh`, { refresh_token: refreshToken });

  localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  return data.access_token;
}

// 원요청 1회만 재시도하도록 표시하는 플래그
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;

    // 401이 아니거나, 재시도 불가/이미 재시도했거나, refresh 요청 자체의 실패면 그대로 거절
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (
      status !== 401 ||
      !original ||
      original._retry ||
      isRefreshCall
    ) {
      // refresh 호출 자체가 401이면 세션 만료로 간주
      if (status === 401 && isRefreshCall) forceLogout();
      return Promise.reject(error);
    }

    // refresh 토큰이 없으면 갱신 불가 → 즉시 로그아웃
    if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
      forceLogout();
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      // 진행 중인 refresh가 있으면 공유, 없으면 새로 시작
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      // 새 토큰으로 원요청 재시도
      const retryConfig: AxiosRequestConfig = {
        ...original,
        headers: {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        },
      };
      return api(retryConfig);
    } catch (refreshErr) {
      // refresh 실패 → 그때만 로그아웃
      forceLogout();
      return Promise.reject(refreshErr);
    }
  }
);
