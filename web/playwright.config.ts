import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  DATABASE_URL: "pglite:./.data/e2e",
  SITE_URL: `http://localhost:${PORT}`,
  ORDER_LINK_SECRET: "e2e-only-secret",
  PAYMENTS_ENABLED: "true",
  PAYSTACK_SECRET_KEY: "sk_test_e2e_mock",
  PAYSTACK_BASE_URL: "http://localhost:3199",
  GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one embedded database; journeys share state deliberately
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    { command: "node e2e/mock-paystack.mjs", port: 3199, reuseExistingServer: false },
    {
      command: `npx tsx scripts/e2e-prepare.ts && npx next build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env,
      timeout: 600_000,
      reuseExistingServer: false,
    },
  ],
});
