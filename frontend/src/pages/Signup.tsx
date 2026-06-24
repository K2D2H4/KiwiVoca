// 회원가입 화면 — 이름/이메일/비번 + 소셜 준비중.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import AuthLayout from "../components/auth/AuthLayout";
import SocialButtons from "../components/auth/SocialButtons";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import { useRegister } from "../hooks/useAuth";

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useRegister();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate(
      { email, password, display_name: displayName },
      {
        onSuccess: (data) => {
          if (data.access_token) navigate("/", { replace: true });
          else navigate("/login", { replace: true });
        },
      }
    );
  };

  return (
    <AuthLayout title={t("auth.signupTitle")} subtitle={t("auth.signupSubtitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          id="displayName"
          type="text"
          autoComplete="nickname"
          required
          label={t("auth.displayName")}
          placeholder={t("auth.displayNamePlaceholder")}
          leftIcon={<User size={18} />}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          label={t("auth.password")}
          placeholder={t("auth.passwordPlaceholder")}
          helper={t("auth.passwordHelper")}
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

        {register.isError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-2.5 text-body-sm font-semibold text-danger"
          >
            <AlertCircle size={16} className="shrink-0" />
            {t("auth.signupError")}
          </motion.p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={register.isPending}
          className="!mt-5"
        >
          {t("auth.signupCta")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-caption font-bold uppercase tracking-wide text-seed/35">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <SocialButtons />

      <p className="mt-6 text-center text-body-sm text-seed/60">
        {t("auth.haveAccount")}{" "}
        <Link
          to="/login"
          className="font-bold text-kiwi-700 underline-offset-2 hover:underline"
        >
          {t("auth.goLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
