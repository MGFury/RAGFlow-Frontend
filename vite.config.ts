import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// RAGFlow does not send CORS headers by default, so the dev server forwards /ragflow/* to it.
// Point RAGFLOW_TARGET at your RAGFlow API (default port 9380). See README for production.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.RAGFLOW_TARGET || "http://localhost:9380";
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      port: 5173,
      proxy: {
        "/ragflow": { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/ragflow/, "") },
      },
    },
  };
});
