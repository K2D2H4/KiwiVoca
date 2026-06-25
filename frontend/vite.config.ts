import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// nginx(8080) 뒤에서 동작 — HMR 웹소켓이 nginx 통해 연결되도록 clientPort 지정
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // 터널/외부 도메인(예: trycloudflare.com)에서 접속 시 Vite 호스트 차단 방지 (로컬 dev 편의)
    allowedHosts: true,
    hmr: {
      clientPort: 8080,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor 청크 분리 — 초기 번들 축소, 캐시 효율↑
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query", "axios"],
          "vendor-motion": ["framer-motion"],
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
          ],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
