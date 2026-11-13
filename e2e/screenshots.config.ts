import { defineConfig, devices } from '@playwright/test';

/** Presentation screenshots (docs/presentacion). Requires `npm run dev:local` (fresh) + `npm start -w apps/web`. */
export default defineConfig({
  testDir: 'presentation',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'es-ES' } }],
});
