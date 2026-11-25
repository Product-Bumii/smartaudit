/**
 * Phase 2 screenshots (docs/presentacion/img/fase2, explained in docs/presentacion/fase-2.md).
 * Run with `npm run screenshots` against a FRESH `dev:local` (mock AI: questions show the official text).
 * Scenario with synthetic data: auditor2 (AENOR) schedules a renewal audit with excellence for Montaña Textil;
 * the window is opened with the local dev helper; people answer on their phones; the auditor follows the
 * progress and extends the window; the coordinator sees only the aggregate.
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { login, logout } from '../helpers';

const ROOT = join(__dirname, '../..');
const OUT = join(ROOT, 'docs/presentacion/img/fase2');
const SAMPLES = join(ROOT, 'seed/samples');
const API = process.env.E2E_API_URL ?? 'http://localhost:3000';
const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const AUDITOR = 'auditor2@auditoria.example';
const COORDINATOR = 'coordinacion@aenor.example';

const shot = async (page: Page, name: string, fullPage = false) => {
  if (fullPage) await page.mouse.wheel(0, -100_000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
};

const phone = (browser: Browser) =>
  browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });

/** Today in Madrid (YYYY-MM-DD). */
const todayMadrid = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());

/** Invitation link (path) of `to`, from the local dev outbox. */
async function invitationPath(request: APIRequestContext, to: string): Promise<string> {
  const { items } = (await (await request.get(`${API}/api/dev/outbox`)).json()) as { items: { to: string; text: string }[] };
  const mail = [...items].reverse().find((m) => m.to === to && /\/i\//.test(m.text));
  return new URL(mail!.text.match(/https?:\/\/\S+\/i\/[A-Za-z0-9_-]+/)![0]).pathname;
}

/** A synthetic person answering through the API (first option, short comment) — to give the progress figures. */
async function answerAll(playwright: { request: { newContext: (o: { baseURL: string }) => Promise<APIRequestContext> } }, path: string, stopAfter = 99) {
  const ctx = await playwright.request.newContext({ baseURL: WEB });
  await ctx.post(`/api${path.replace('/i/', '/participant/i/')}`);
  let s = await (await ctx.post('/api/participant/interview/start', { data: { language: 'es', acceptNotice: true } })).json();
  for (let n = 0; s.question && n < stopAfter; n++) {
    const q = s.question;
    const data =
      q.type === 'free_text'
        ? { kind: 'text', questionCode: q.code, text: 'Sin más comentarios.' }
        : { kind: 'options', questionCode: q.code, optionCodes: [q.options[n % q.options.length].code === 'OTROS' ? q.options[0].code : q.options[n % q.options.length].code] };
    s = await (await ctx.post('/api/participant/interview/answer', { data })).json();
  }
  await ctx.dispose();
}

/** Waits until the chat shows a new message after an action. */
async function after(page: Page, action: () => Promise<void>) {
  const before = await page.getByTestId('chat-message').count();
  await action();
  await expect.poll(() => page.getByTestId('chat-message').count()).toBeGreaterThan(before);
}

test('phase 2 presentation screenshots', async ({ page, browser, playwright }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on('dialog', (d) => void d.accept());

  // ---------- Setup: renewal with excellence (P8 and P9 apply), 30 people (25 with email, 5 with paper codes)
  await login(page, AUDITOR);
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const org = options.organizations.find((o: { name: string }) => o.name.startsWith('Montaña'));
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: org.id, reference: 'Auditoría de renovación 2026', norm: '1000-1', auditType: 'renovacion', excellence: true, interviewStartDate: todayMadrid(), scopeSize: 120, maxCompleted: 25, languages: ['es'] },
  });
  const id = (await created.json()).campaign.id as string;
  await page.request.post(`/api/campaigns/${id}/sample`, {
    multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: readFileSync(join(SAMPLES, 'muestra-valida-30.csv')) } },
  });

  // ---------- 01-02 · Auditoría programada (no launch since change group 3)
  // TODO(cambio 4): rename the images and review the presentation text (docs/presentacion/cambios-pendientes.md).
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('scheduled-notice')).toBeVisible();
  await shot(page, '01-lanzar-auditoria');
  await page.goto(`/campaigns/${id}/edit`);
  await expect(page.getByTestId('cf-wellbeing')).toBeVisible();
  await shot(page, '02-auditoria-envios-activos', true);

  // The window opens (local dev helper; in the servers it opens at 9:00 of the start date) → en curso + invitations.
  await page.request.post(`${API}/api/dev/campaigns/${id}/open-now`);

  // ---------- 03-04 · Correos de invitación y recordatorio (rendered with the efr brand)
  const { campaign: launched } = await (await page.request.get(`/api/campaigns/${id}`)).json();
  const closes = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${launched.window.closeDate}T12:00:00Z`));
  const render = (key: string) =>
    execSync(
      `npx tsx -e "import { renderTemplate } from './packages/mail/src'; process.stdout.write(renderTemplate('${key}','es',{url:'https://efr-staging.bumii.ai/i/demo',organization:'Montaña Textil S.L.',closes:'${closes}'}).html)"`,
      { cwd: ROOT },
    ).toString();
  const mailPage = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await mailPage.setContent(render('invitation'));
  await mailPage.screenshot({ path: join(OUT, '03-correo-invitacion.png'), fullPage: true });
  await mailPage.setContent(render('reminder'));
  await mailPage.screenshot({ path: join(OUT, '04-correo-recordatorio.png'), fullPage: true });
  await mailPage.close();

  // ---------- 05-12 · La persona participante, en el móvil
  const link = await invitationPath(page.request, 'persona001@andina.example');
  const ctx = await phone(browser);
  const p = await ctx.newPage();
  await p.goto(link);
  await expect(p.getByTestId('code-ok')).toHaveText('bienvenida');
  await shot(p, '05-movil-enlace-personal', true);
  await p.getByTestId('start-interview').click();
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P1');
  await shot(p, '06-movil-primera-pregunta');

  await after(p, () => p.getByTestId('chat-option-SI').click());
  // P2: multiple choice, two media selected before sending.
  await p.getByTestId('chat-option-MAIL').click();
  await p.getByTestId('chat-option-REUNIONES').click();
  await p.getByTestId('chat-option-MAIL').scrollIntoViewIfNeeded();
  await shot(p, '07-movil-respuesta-multiple');
  await after(p, () => p.getByTestId('chat-send-options').click());

  // P3.1 in their own words (classified by the AI).
  await p.getByTestId('chat-text').fill('Ni idea, la verdad');
  await after(p, () => p.getByTestId('chat-send').click());
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P3.2');
  await shot(p, '08-movil-respuesta-con-sus-palabras');

  await after(p, () => p.getByTestId('chat-option-NO').click());
  // P3.3: an answer that does not fit → one neutral clarification.
  await p.getByTestId('chat-text').fill('¿cuál catálogo?');
  await after(p, () => p.getByTestId('chat-send').click());
  await shot(p, '09-movil-aclaracion');
  await after(p, () => p.getByTestId('chat-option-SI').click());

  // P4-P6 with buttons, P7 «siempre» → P7.1 with its optional text.
  await after(p, () => p.getByTestId('chat-option-POR_ENCIMA').click());
  await after(p, () => p.getByTestId('chat-option-ALGUNAS_VECES').click());
  await after(p, () => p.getByTestId('chat-option-POSITIVA').click());
  await after(p, () => p.getByTestId('chat-option-SIEMPRE').click());
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P7.1');
  await p.getByTestId('chat-option-SI_TIEMPO').click();
  await p.getByTestId('chat-option-text').fill('días libres');
  await shot(p, '10-movil-texto-complementario');
  await after(p, () => p.getByTestId('chat-send-options').click());

  // P8 (renewal) and P9 (excellence) apply; «prefiero no responder» in P9; comment in P10.
  await after(p, () => p.getByTestId('chat-option-MODERADO').click());
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P9');
  await after(p, () => p.getByTestId('chat-abstain').click());
  await p.getByTestId('chat-text').fill('Me gustaría más flexibilidad en verano.');
  await after(p, () => p.getByTestId('chat-send').click());
  await expect(p.getByTestId('chat-done')).toBeVisible();
  await shot(p, '11-movil-fin-de-la-entrevista');
  await ctx.close();

  // Pause and resume: another person answers three questions, closes and opens the link again.
  const link2 = await invitationPath(page.request, 'persona002@andina.example');
  await answerAll(playwright, link2, 3);
  const ctx2 = await phone(browser);
  const p2 = await ctx2.newPage();
  await p2.goto(link2);
  await expect(p2.getByTestId('start-interview')).toHaveText(/continuar la entrevista/i);
  await shot(p2, '12-movil-continuar-la-entrevista', true);
  await ctx2.close();

  // ---------- 13 · El chat en el ordenador
  const link3 = await invitationPath(page.request, 'persona003@andina.example');
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const d = await desk.newPage();
  await d.goto(link3);
  await d.getByTestId('start-interview').click();
  await after(d, () => d.getByTestId('chat-option-SI').click());
  await d.getByTestId('chat-option-INTRANET').click();
  await after(d, () => d.getByTestId('chat-send-options').click());
  await shot(d, '13-escritorio-chat');
  await desk.close();

  // More people answer (progress figures): 8 complete, 1 more in progress.
  for (const n of [4, 5, 7, 8, 9, 10, 11, 13]) await answerAll(playwright, await invitationPath(page.request, `persona${String(n).padStart(3, '0')}@andina.example`));

  // ---------- 14-15 · Seguimiento del auditor
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('campaign-status')).toHaveText('En curso');
  await expect(page.getByTestId('progress-completed')).toHaveText('9');
  await page.getByTestId('progress-section').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.move(0, 0);
  await shot(page, '14-auditor-avance');
  const { campaign } = await (await page.request.get(`/api/campaigns/${id}`)).json();
  const close = new Date(`${campaign.window.closeDate}T12:00:00Z`);
  close.setUTCDate(close.getUTCDate() + 7);
  await page.getByTestId('extend-date').fill(close.toISOString().slice(0, 10));
  await page.getByTestId('extend-submit').click();
  await page.waitForTimeout(4500);
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('progress-people')).toBeVisible();
  await expect(page.getByTestId('campaign-extension')).toBeVisible();
  await shot(page, '15-auditor-ficha-en-curso-completa', true);
  await page.goto('/campaigns');
  await page.getByTestId('campaign-filter-status').click();
  await page.getByRole('option', { name: 'En curso' }).click();
  await page.waitForLoadState('networkidle');
  await shot(page, '16-auditor-auditorias-en-curso');
  await logout(page);

  // ---------- 17 · El coordinador: solo el agregado
  await login(page, COORDINATOR);
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('aggregate-notice')).toBeVisible();
  await expect(page.getByTestId('progress-completed')).toHaveText('9');
  await expect(page.getByTestId('progress-people')).toHaveCount(0);
  await shot(page, '17-coordinador-avance-agregado', true);
  await logout(page);
});
