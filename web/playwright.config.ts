import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a production build, on a separate database (leastudy_test).
const PORT = 3100;
const env = { DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/leastudy_test', STORAGE_DIR: './storage-test', ANTHROPIC_API_KEY: '' };
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off', actionTimeout: 15_000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: { command: `npx next start -p ${PORT}`, port: PORT, reuseExistingServer: false, env, timeout: 120_000 },
});
