// OAuth 콜백 처리 — 백엔드가 /oauth/callback#access_token=..&refresh_token=..(성공)
// 또는 /oauth/callback#error=..(실패)로 풀페이지 리다이렉트해 온다.
// 토큰은 URL fragment(#)에 담겨 오므로 hash를 파싱해 authStore에 저장 후 홈으로 보낸다.
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../components/ui/Toast";
import KiwiMark from "../components/KiwiMark";
import { useTranslation } from "react-i18next";
import type { User } from "../types/auth";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  // StrictMode 이중 마운트/리렌더에도 한 번만 처리
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // fragment 파싱 — "#access_token=..&refresh_token=.." 또는 "#error=.."
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    // 토큰 흔적 즉시 제거(주소창/히스토리에 토큰 노출 방지)
    window.history.replaceState(null, "", window.location.pathname);

    const error = params.get("error");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (error || !accessToken || !refreshToken) {
      toast.error(t("oauth.failed"));
      navigate("/login", { replace: true });
      return;
    }

    // 토큰 저장(기존 이메일 로그인과 동일한 액션 재사용) 후 유저 로드
    setTokens({ access_token: accessToken, refresh_token: refreshToken });

    (async () => {
      try {
        const { data } = await api.get<User>("/auth/me");
        setUser(data);
        navigate("/", { replace: true });
      } catch {
        // 유저 로드 실패 시 정리 후 로그인으로
        useAuthStore.getState().logout();
        toast.error(t("oauth.failed"));
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setTokens, setUser, toast, t]);

  // 처리 중 키위 스피너(풀스크린)
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-cream px-6">
      <div className="animate-float-y">
        <KiwiMark size={64} className="animate-pulse" />
      </div>
      <p className="text-body-sm font-bold text-seed/70">{t("oauth.signingIn")}</p>
    </div>
  );
}
