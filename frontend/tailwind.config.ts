import type { Config } from "tailwindcss";

// 키위보카 디자인 시스템 토큰 — "Orchard Pop"
// 키위 그린 + 크림 + 씨앗 대비를 살린 따뜻하고 트렌디한 톤.
// 하드코딩 hex 금지: 항상 토큰명을 사용한다.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- 브랜드 메인: 키위 그린 스케일 (50~900) ---
        kiwi: {
          50: "#F1FAEC",
          100: "#E0F4D4",
          200: "#C6E9AE",
          300: "#A8E08F", // 기존 light
          400: "#84CF6A",
          DEFAULT: "#6BBF59", // 메인 CTA
          500: "#6BBF59",
          600: "#5FA63C", // hover/active (기존 dark)
          dark: "#5FA63C",
          light: "#A8E08F",
          700: "#4C8730",
          800: "#3C6927",
          900: "#2F5220",
        },
        // --- 중립 그레이 스케일 (씨앗 톤이 섞인 따뜻한 그레이) ---
        ink: {
          50: "#F6F5F1",
          100: "#ECEAE3",
          200: "#D9D6CB",
          300: "#BBB7A9",
          400: "#928D7C",
          500: "#6F6A5B",
          600: "#534F43",
          700: "#3D3A31",
          800: "#2E3A24", // = seed (진한 텍스트)
          900: "#222B1A",
        },
        // --- 시맨틱 ---
        success: { DEFAULT: "#5FA63C", soft: "#E0F4D4" },
        warning: { DEFAULT: "#E8A33D", soft: "#FBEED2" },
        danger: { DEFAULT: "#E8604C", soft: "#FBE0DB" },
        info: { DEFAULT: "#4FA8C9", soft: "#DBEEF5" },
        // --- 서피스/배경/보더 ---
        surface: "#FFFFFF",
        bg: "#FBF8F0", // = cream
        border: "#E9E5DA",
        // --- 기존 토큰 유지 ---
        cream: "#FBF8F0",
        seed: "#2E3A24",
        bark: "#A67C52",
        pop: {
          DEFAULT: "#FF8A7A", // 코랄 포인트
          soft: "#FFE3DD",
          dark: "#F0654F",
        },
      },
      fontFamily: {
        // 본문: Pretendard(KR+Latin) + Noto JP 폴백
        sans: [
          "Pretendard",
          "Pretendard Variable",
          "Noto Sans JP",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        // 제목/디스플레이: 라운드 트렌디 sans, 한글/JP은 Pretendard·Noto 폴백
        display: [
          "Quicksand",
          "Pretendard",
          "Noto Sans JP",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // 타이포 스케일 (size, lineHeight, letterSpacing)
        display: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "700" }],
        h2: ["1.375rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        h3: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.005em", fontWeight: "700" }],
        body: ["1rem", { lineHeight: "1.5" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.01em" }],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        // elevation 시스템 — 키위 씨앗 톤(따뜻한 그림자)
        xs: "0 1px 2px rgba(46,58,36,0.06)",
        sm: "0 2px 8px rgba(46,58,36,0.07)",
        soft: "0 4px 16px rgba(46,58,36,0.08)", // = md (기존 유지)
        md: "0 4px 16px rgba(46,58,36,0.08)",
        lg: "0 12px 32px rgba(46,58,36,0.12)",
        xl: "0 20px 48px rgba(46,58,36,0.16)",
        pop: "0 6px 20px rgba(255,138,122,0.28)", // 코랄 발광 (CTA)
        "kiwi-glow": "0 8px 24px rgba(107,191,89,0.28)", // 그린 발광
        "inner-soft": "inset 0 1px 2px rgba(46,58,36,0.05)",
      },
      spacing: {
        // safe-area 헬퍼
        "safe-b": "env(safe-area-inset-bottom)",
        "safe-t": "env(safe-area-inset-top)",
      },
      zIndex: {
        base: "0",
        raised: "10",
        sticky: "20",
        header: "30",
        nav: "40",
        overlay: "50",
        toast: "60",
      },
      keyframes: {
        "pop-bounce": {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(8%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "toast-in": {
          "0%": { transform: "translateY(-12px) scale(0.96)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float-y": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        blink: {
          "0%,92%,100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.1)" },
        },
      },
      animation: {
        "pop-bounce": "pop-bounce 0.4s ease-in-out",
        fade: "fade 0.15s ease-out",
        "fade-up": "fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "sheet-up": "sheet-up 0.22s cubic-bezier(0.22,1,0.36,1)",
        "toast-in": "toast-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.6s linear infinite",
        "float-y": "float-y 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
