import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: {
    timeout: 15000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command:
      "PATH=\"/Users/keshi/Documents/投递记录/.tooling/node/bin:/Users/keshi/Documents/投递记录/.tooling/pnpm/bin:$PATH\" DATABASE_URL= DATABASE_URL_UNPOOLED= JOB_DESK_DB_DIR=.data/job-desk-e2e JOB_DESK_ENABLE_SEED=true pnpm start",
    port: 3000,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
