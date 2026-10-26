import { defineConfig } from "@playwright/test";
const PORT = 8123;
export default defineConfig({
  testDir: "e2e", timeout: 120_000, expect: { timeout: 15_000 }, workers: 1, fullyParallel: false, reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: { command: "bash e2e/serve.sh", url: `http://localhost:${PORT}/ready`, timeout: 120_000, reuseExistingServer: false, env: { PORT: String(PORT) } },
});
