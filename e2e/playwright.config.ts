import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the local stack. By default it starts the in-memory API (`npm run dev:local`) and the
 * Angular dev server. With Docker, start `docker compose -f infra/docker-compose.dev.yml up` and run
 * with E2E_BASE_URL=http://localhost:8080 MAILPIT_URL=http://localhost:8025.
 */
const external = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: external
    ? undefined
    : [
        { command: 'npx tsx scripts/dev-local.ts', cwd: '..', url: 'http://localhost:3000/api/health', reuseExistingServer: true, timeout: 180_000 },
        { command: 'npx ng serve --port 4200', cwd: '../apps/web', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 180_000 },
      ],
});
