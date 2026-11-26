/**
 * Screenshots of «cambios #3» (docs/presentacion/img/cambios3, explained in docs/presentacion/informe-cambios-3.md):
 * change group 3 of F+f (audit types, Bienestar, maximum, no activation) and the conversational interview.
 *
 * Runs against the STAGING server, so the interview shows the real AI (Google Gemini):
 *   E2E_BASE_URL=https://efr-staging.bumii.ai npm run screenshots -- cambios3
 * Synthetic data only: the sample has no emails (paper codes), so nothing is sent. The AI answers may vary slightly
 * between runs; the script answers again with a plainer sentence if a question stays open.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login, logout } from '../helpers';

const ROOT = join(__dirname, '../..');
const OUT = join(ROOT, 'docs/presentacion/img/cambios3');
/** Auditor of ICONTEC (Colombia): the organization is in Bogotá, so «today» still has its 9:00 opening late in the European evening. */
const AUDITOR = 'auditor1@auditoria.example';
const SUPERADMIN = 'superadmin.fundacion@masfamilia.example';
mkdirSync(OUT, { recursive: true });

const shot = async (page: Page, name: string, fullPage = false) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
};
const phone = (browser: Browser) =>
  browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
const todayBogota = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
/** The form preview uses tomorrow, so it does not warn that the window starts in the past (captures taken in the evening). */
const tomorrowBogota = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + 86_400_000));

/** Sample without emails (paper codes): nothing is sent from staging. */
const sample = (n: number) => {
  const sex = ['Mujer', 'Hombre', 'Mujer', 'No indica'];
  const age = ['<30', '30-40', '41-50', '51-60', '>60'];
  const rows = Array.from({ length: n }, (_, i) => ['SIN_CORREO', sex[i % 4], age[i % 5], i % 2 ? 'Sede central' : 'Planta norte', i % 3 ? 'Técnico/a' : 'Operario/a'].join(','));
  return Buffer.from(['correo,sexo,tramo_edad,centro_trabajo,tipo_puesto', ...rows].join('\n'));
};

/** Sends a written answer and waits for the next message. */
async function say(p: Page, text: string) {
  const before = await p.getByTestId('chat-message').count();
  await p.getByTestId('chat-text').fill(text);
  await p.getByTestId('chat-send').click();
  // The AI's next message (or the end of the interview, which adds none).
  await expect
    .poll(async () => (await p.getByTestId('chat-message').count()) > before + 1 || (await p.getByTestId('chat-done').isVisible()), { timeout: 45_000 })
    .toBe(true);
}
const current = (p: Page) => p.getByTestId('chat-answer').getAttribute('data-question');
const toBottom = (p: Page) => p.mouse.wheel(0, 100_000);

/** Answers the current question with the first sentence, then plainer ones while the AI keeps asking. */
async function answer(p: Page, code: string, sentences: string[]) {
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', code, { timeout: 45_000 });
  for (const s of sentences) {
    await say(p, s);
    if ((await p.getByTestId('chat-done').isVisible()) || (await current(p)) !== code) return;
  }
}

test('cambios #3 presentation screenshots (staging, Gemini)', async ({ page, browser }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.setDefaultTimeout(30_000);
  page.on('dialog', (d) => void d.accept());

  // ---------- 01-02 · Nueva auditoría: tipo inicial/renovación y componente de Bienestar
  await login(page, AUDITOR, 'ICONTEC');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/login'));
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const org = options.organizations.find((o: { name: string }) => o.name.startsWith('Andina')) ?? options.organizations[0];
  await page.goto('/campaigns/new');
  // Preselected when the auditor has a single organization.
  await page.getByTestId('cf-organization').click();
  await page.getByRole('option', { name: /^\s*Andina/ }).click();
  await expect(page.getByTestId('cf-organization')).toContainText(org.name);
  await page.getByTestId('cf-reference').fill('Renovación 2026 con Bienestar');
  await page.getByTestId('cf-audit-type').click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await shot(page, '01-tipo-de-auditoria-inicial-o-renovacion');
  await page.getByRole('option', { name: /renovaci/i }).click();
  await page.getByTestId('cf-start-date').fill(tomorrowBogota());
  await page.getByTestId('cf-scope').fill('120');
  await page.getByTestId('cf-excellence').getByRole('switch').click();
  await page.getByTestId('cf-wellbeing').getByRole('switch').click();
  await expect(page.getByTestId('cf-excellence').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('cf-preview')).toContainText('P11');
  await shot(page, '02-nueva-auditoria-con-bienestar', true);

  // The audit itself is created through the API (same data).
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: org.id, reference: 'Renovación 2026 con Bienestar', norm: '1000-1', auditType: 'renovacion', excellence: true, wellbeing: true, interviewStartDate: todayBogota(), scopeSize: 120, languages: ['es'] },
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).campaign.id as string;
  const upload = await page.request.post(`/api/campaigns/${id}/sample`, { multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: sample(12) } } });
  expect(upload.ok()).toBe(true);

  // ---------- 03-05 · Máximo por encima de la muestra (fallo corregido) y auditoría programada
  await page.goto(`/campaigns/${id}/edit`);
  await expect(page.getByTestId('cf-reference')).toHaveValue('Renovación 2026 con Bienestar');
  await page.waitForTimeout(1000);
  await page.getByTestId('cf-max').fill('30');
  await page.getByTestId('cf-max').blur();
  await expect(page.getByTestId('cf-maximum')).toHaveText('30');
  await shot(page, '03-editar-maximo-mayor-que-la-muestra', true);
  await page.getByTestId('cf-submit').click();
  await page.waitForURL(new RegExp(`/campaigns/${id}$`));
  await expect(page.getByTestId('scheduled-notice')).toBeVisible();
  await expect(page.getByTestId('maximum-above-sample')).toBeVisible();
  await shot(page, '04-auditoria-programada-sin-activacion');
  await shot(page, '05-ficha-programada-completa', true);

  // ---------- 06 · Se abre sola (el worker la pasa a «En curso» el día de comienzo)
  await expect
    .poll(async () => (await (await page.request.get(`/api/campaigns/${id}`)).json()).campaign.status, { timeout: 150_000, intervals: [5000] })
    .toBe('en_curso');
  await page.reload();
  await expect(page.getByTestId('campaign-status')).toHaveText('En curso');
  await page.getByRole('heading', { name: /historial/i }).scrollIntoViewIfNeeded();
  await shot(page, '06-abierta-sola-historial');
  await page.goto('/campaigns');
  await page.getByTestId('campaign-filter-status').click();
  await shot(page, '07-filtro-de-estados');
  await page.keyboard.press('Escape');

  // Paper codes and the campaign landing.
  const csv = await (await page.request.get(`/api/campaigns/${id}/access-codes?format=csv`)).text();
  const codes = [...csv.matchAll(/\b[A-HJKMNP-Z2-9]{4}-?[A-HJKMNP-Z2-9]{4}\b/g)].map((m) => m[0]);
  const slug = csv.match(/\/c\/([a-z2-9]{10})/)?.[1] ?? (await (await page.request.get(`/api/campaigns/${id}`)).json()).campaign.slug;
  await logout(page);

  // ---------- 08-17 · La entrevista conversada, en el móvil (IA real)
  const ctx = await phone(browser);
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(`/c/${slug}`);
  await p.getByTestId('access-code').fill(codes[0]);
  await p.getByTestId('access-submit').click();
  await p.getByTestId('start-interview').click();
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P1');
  await expect(p.locator('.options button')).toHaveCount(0);
  await shot(p, '08-movil-pregunta-sin-botones');

  // The person asks what the efr Model is → approved explanation, same question again.
  await say(p, '¿Qué modelo es el efr?');
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P1');
  await toBottom(p);
  await shot(p, '09-movil-explicacion-aprobada');
  await shot(p, '09b-movil-explicacion-aprobada-completa', true);
  await answer(p, 'P1', ['Ah, vale. Sí, me suena de una reunión', 'Sí']);

  // P2: no information received is a valid answer (not an abstention).
  await answer(p, 'P2', ['Solo lo comentaron en una reunión, por correo nunca me ha llegado nada', 'Reuniones']);
  await answer(p, 'P3.1', ['¿Qué es un mánager efr?', 'Pues no, no sé quién es', 'No']);
  await toBottom(p);
  await shot(p, '10-movil-explica-y-registra');

  // A hedged answer → the AI proposes its interpretation to confirm.
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P3.2');
  await say(p, 'Puede que sí, aunque no estoy muy seguro');
  if ((await current(p)) === 'P3.2') {
    await toBottom(p);
    await shot(p, '11-movil-confirmacion');
  }
  await answer(p, 'P3.2', ['Sí, eso es', 'Sí']);
  await answer(p, 'P3.3', ['Sí, conozco el catálogo', 'Sí']);

  // Something unrelated → brought back to the question; an incoherent answer → asked to be concrete.
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P4');
  await say(p, 'Hoy hace muy buen tiempo, ¿no?');
  if ((await current(p)) === 'P4') {
    await toBottom(p);
    await shot(p, '12-movil-reconduce');
  }
  await answer(p, 'P4', ['Diría que por encima de las empresas que conozco', 'Por encima']);
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P5');
  await say(p, 'Depende mucho del jefe: mi jefa actual sí, el anterior no tanto');
  if ((await current(p)) === 'P5') {
    await toBottom(p);
    await shot(p, '13-movil-propone-interpretacion');
  }
  await answer(p, 'P5', ['Sí, algunas veces', 'Algunas veces']);
  await answer(p, 'P6', ['Positiva, nadie pone pegas', 'Positiva']);
  await answer(p, 'P7', ['Algunas veces, en los cierres de mes', 'Algunas veces']);
  await answer(p, 'P7.1', ['Me lo compensan con días libres', 'Con tiempo libre']);
  await answer(p, 'P8', ['Ha habido un avance moderado', 'Avance moderado']);
  await answer(p, 'P9', ['Sí, creo que es excelente', 'Sí']);

  // Bienestar: agreement scale (P11–P13) and open questions (P14–P15).
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P11');
  await toBottom(p);
  await shot(p, '14-movil-bienestar-escala-de-acuerdo');
  await answer(p, 'P11', ['Estoy de acuerdo', 'De acuerdo']);
  await answer(p, 'P12', ['Ni de acuerdo ni en desacuerdo', 'Ni de acuerdo ni en desacuerdo']);
  await answer(p, 'P13', ['De acuerdo', 'De acuerdo']);
  await expect(p.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P14');
  await toBottom(p);
  await shot(p, '15-movil-bienestar-texto-libre');
  await answer(p, 'P14', ['Poder teletrabajar dos días a la semana']);
  await answer(p, 'P15', ['Más pausas activas y horarios de reuniones razonables']);
  await answer(p, 'P10', ['Nada más, gracias']);
  await expect(p.getByTestId('chat-done')).toBeVisible();
  await shot(p, '16-movil-fin');
  await shot(p, '17-movil-conversacion-completa', true);
  await ctx.close();

  // ---------- 18 · La conversación en el ordenador
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const d = await desk.newPage();
  d.setDefaultTimeout(30_000);
  await d.goto(`/c/${slug}`);
  await d.getByTestId('access-code').fill(codes[1]);
  await d.getByTestId('access-submit').click();
  await d.getByTestId('start-interview').click();
  await expect(d.getByTestId('chat-answer')).toHaveAttribute('data-question', 'P1');
  await say(d, 'No sé muy bien a qué se refiere, ¿qué es eso del Modelo efr?');
  await say(d, 'Entonces no, no lo conocía');
  await toBottom(d);
  await shot(d, '18-escritorio-conversacion');
  await desk.close();

  // ---------- 19 · El cuestionario v3 para la Fundación: frases de respuesta y explicaciones para la IA
  await login(page, SUPERADMIN);
  await page.goto('/admin/config/questionnaires');
  await expect(page.getByTestId('q-explanation').first()).toBeVisible();
  await page.getByTestId('q-explanation').first().evaluate((el) => el.closest('tr')!.scrollIntoView({ block: 'start' }));
  await page.mouse.move(0, 0);
  await shot(page, '19-cuestionario-v3-explicaciones');
  await logout(page);
});
