// 소셜 로그인 버튼 — Google/Kakao OAuth 시작(풀페이지 리다이렉트).
// 각 버튼 클릭 시 백엔드 /api/auth/{provider}/login 으로 이동해 OAuth 플로우 시작.
import { useTranslation } from "react-i18next";

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.2 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.1 36.4 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function KakaoGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#3C1E1E"
        d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.8 6.7-.2.7-.8 2.7-.9 3.1 0 0 0 .3.2.4.2 0 .3 0 .4-.1.4-.2 3-2 3.5-2.4.7.1 1.3.1 2 .1 5.5 0 10-3.6 10-8S17.5 3 12 3z"
      />
    </svg>
  );
}

// OAuth 시작 — SPA fetch가 아닌 전체 페이지 이동(OAuth 리다이렉트 필요)
function startOAuth(provider: "google" | "kakao") {
  window.location.href = `/api/auth/${provider}/login`;
}

interface ProviderConfig {
  key: "google" | "kakao";
  label: string;
  glyph: React.ReactNode;
  // 브랜드 가이드 고정색은 토큰 대신 글리프 자산으로 인라인(Google G 멀티컬러와 동일 예외)
  className: string;
}

export default function SocialButtons() {
  const { t } = useTranslation();

  const providers: ProviderConfig[] = [
    {
      key: "google",
      label: t("auth.continueGoogle"),
      glyph: <GoogleGlyph />,
      // 구글: 흰 배경 + 회색 보더 (구글 브랜드 가이드)
      className:
        "border-2 border-border bg-surface text-seed hover:bg-ink-50 active:bg-ink-100",
    },
    {
      key: "kakao",
      label: t("auth.continueKakao"),
      glyph: <KakaoGlyph />,
      // 카카오: 옐로우 #FEE500 + 갈색 텍스트 (카카오 브랜드 가이드 고정색)
      className:
        "border-2 border-[#FEE500] bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 active:brightness-90",
    },
  ];

  return (
    <div className="space-y-2.5">
      {providers.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => startOAuth(p.key)}
          className={[
            "relative flex min-h-[50px] w-full items-center gap-3 rounded-2xl px-4 text-body-sm font-bold",
            "shadow-[0_2px_8px_rgba(46,58,36,0.06)] transition active:scale-[0.97]",
            p.className,
          ].join(" ")}
        >
          <span className="shrink-0">{p.glyph}</span>
          {/* 글리프 폭을 보정해 라벨을 시각적으로 중앙 정렬 */}
          <span className="-ml-[20px] flex-1 truncate text-center">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
