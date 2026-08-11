import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages: 저장소 이름에 맞게 base 설정 (예: /jebi-app/)
  // 사용자 저장소가 <username>.github.io 라면 base: "/" 로 변경
  base: "/jebi-app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "제비 — 마음을 기억하는 집",
        short_name: "제비",
        description: "받은 마음도, 전할 마음도 놓치지 않게",
        theme_color: "#BA7517",
        background_color: "#FAEEDA",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
