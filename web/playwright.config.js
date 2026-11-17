import { defineConfig, devices } from '@playwright/test';

const API_KEY = 'e2e-test-key-at-least-24-characters';

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'tablet', use: { ...devices['Galaxy Tab S4 landscape'], browserName: 'chromium' } },
  ],
  webServer: [
    { command: 'node scripts/serve.js', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
    {
      command: 'npm start --prefix ../server',
      url: 'http://localhost:8787/healthz',
      reuseExistingServer: false,
      env: { API_KEY, DATABASE_FILE: ':memory:', PORT: '8787', ALLOWED_ORIGINS: 'http://localhost:5173' },
    },
  ],
});

export { API_KEY };
