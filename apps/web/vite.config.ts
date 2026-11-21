import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { seoPages } from "./seoBuild";

export default defineConfig(({ mode }) => ({
  plugins: [react(), seoPages(loadEnv(mode, process.cwd(), ["GOOGLE_SITE_VERIFICATION", "NAVER_SITE_VERIFICATION"]))],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
}));
