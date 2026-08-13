import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/canvassing.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4281",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-canvassing",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node scripts/run_canvassing_e2e_api.mjs",
      url: "http://127.0.0.1:4280/api/canvassing/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command:
        "CANVASS_API_URL=http://127.0.0.1:4280 npm run dev:web -- --host 127.0.0.1 --port 4281",
      url: "http://127.0.0.1:4281/canvassing/",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
