import { expect, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const MAILPIT = process.env.MAILPIT_URL;

/** Reads the latest magic link token sent to `to` (Mailpit in Docker, dev outbox in memory mode). */
export async function magicToken(page: Page, to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    let text: string | undefined;
    if (MAILPIT) {
      const list = await (await page.request.get(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(to)}&limit=1`)).json();
      const id = list.messages?.[0]?.ID;
      if (id) text = (await (await page.request.get(`${MAILPIT}/api/v1/message/${id}`)).json()).Text;
    } else {
      const { items } = await (await page.request.get(`${API}/api/dev/outbox`)).json();
      text = [...items].reverse().find((m: { to: string; subject: string }) => m.to === to && /enlace|link|enllaç/i.test(m.subject))?.text;
    }
    const token = text?.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    if (token) return token;
    await page.waitForTimeout(500);
  }
  throw new Error(`no magic link for ${to}`);
}

/** Requests a magic link and opens it (on-screen link in test environments, else the mailbox). */
export async function openMagicLink(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-sent')).toBeVisible();
  const devLink = page.getByTestId('dev-magic-link');
  if (await devLink.isVisible()) await devLink.click();
  else await page.goto(`/auth/verify?token=${await magicToken(page, email)}`);
}

/** Full magic-link login through the UI. */
export async function login(page: Page, email: string, org?: string): Promise<void> {
  await openMagicLink(page, email);
  if (org) await page.getByTestId(`account-${org}`).click();
  else await page.waitForURL((url) => !url.pathname.startsWith('/auth/verify') && !url.pathname.startsWith('/login'));
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
}

/** Selects an option in a Material select. */
export async function matSelect(page: Page, testId: string, option: string | RegExp): Promise<void> {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: option }).click();
}
