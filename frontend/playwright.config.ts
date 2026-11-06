import { defineConfig } from "@playwright/test";
import path from "node:path";

const staticDir = path.resolve("dist");
const python = path.resolve("../backend/.venv/bin/python");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8765",
    channel: "chrome",
  },
  webServer: {
    command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8765`,
    cwd: path.resolve("../backend"),
    url: "http://127.0.0.1:8765/health",
    timeout: 30_000,
    reuseExistingServer: false,
    env: {
      STATIC_DIR: staticDir,
      ORIANE_API_KEY: "",
      GMI_API_KEY: "",
      GMI_MODEL: "",
    },
  },
});
