import { defineConfig, devices } from "@playwright/test";

/**
 * E2E golden path against a production build with no DATABASE_URL / Clerk keys
 * (in-memory repo + dev user). `npm run e2e` builds first.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx next start -p 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
        env: { DATABASE_URL: "", CLERK_SECRET_KEY: "", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", ALLOW_DEV_AUTH: "1", ALLOW_MEMORY_REPO: "1" },
      },
});
