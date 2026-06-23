// 로그인 화면 — 이메일/비번 + 소셜 준비중. 인증 디자인 언어의 쇼케이스.
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import AuthLayout from "../components/auth/AuthLayout";
import SocialButtons from "../components/auth/SocialButtons";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import { useLogin } from "../hooks/useAuth";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => navigate(from ?? "/", { replace: true }) }
    );
  };

  return (
    <AuthLayout title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          id="email"
          type="email"
          autoComplete="email"
          required
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          leftIcon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          required
          label={t("auth.password")}
          placeholder={t("auth.passwordPlaceholder")}
          leftIcon={<Lock size={18} />}
          rightSlot={
            <IconButton
              label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
              variant="ghost"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </IconButton>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {login.isError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2.5 text-body-sm font-semibold text-danger"
          >
            <AlertCircle size={16} className="shrink-0" />
            {t("auth.loginError")}
          </motion.p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={login.isPending}
          className="!mt-5"
        >
          {t("auth.loginCta")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-caption font-bold uppercase tracking-wide text-seed/35">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-body-sm text-seed/60">
        {t("auth.noAccount")}{" "}
        <Link
          to="/signup"
          className="font-bold text-kiwi-700 underline-offset-2 hover:underline"
        >
          {t("auth.goSignup")}
        </Link>
      </p>
    </AuthLayout>
  );
}
