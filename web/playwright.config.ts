import { defineConfig, devices } from '@playwright/test';
if (!process.env.UFM_E2E_RUNTIME || !process.env.UFM_E2E_URL) throw new Error('Run npm run test:e2e so tests use an isolated database.');
export default defineConfig({
  testDir: './e2e/tests', fullyParallel: false, workers: 1, retries: 0,
  timeout: 30_000, forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: { ...devices['Desktop Chrome'], baseURL: process.env.UFM_E2E_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
