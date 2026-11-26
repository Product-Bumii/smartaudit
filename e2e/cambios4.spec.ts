/**
 * Cambios 4 · bloques 1 y 2, end to end: three people answer in their own words (one stays vague and is sent to
 * review); the auditor sees the results with the pending answer apart, decides it in the review queue, sees the
 * results updated and opens the individual answers after the confidentiality notice.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { login } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SAMPLES = join(__dirname, '../seed/samples');
const AUDITOR = 'auditor2@auditoria.example';
const run = Date.now().toString(36);

/** A person answering through the API: first option in own words, or «depende» for `vague` questions. */
async function answer(request: { newContext: (o: { baseURL: string }) => Promise<APIRequestContext> }, path: string, vague: string[] = []) {
  const ctx = await request.newContext({ baseURL: WEB });
  await ctx.post(`/api${path.replace('/i/', '/participant/i/')}`);
  let s = await (await ctx.post('/api/participant/interview/start', { data: { language: 'es', acceptNotice: true } })).json();
  for (let n = 0; s.question && n < 60; n++) {
    const q = s.question;
    const text = q.type === 'free_text' ? 'Todo bien, gracias.' : vague.includes(q.code) ? 'depende' : q.options[0].label;
    s = await (await ctx.post('/api/participant/interview/answer', { data: { kind: 'text', questionCode: q.code, text } })).json();
  }
  await ctx.dispose();
}

test('cambios 4: results, review of a doubtful answer and individual answers', async ({ page, playwright }) => {
  test.setTimeout(180_000);
  await login(page, AUDITOR);
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const today = new Date().toISOString().slice(0, 10);
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: options.organizations[0].id, reference: `Cambios 4 ${run}`, norm: '1000-1', auditType: 'inicial', excellence: false, interviewStartDate: today, scopeSize: 40, languages: ['es'] },
  });
  const id = (await created.json()).campaign.id;
  await page.request.post(`/api/campaigns/${id}/sample`, {
    multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: readFileSync(join(SAMPLES, 'muestra-valida-30.csv')) } },
  });
  await page.request.post(`${API}/api/dev/campaigns/${id}/open-now`);
  const outbox = (await (await page.request.get(`${API}/api/dev/outbox`)).json()).items as { to: string; text: string }[];
  const link = (to: string) => new URL([...outbox].reverse().find((m) => m.to === to && /\/i\//.test(m.text))!.text.match(/https?:\/\/\S+\/i\/[A-Za-z0-9_-]+/)![0]).pathname;
  await answer(playwright.request, link('persona001@andina.example'));
  await answer(playwright.request, link('persona002@andina.example'));
  await answer(playwright.request, link('persona003@andina.example'), ['P5']);

  // Results: 3 completed, P5 with one answer pending review (not in the percentages).
  await page.goto(`/campaigns/${id}`);
  await page.getByTestId('open-results').click();
  await expect(page.getByTestId('results-completed')).toHaveText('3');
  await expect(page.getByTestId('results-pending')).toBeVisible();
  const p5 = page.locator('[data-testid="results-question"][data-question="P5"]');
  await expect(p5).toContainText('n = 2');
  await expect(p5).toContainText('1 pendientes de revisión');
  await page.screenshot({ path: 'test-results/cambios4-results.png', fullPage: true });

  // Review: the conversation and the decision.
  await page.getByTestId('go-review').first().click();
  const item = page.getByTestId('review-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('depende');
  await page.getByTestId('review-option-ALGUNAS_VECES').check();
  await page.getByTestId('review-note').fill('Depende del momento: algunas veces');
  await page.screenshot({ path: 'test-results/cambios4-review.png', fullPage: true });
  await page.getByTestId('review-save').click();
  await expect(page.getByTestId('review-empty')).toBeVisible();
  await page.getByTestId('review-filter-reviewed').click();
  await expect(page.getByTestId('review-done')).toBeVisible();

  // Results updated: no pending answers, n = 3 in P5.
  await page.goto(`/campaigns/${id}/results`);
  await expect(page.getByTestId('results-pending')).toHaveCount(0);
  await expect(page.locator('[data-testid="results-question"][data-question="P5"]')).toContainText('n = 3');

  // Individual answers only after the confidentiality notice; open answers apart.
  await page.goto(`/campaigns/${id}/responses`);
  await expect(page.getByTestId('responses-table')).toHaveCount(0);
  await page.getByTestId('responses-accept').click();
  await expect(page.getByTestId('responses-row')).toHaveCount(3);
  await expect(page.getByTestId('responses-comments')).toContainText('Todo bien, gracias.');
  await expect(page.getByTestId('responses-small-groups')).toBeVisible();
  await page.screenshot({ path: 'test-results/cambios4-responses.png', fullPage: true });

  // TEMPORARY test aid (decision 98): open a person's interview from the per-person progress table.
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('test-links-notice')).toBeVisible();
  await page.getByTestId('test-link-5').click();
  const open = page.getByTestId('test-link-open');
  await expect(open).toHaveAttribute('href', /\/i\/[A-Za-z0-9_-]{20,}$/);
  await open.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/cambios4-test-link.png' });
  const [tab] = await Promise.all([page.context().waitForEvent('page'), open.click()]);
  await expect(tab.getByTestId('start-interview')).toBeVisible();
  await tab.getByTestId('start-interview').click();
  await expect(tab.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P1');
});
