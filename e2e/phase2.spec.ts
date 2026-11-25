/**
 * Phase 2 end to end: with the sample loaded the audit is scheduled, the window opens (dev helper), a person opens the
 * personal link from the invitation email on a phone, answers the whole interview (buttons, multiple choice,
 * own words), pauses and resumes, and the auditor sees the progress.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { login } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const SAMPLES = join(__dirname, '../seed/samples');
const AUDITOR = 'auditor2@auditoria.example';
const run = Date.now().toString(36);

/** Answers the question on screen (by its code) and waits for the conversation to move on. */
async function answerCurrent(page: Page): Promise<string> {
  const area = page.getByTestId('chat-answer');
  await expect(area).toBeVisible();
  const code = (await area.getAttribute('data-question'))!;
  const before = await page.getByTestId('chat-message').count();
  switch (code) {
    case 'P2': // multiple choice
      await page.getByTestId('chat-option-MAIL').click();
      await page.getByTestId('chat-option-REUNIONES').click();
      await page.getByTestId('chat-send-options').click();
      break;
    case 'P3.1': // own words, classified by the (mock) AI
      await page.getByTestId('chat-text').fill('No lo sé');
      await page.getByTestId('chat-send').click();
      break;
    case 'P7': // «siempre» brings P7.1
      await page.getByTestId('chat-option-SIEMPRE').click();
      break;
    case 'P7.1': // option with an optional complementary text
      await page.getByTestId('chat-option-SI_TIEMPO').click();
      await page.getByTestId('chat-option-text').fill('días libres');
      await page.getByTestId('chat-send-options').click();
      break;
    case 'P10':
      await page.getByTestId('chat-text').fill('Todo bien, gracias.');
      await page.getByTestId('chat-send').click();
      break;
    default:
      await page.locator('.options button').first().click();
  }
  await expect.poll(() => page.getByTestId('chat-message').count()).toBeGreaterThan(before);
  return code;
}

test('phase 2: scheduled audit, invitation link, interview on a phone with pause and resume, progress', async ({ page, browser }) => {
  test.setTimeout(180_000);
  page.on('dialog', (d) => void d.accept());

  // 1. The auditor prepares an audit (API): with the sample loaded it is scheduled, there is nothing to launch.
  await login(page, AUDITOR);
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const today = new Date().toISOString().slice(0, 10);
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: options.organizations[0].id, reference: `Fase 2 ${run}`, norm: '1000-1', auditType: 'inicial', excellence: false, interviewStartDate: today, scopeSize: 40, languages: ['es'] },
  });
  const id = (await created.json()).campaign.id;
  await page.request.post(`/api/campaigns/${id}/sample`, {
    multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: readFileSync(join(SAMPLES, 'muestra-valida-30.csv')) } },
  });
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('campaign-status')).toHaveText('Muestra cargada');
  await expect(page.getByTestId('scheduled-notice')).toBeVisible();
  await expect(page.getByTestId('launch')).toHaveCount(0);

  // 2. The window opens (dev helper) → en curso, invitations sent.
  await page.request.post(`${API}/api/dev/campaigns/${id}/open-now`);
  await page.reload();
  await expect(page.getByTestId('campaign-status')).toHaveText('En curso');
  await expect(page.getByTestId('progress-section')).toBeVisible();
  const outbox = (await (await page.request.get(`${API}/api/dev/outbox`)).json()).items as { to: string; text: string }[];
  const invitation = [...outbox].reverse().find((m) => m.to === 'persona001@andina.example' && /\/i\//.test(m.text))!;
  const link = new URL(invitation.text.match(/https?:\/\/\S+\/i\/[A-Za-z0-9_-]+/)![0]);

  // 3. The person opens the link on a phone, reads the notice and starts.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await p.goto(link.pathname);
  await expect(p.getByTestId('code-ok')).toHaveText('bienvenida');
  await p.getByTestId('start-interview').click();
  await expect(p).toHaveURL(/\/p\/entrevista$/);
  await expect(p.getByTestId('chat-progress')).toContainText('0 de unas');

  // 4. Three answers, then the connection is lost: the same link resumes at the same question.
  for (let i = 0; i < 3; i++) await answerCurrent(p);
  await expect(p.getByTestId('chat-progress')).toContainText('3 de unas');
  const pending = await p.getByTestId('chat-message').last().textContent();
  await p.goto(link.pathname);
  await p.getByTestId('start-interview').click();
  await expect(p.getByTestId('chat-message').last()).toHaveText(pending!);
  await expect(p.getByTestId('chat-progress')).toContainText('3 de unas');

  // 5. Until the end (P7 = siempre brings P7.1).
  const asked: string[] = [];
  for (let i = 0; i < 20 && !(await p.getByTestId('chat-done').isVisible()); i++) asked.push(await answerCurrent(p));
  await expect(p.getByTestId('chat-done')).toBeVisible();
  expect(asked).toContain('P7.1');
  await p.screenshot({ path: 'test-results/phase2-phone-done.png', fullPage: true });
  await phone.close();

  // 6. The auditor (same session) sees one completed interview; the link no longer starts a new one.
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('progress-completed')).toHaveText('1');
  await expect(page.getByTestId('progress-people')).toContainText('Completada');
  await page.goto(link.pathname);
  await expect(page.getByRole('heading', { name: 'entrevista completada' })).toBeVisible();
});
