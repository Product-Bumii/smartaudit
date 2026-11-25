/**
 * Generates the screenshots of docs/presentacion (run: `npm run screenshots` against a FRESH `dev:local`).
 * Builds a demo scenario with synthetic data (organizations, audits) and captures each screen in Spanish.
 * Includes the changes 1 (audit entities, coordinator, assigned auditor) and 2 (audits, interview start date,
 * maximum, no Catalan, real audit entities, searchable lists) of docs/presentacion/cambios-pendientes.md.
 */
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { login, logout } from '../helpers';

const ROOT = join(__dirname, '../..');
const OUT = join(ROOT, 'docs/presentacion/img');
const SAMPLES = join(ROOT, 'seed/samples');
const ANDINA = 'Andina Servicios S.A.S. (sintética)';
const COSTA = 'Costa Alimentos S.A.S. (sintética)';
const COORDINATOR = 'coordinacion@icontec.example';
const AUDITOR = 'auditor1@auditoria.example';

/** Synthetic organizations so the lists show the search box and the paginator with real volume. */
const DEMO_ORGS = [
  'Agroindustrial del Valle', 'Banca Solidaria del Norte', 'Clínica Santa Lucía', 'Constructora Horizonte',
  'Cooperativa Lechera Andina', 'Editorial Mar Abierto', 'Energía Verde del Caribe', 'Farmacéutica Boreal',
  'Hoteles Sierra Nevada', 'Ingeniería Puente Alto', 'Laboratorios Aurora', 'Logística Atlántico',
  'Metalúrgica del Ebro', 'Minera Cordillera', 'Panificadora La Espiga', 'Papelera del Cantábrico',
  'Plásticos Levante', 'Seguros Amparo', 'Servicios Médicos Andes', 'Software Brújula',
  'Telecomunicaciones Faro', 'Textiles Guadalquivir', 'Transportes Meseta', 'Universidad del Pacífico',
  'Viñedos Rioja Alta', 'Zapatería Artesana del Sur', 'Acuícola Bahía Azul', 'Bodegas Duero Viejo',
].map((n, i) => ({ name: `${n} (sintética)`, country: i % 2 ? 'ES' : 'CO' }));

const shot = async (page: Page, name: string, fullPage = false) => {
  if (fullPage) await page.mouse.wheel(0, -100_000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
};

/** Navigates again so no snackbar/transition is left on screen. */
const settle = async (page: Page) => {
  await page.goto(page.url());
  await page.waitForLoadState('networkidle');
};

const json = async <T>(res: { json(): Promise<unknown>; ok(): boolean; status(): number }, what: string): Promise<T> => {
  if (!res.ok()) throw new Error(`${what}: HTTP ${res.status()}`);
  return (await res.json()) as T;
};

test('presentation screenshots', async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---------- Demo scenario (API, synthetic data)
  await login(page, 'superadmin.bumii@bumii.example');
  const entities = (await json<{ items: { id: string; name: string }[] }>(await page.request.get('/api/audit-entities'), 'entities')).items;
  const icontec = entities.find((e) => e.name === 'ICONTEC')!;
  const aenor = entities.find((e) => e.name === 'AENOR')!;
  const coordinators = async (entityId: string) =>
    (await json<{ items: { id: string }[] }>(await page.request.get(`/api/audit-entities/${entityId}/coordinators`), 'coordinators')).items;
  const coordIcontec = (await coordinators(icontec.id))[0];
  const coordAenor = (await coordinators(aenor.id))[0];
  for (const [i, o] of DEMO_ORGS.entries()) {
    const co = o.country === 'CO';
    // Most are assigned; a few are left without audit entity (to show that filter).
    const assigned = i % 7 !== 3;
    await json(
      await page.request.post('/api/organizations', {
        data: {
          name: o.name,
          country: o.country,
          timeZone: co ? 'America/Bogota' : 'Europe/Madrid',
          defaultLanguage: 'es',
          auditEntityId: assigned ? (co ? icontec.id : aenor.id) : null,
          coordinatorId: assigned ? (co ? coordIcontec.id : coordAenor.id) : null,
        },
      }),
      `org ${o.name}`,
    );
  }
  await logout(page);

  // The ICONTEC coordinator designates auditor1 for some of the new organizations.
  await login(page, COORDINATOR);
  const assignedToCoord = (
    await json<{ items: { id: string; name: string; auditor: unknown }[] }>(await page.request.get('/api/assigned-organizations?pageSize=100'), 'assigned')
  ).items;
  const auditor1 = (
    await json<{ items: { id: string; email: string }[] }>(await page.request.get(`/api/organizations/${assignedToCoord[0].id}/assignable-auditors`), 'auditors')
  ).items.find((u) => u.email === AUDITOR)!;
  for (const o of assignedToCoord.filter((x) => !x.auditor && x.name !== COSTA).slice(0, 8)) {
    await json(await page.request.put(`/api/organizations/${o.id}/auditor`, { data: { auditorId: auditor1.id } }), 'assign');
  }
  await logout(page);

  // auditor1 (ICONTEC) creates audits in several organizations and states.
  await login(page, AUDITOR, 'ICONTEC');
  await page.waitForURL(/\/my\/organizations/);
  const myOrgs = (await json<{ organizations: { id: string; name: string }[] }>(await page.request.get('/api/campaigns/options'), 'options')).organizations;
  const types = ['inicial', 'mantenimiento', 'renovacion'] as const;
  const created: string[] = [];
  for (const [i, o] of myOrgs.entries()) {
    for (let year = 0; year < (o.name === ANDINA ? 1 : 2); year++) {
      const res = await json<{ campaign: { id: string } }>(
        await page.request.post('/api/campaigns', {
          data: {
            organizationId: o.id,
            reference: `${o.name.replace(' (sintética)', '')} · ${year ? 'renovación' : 'auditoría'} ${2026 + year}`,
            norm: '1000-1',
            auditType: types[(i + year) % 3],
            excellence: false,
            interviewStartDate: `2026-${12 - year}-0${(i % 7) + 1}`,
            scopeSize: 60 + i * 37,
            languages: ['es', 'en'],
          },
        }),
        'campaign',
      );
      created.push(res.campaign.id);
    }
  }
  // No manual cancellation or suspension any more (change group 3): all demo audits stay as drafts.
  await logout(page);

  // ---------- 01-03 · Acceso
  await page.goto('/login');
  await shot(page, '01-acceso');
  await page.getByTestId('login-email').fill(AUDITOR);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('dev-magic-link')).toBeVisible();
  await shot(page, '02-acceso-enlace-en-pantalla');
  await page.getByTestId('dev-magic-link').click();
  await expect(page.getByTestId('account-ICONTEC')).toBeVisible();
  await shot(page, '03-eleccion-de-entidad');
  await page.goto('/login');
  await page.context().clearCookies();

  // ---------- 04-10 · Superadmin (F+f)
  await login(page, 'superadmin.fundacion@masfamilia.example');
  await page.goto('/admin/audit-entities');
  await expect(page.getByRole('link', { name: 'SGS' })).toBeVisible();
  await shot(page, '04-superadmin-entidades-de-auditoria', true);
  await page.getByRole('link', { name: 'AENOR' }).click();
  await expect(page.getByTestId('users-coordinators')).toBeVisible();
  await shot(page, '05-superadmin-ficha-entidad', true);

  await page.goto('/admin/organizations');
  await expect(page.getByTestId('org-table').locator('tbody tr')).toHaveCount(25);
  await shot(page, '06-superadmin-organizaciones');
  await page.getByTestId('org-search').fill('andina');
  await expect(page.getByTestId('org-table').locator('tbody tr')).toHaveCount(2);
  await page.waitForLoadState('networkidle');
  await shot(page, '07-superadmin-organizaciones-busqueda');
  await page.getByRole('link', { name: ANDINA }).click();
  await expect(page.getByTestId('assign-coordinator')).toBeVisible();
  await shot(page, '08-superadmin-ficha-organizacion', true);

  await page.goto('/admin/config/sampling-tables');
  await expect(page.locator('table')).toBeVisible();
  await shot(page, '09-config-tabla-de-minimos', true);
  await page.goto('/admin/config/questionnaires');
  await expect(page.getByText('P7.1').first()).toBeVisible();
  await shot(page, '10-config-cuestionario-m1');
  await logout(page);

  // ---------- 11-14 · Coordinador (ICONTEC)
  await login(page, COORDINATOR);
  await page.waitForURL(/\/my\/organizations/);
  await expect(page.getByTestId('my-orgs')).toContainText(COSTA);
  await page.waitForLoadState('networkidle');
  await shot(page, '11-coordinador-mis-organizaciones');
  const costa = page.locator('tr', { hasText: COSTA });
  await costa.locator('mat-form-field').click();
  await expect(page.getByRole('option', { name: /\(yo\)/ })).toBeVisible();
  await shot(page, '12-coordinador-designar-auditor');
  await page.keyboard.press('Escape');
  await page.goto('/my/auditors');
  await page.getByTestId('new-auditors-email').fill('auditora.demo@auditoria.example');
  await page.getByTestId('add-auditors').click();
  await expect(page.getByTestId('users-auditors')).toContainText('auditora.demo@auditoria.example');
  await settle(page);
  await shot(page, '13-coordinador-auditores');
  await page.goto(`/campaigns/${created[0]}`);
  await expect(page.getByTestId('aggregate-notice')).toBeVisible();
  await shot(page, '14-coordinador-auditoria-solo-avance');
  await logout(page);

  // ---------- 15-21 · Auditor
  await login(page, AUDITOR, 'ICONTEC');
  await page.waitForURL(/\/my\/organizations/);
  await page.waitForLoadState('networkidle');
  await shot(page, '15-auditor-mis-organizaciones');

  await page.locator('tr', { hasText: ANDINA }).getByRole('link', { name: /nueva auditoría/i }).click();
  await expect(page.getByTestId('cf-organization')).toContainText(ANDINA);
  await page.getByTestId('cf-reference').fill('Auditoría de renovación 2026');
  await page.getByTestId('cf-audit-type').click();
  await page.getByRole('option', { name: 'Renovación' }).click();
  await page.getByTestId('cf-start-date').fill('2026-11-25');
  await page.getByTestId('cf-scope').fill('320');
  await expect(page.getByTestId('cf-minimum')).toHaveText('26');
  await page.getByTestId('cf-max').fill('20');
  await expect(page.getByTestId('cf-problems')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, '17-nueva-auditoria-maximo-no-valido', true);
  await page.getByTestId('cf-max').fill('30');
  await expect(page.getByTestId('cf-maximum')).toHaveText('30');
  await page.getByTestId('cf-excellence').getByRole('switch').click();
  await expect(page.getByTestId('cf-excellence').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('cf-problems')).toHaveCount(0);
  await page.waitForTimeout(800);
  await shot(page, '16-nueva-auditoria-calculo-automatico', true);
  await page.getByTestId('cf-submit').click();
  await expect(page.getByTestId('campaign-status')).toHaveText('Borrador');
  const campaignUrl = page.url();
  await settle(page);
  await shot(page, '18-ficha-auditoria-borrador', true);

  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-invalida-errores-fila.csv'));
  await expect(page.getByTestId('sample-errors')).toBeVisible();
  await page.waitForTimeout(4500); // let the snackbar disappear
  await page.getByTestId('sample-errors').scrollIntoViewIfNeeded();
  await shot(page, '19-muestra-con-errores');

  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-valida-30.csv'));
  await expect(page.getByTestId('campaign-status')).toHaveText('Muestra cargada');
  await page.goto(campaignUrl);
  await expect(page.getByTestId('download-codes')).toBeVisible();
  await shot(page, '20-ficha-auditoria-muestra-cargada', true);

  await page.goto('/campaigns');
  await page.getByTestId('campaign-filter-status').click();
  await page.getByRole('option', { name: 'Abiertas' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot(page, '21-auditor-auditorias-abiertas');

  // Access code of a person without email (from the codes file the auditor downloads).
  const campaignId = campaignUrl.split('/').pop();
  const codesCsv = await (await page.request.get(`/api/campaigns/${campaignId}/access-codes?format=csv`)).text();
  const [, code, , , link] = codesCsv.replace('﻿', '').trim().split('\r\n')[1].split(',');
  await logout(page);

  // ---------- 22-24 · Participante sin correo
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId('access-code')).toBeVisible();
  await shot(page, '22-participante-introducir-codigo');
  await page.getByTestId('access-code').fill(code);
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('code-ok')).toBeVisible();
  await shot(page, '23-participante-codigo-correcto', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL(link).pathname);
  await page.getByTestId('access-code').fill(code);
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('code-ok')).toBeVisible();
  await shot(page, '24-participante-movil', true);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---------- 25 · Superadmin ve todas las auditorías (paginadas)
  await login(page, 'superadmin.bumii@bumii.example');
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot(page, '25-superadmin-todas-las-auditorias');

  // ---------- 26 · Multiidioma (francés)
  await page.goto('/login');
  await page.context().clearCookies();
  await page.goto('/login');
  await login(page, AUDITOR, 'ICONTEC');
  await page.waitForURL(/\/my\/organizations/);
  await page.getByRole('button', { name: 'fr', exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.goto(campaignUrl);
  await expect(page.getByTestId('download-codes')).toBeVisible();
  await shot(page, '26-multiidioma-frances');
  await page.getByRole('button', { name: 'es', exact: true }).first().click();
  await logout(page);

  // ---------- 27 · Correo de acceso con la marca efr
  const html = execSync(
    `npx tsx -e "import { renderTemplate } from './packages/mail/src'; process.stdout.write(renderTemplate('magic_link','es',{url:'https://efr-staging.bumii.ai/auth/verify?token=demo',minutes:'15'}).html)"`,
    { cwd: ROOT },
  ).toString();
  await page.setViewportSize({ width: 720, height: 640 });
  await page.setContent(html);
  await shot(page, '27-correo-enlace-de-acceso');
});

