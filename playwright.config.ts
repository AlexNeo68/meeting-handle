import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3001/meetings',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        THROTTLE_LIMIT: '100000',
        WHISPER_AUTO_DOWNLOAD: 'false',
      },
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
