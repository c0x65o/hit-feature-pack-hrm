import { defineConfig, devices } from '@playwright/test';

/**
 * HRM Feature Pack E2E tests
 *
 * Usage:
 * 1) Start harness: `hit run` (from this feature pack directory)
 * 2) Run tests:
 *    - PLAYWRIGHT_BASE_URL=http://localhost:3333 npm run test:e2e
 *    - Or use: `hit fp test` (automatically starts harness)
 *
 * Credentials default to the harness-seeded admin:
 * - ADMIN_EMAIL=admin@hitcents.com
 * - ADMIN_PASSWORD=admin
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 90 * 1000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3333',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
