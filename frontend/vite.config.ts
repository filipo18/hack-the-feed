import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_DEV_API_PROXY || "http://127.0.0.1:8000";
  const proxy = { "/api": target, "/health": target };
  return {
    plugins: [react()],
    server: { port: 5180, proxy },
    preview: { port: 5180, proxy },
  };
});
