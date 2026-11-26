/**
 * Screenshots of «cambios 4», bloques 1 y 2 (docs/presentacion/img/cambios4, explained in
 * docs/presentacion/informe-cambios-4.md): results, the auditor's review queue and the individual answers.
 *
 * Runs against the STAGING server (real AI, Google Gemini), with synthetic data only:
 *   E2E_BASE_URL=https://efr-staging.bumii.ai npm run screenshots -- cambios4
 * Seven synthetic people answer in their own words through the participant API (paper codes, nothing is sent);
 * two of them leave one answer unclear on purpose, so it ends in the review queue.
 * Mind the limit of 10 code accesses per IP every 15 minutes.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login, logout } from '../helpers';

const ROOT = join(__dirname, '../..');
const OUT = join(ROOT, 'docs/presentacion/img/cambios4');
const AUDITOR = 'auditor1@auditoria.example'; // ICONTEC, organization in Bogotá
const COORDINATOR = 'coordinacion@icontec.example';
const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
mkdirSync(OUT, { recursive: true });

const shot = async (page: Page, name: string, fullPage = false) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
};
const shotOf = async (l: Locator, name: string) => {
  await l.scrollIntoViewIfNeeded();
  await l.page().waitForTimeout(500);
  await l.screenshot({ path: join(OUT, `${name}.png`) });
};
const todayBogota = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());

const SAMPLE = [
  ['Mujer', '30-40', 'Sede central', 'Técnico/a'],
  ['Hombre', '41-50', 'Sede central', 'Técnico/a'],
  ['Mujer', '<30', 'Planta norte', 'Operario/a'],
  ['Hombre', '51-60', 'Planta norte', 'Operario/a'],
  ['Mujer', '41-50', 'Sede central', 'Administrativo/a'],
  ['Mujer', '30-40', 'Planta norte', 'Técnico/a'],
  ['Hombre', '30-40', 'Sede central', 'Operario/a'],
  ['Mujer', '>60', 'Sede central', 'Técnico/a'],
];
const sampleCsv = () => Buffer.from(['correo,sexo,tramo_edad,centro_trabajo,tipo_puesto', ...SAMPLE.map((r) => ['SIN_CORREO', ...r].join(','))].join('\n'));

/** What each synthetic person writes, by question (several entries = what they say if asked again). */
type Script = Record<string, string | string[]>;
const PEOPLE: Script[] = [
  { P1: 'Sí', P2: 'Por la intranet y por correo', 'P3.1': 'Sí', 'P3.2': 'No', 'P3.3': 'Sí', P4: 'Por encima', P5: 'Siempre', P6: 'Positiva', P7: 'Algunas veces', 'P7.1': 'Con tiempo libre', P8: 'Ha habido un gran avance', P9: 'Sí', P11: 'De acuerdo', P12: 'De acuerdo', P13: 'De acuerdo', P14: 'El horario flexible y poder teletrabajar', P15: 'Más pausas durante la jornada', P10: 'Estoy contento con las medidas de conciliación' },
  { P1: 'Sí', P2: 'En las reuniones de equipo', 'P3.1': 'No', 'P3.2': 'No', 'P3.3': 'Sí', P4: 'En la media', P5: 'Algunas veces', P6: 'Neutra', P7: 'Nunca', P8: 'Un avance moderado', P9: 'No', P11: 'Ni de acuerdo ni en desacuerdo', P12: 'De acuerdo', P13: 'En desacuerdo', P14: 'La jornada intensiva de verano', P15: 'Formación sobre gestión del estrés', P10: 'Nada más' },
  { P1: 'Sí', P2: 'Por el tablón de anuncios de la planta', 'P3.1': 'Sí', 'P3.2': 'No', 'P3.3': 'No', P4: 'Por encima', P5: 'Siempre', P6: 'Positiva', P7: 'Siempre', 'P7.1': 'Me lo pagan como horas extra', P8: 'Un avance moderado', P9: 'Sí', P11: 'De acuerdo', P12: 'Ni de acuerdo ni en desacuerdo', P13: 'De acuerdo', P14: 'El seguro médico', P15: 'Revisar las cargas de trabajo', P10: 'Sin comentarios' },
  { P1: 'No', P2: 'No me ha llegado ninguna información', 'P3.1': 'No lo sé', 'P3.2': 'No lo sé', 'P3.3': 'No', P4: 'Por debajo', P5: 'Nunca', P6: 'Negativa', P7: 'Siempre', 'P7.1': 'No, no me lo compensan', P8: 'Ningún avance', P9: 'No', P11: 'En desacuerdo', P12: 'En desacuerdo', P13: 'En desacuerdo', P14: 'Ninguna en especial', P15: 'Escuchar más a la plantilla', P10: 'Me gustaría más flexibilidad horaria' },
  { P1: 'Sí', P2: 'Por correo y de boca en boca entre compañeros', 'P3.1': 'Sí', 'P3.2': 'Sí', 'P3.3': 'Sí', P4: 'Por encima', P5: 'Siempre', P6: 'Positiva', P7: 'Nunca', P8: 'No lo sé', P9: 'Sí', P11: 'De acuerdo', P12: 'De acuerdo', P13: 'De acuerdo', P14: 'Las actividades deportivas', P15: 'Más actividades de ese tipo', P10: 'Todo bien' },
  // Unclear on purpose in P5: «depende» three times → review.
  { P1: 'Sí', P2: 'En reuniones', 'P3.1': 'Sí', 'P3.2': 'No', 'P3.3': 'Sí', P4: 'En la media', P5: ['depende', 'depende', 'depende'], P6: 'Positiva', P7: 'Nunca', P8: 'Ha habido un gran avance', P9: 'Sí', P11: 'De acuerdo', P12: 'De acuerdo', P13: 'Ni de acuerdo ni en desacuerdo', P14: 'La flexibilidad', P15: 'Nada en particular', P10: 'Nada más' },
  // Off topic in P6 three times → review.
  { P1: 'Sí', P2: 'Por correo', 'P3.1': 'No', 'P3.2': 'No', 'P3.3': 'No', P4: 'En la media', P5: 'Algunas veces', P6: ['El comedor tiene un menú muy variado', 'El comedor tiene un menú muy variado', 'El comedor tiene un menú muy variado'], P7: 'Algunas veces', 'P7.1': 'Con días libres', P8: 'No lo sé', P9: 'No', P11: 'De acuerdo', P12: 'Ni de acuerdo ni en desacuerdo', P13: 'De acuerdo', P14: 'Los horarios', P15: 'Más comunicación interna', P10: 'Gracias' },
];

/** One synthetic person answers the whole interview through the participant API. */
async function interview(request: { newContext: (o: { baseURL: string }) => Promise<APIRequestContext> }, slug: string, code: string, script: Script) {
  const ctx = await request.newContext({ baseURL: WEB });
  expect((await ctx.post(`/api/participant/c/${slug}/access`, { data: { code } })).ok()).toBe(true);
  let s = await (await ctx.post('/api/participant/interview/start', { data: { language: 'es', acceptNotice: true } })).json();
  const tries: Record<string, number> = {};
  for (let guard = 0; s.question && guard < 80; guard++) {
    const q = s.question;
    const said = script[q.code] ?? (q.type === 'free_text' ? 'Nada que añadir' : q.options[0].label);
    const list = Array.isArray(said) ? said : [said];
    const n = tries[q.code] ?? 0;
    tries[q.code] = n + 1;
    // A clear answer that the AI still asks about: confirm it with «Sí, eso es» once, then the same words again.
    const text = n < list.length ? list[n] : Array.isArray(said) ? list[list.length - 1] : n === 1 ? 'Sí, eso es' : list[0];
    const res = await ctx.post('/api/participant/interview/answer', { data: { kind: 'text', questionCode: q.code, text } });
    expect(res.ok(), await res.text()).toBe(true);
    s = await res.json();
  }
  expect(s.state).toBe('completed');
  await ctx.dispose();
}

test('cambios 4 presentation screenshots (staging, Gemini)', async ({ page, playwright, browser }) => {
  test.skip(!!process.env.ONLY_CAPTURE_17, 'only capture 17');
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.setDefaultTimeout(30_000);

  // ---------- Setup: renewal with excellence and Bienestar, 8 people with paper codes; it opens by itself today.
  await login(page, AUDITOR, 'ICONTEC');
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/login'));
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const org = options.organizations.find((o: { name: string }) => o.name.startsWith('Andina')) ?? options.organizations[0];
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: org.id, reference: 'Renovación 2026 · resultados', norm: '1000-1', auditType: 'renovacion', excellence: true, wellbeing: true, interviewStartDate: todayBogota(), scopeSize: 120, languages: ['es'] },
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).campaign.id as string;
  expect((await page.request.post(`/api/campaigns/${id}/sample`, { multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: sampleCsv() } } })).ok()).toBe(true);
  await expect
    .poll(async () => (await (await page.request.get(`/api/campaigns/${id}`)).json()).campaign.status, { timeout: 150_000, intervals: [5000] })
    .toBe('en_curso');
  const csv = await (await page.request.get(`/api/campaigns/${id}/access-codes?format=csv`)).text();
  const codes = [...csv.matchAll(/\b[A-HJKMNP-Z2-9]{4}-?[A-HJKMNP-Z2-9]{4}\b/g)].map((m) => m[0]);
  const slug = csv.match(/\/c\/([a-z2-9]{10})/)?.[1] ?? (await (await page.request.get(`/api/campaigns/${id}`)).json()).campaign.slug;
  for (const [i, script] of PEOPLE.entries()) await interview(playwright.request, slug, codes[i], script);

  // ---------- 01 · La ficha: nueva sección «Resultados y revisión»
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByTestId('results-section')).toBeVisible();
  await shotOf(page.getByTestId('results-section'), '01-ficha-seccion-resultados');

  // ---------- 02-06 · Resultados
  await page.getByTestId('open-results').click();
  await expect(page.getByTestId('results-completed')).toHaveText(String(PEOPLE.length));
  await expect(page.getByTestId('results-pending')).toBeVisible();
  await shot(page, '02-resultados-resumen');
  await shotOf(page.getByTestId('results-71'), '03-resultados-seccion-7-1');
  const q = (code: string) => page.locator(`[data-testid="results-question"][data-question="${code}"]`);
  await q('P2').locator('details').evaluateAll((els) => els.forEach((d) => d.setAttribute('open', '')));
  await shotOf(q('P2'), '04-resultados-p2-respuesta-multiple');
  await shotOf(q('P7.1'), '05-resultados-p7-1-condicionada');
  await shotOf(q('P8'), '06-resultados-p8-fuera-de-base');
  await shotOf(q('P5'), '07-resultados-p5-pendiente');
  await shot(page, '08-resultados-completo', true);

  // ---------- 09-12 · Revisión
  await page.goto(`/campaigns/${id}/review`);
  await expect(page.getByTestId('review-item').first()).toBeVisible();
  await shot(page, '09-revision-cola-pendientes');
  const p5 = page.locator('[data-testid="review-item"][data-question="P5"]');
  await p5.getByTestId('review-option-ALGUNAS_VECES').check();
  await p5.getByTestId('review-note').fill('Dice que depende del momento: se codifica como «algunas veces».');
  await shotOf(p5, '10-revision-decision');
  await p5.getByTestId('review-save').click();
  await expect(p5).toHaveCount(0);
  const p6 = page.locator('[data-testid="review-item"][data-question="P6"]');
  if (await p6.count()) {
    await p6.getByTestId('review-no-valid').check();
    await p6.getByTestId('review-note').fill('Habla del comedor, no de la actitud de la empresa.');
    await p6.getByTestId('review-save').click();
    await expect(p6).toHaveCount(0);
  }
  await page.getByTestId('review-filter-reviewed').click();
  await expect(page.getByTestId('review-done').first()).toBeVisible();
  await shot(page, '11-revision-revisadas');
  await page.goto(`/campaigns/${id}/results`);
  await expect(page.getByTestId('results-completed')).toHaveText(String(PEOPLE.length));
  await shotOf(q('P5'), '12-resultados-p5-tras-revision');

  // ---------- 13-15 · Respuestas individuales
  await page.goto(`/campaigns/${id}/responses`);
  await expect(page.getByTestId('responses-notice')).toBeVisible();
  await shot(page, '13-respuestas-aviso-confidencialidad');
  await page.getByTestId('responses-accept').click();
  await expect(page.getByTestId('responses-row')).toHaveCount(PEOPLE.length);
  await shot(page, '14-respuestas-individuales');
  await shotOf(page.getByTestId('responses-comments'), '15-respuestas-abiertas-disociadas');
  await logout(page);

  // ---------- 16 · El coordinador no ve resultados ni respuestas
  const coord = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  coord.setDefaultTimeout(30_000);
  await login(coord, COORDINATOR);
  await coord.goto(`/campaigns/${id}`);
  await expect(coord.getByTestId('aggregate-notice')).toBeVisible();
  await expect(coord.getByTestId('results-section')).toHaveCount(0);
  await shot(coord, '16-coordinador-sin-resultados');
  await coord.goto(`/campaigns/${id}/results`);
  await expect(coord.getByTestId('results-denied')).toBeVisible();
  await shot(coord, '17-coordinador-resultados-denegado');
});

/** Only capture 17 again (e.g. after a change in that screen), on the latest audit of the main test. */
test('cambios 4 · coordinator denied (capture 17 only)', async ({ page }) => {
  test.skip(!process.env.ONLY_CAPTURE_17, 'set ONLY_CAPTURE_17=1 to run it');
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, COORDINATOR);
  const list = await (await page.request.get('/api/campaigns?q=resultados&sort=createdAt&dir=desc')).json();
  const id = list.items[0].id as string;
  await page.goto(`/campaigns/${id}/results`);
  await expect(page.getByTestId('results-denied')).toBeVisible();
  await shot(page, '17-coordinador-resultados-denegado');
});
