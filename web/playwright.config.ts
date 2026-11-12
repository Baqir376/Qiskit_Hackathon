import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://localhost:3010", trace: "retain-on-failure", reducedMotion: "no-preference" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npx serve out -l 3010 --no-clipboard", url: "http://localhost:3010", reuseExistingServer: true, timeout: 60_000 },
});
