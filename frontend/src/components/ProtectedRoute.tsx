// 보호 라우트 — 미인증 시 /login 리다이렉트
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // 로그인 후 원래 가려던 곳으로 돌아갈 수 있도록 from 전달
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
