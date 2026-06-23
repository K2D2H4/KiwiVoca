import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// nginx(8080) 뒤에서 동작 — HMR 웹소켓이 nginx 통해 연결되도록 clientPort 지정
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 8080,
    },
  },
});
