/**
 * Generates the screenshots of docs/presentacion (run: `npm run screenshots` against a FRESH `dev:local`).
 * Builds a small demo scenario with synthetic data and captures each screen in Spanish.
 */
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { login, logout } from '../helpers';

const ROOT = join(__dirname, '../..');
const OUT = join(ROOT, 'docs/presentacion/img');
const SAMPLES = join(ROOT, 'seed/samples');
const ANDINA = 'Andina Servicios S.A.S. (sintética)';

const shot = async (page: Page, name: string, fullPage = false) => {
  if (fullPage) await page.mouse.wheel(0, -100_000);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
};

/** Navigates again so no snackbar/transition is left on screen. */
const settle = async (page: Page) => {
  await page.goto(page.url());
  await page.waitForLoadState('networkidle');
};

test('presentation screenshots', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---------- 01-03 · Acceso
  await page.goto('/login');
  await shot(page, '01-acceso');
  await page.getByTestId('login-email').fill('auditor1@auditoria.example');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('dev-magic-link')).toBeVisible();
  await shot(page, '02-acceso-enlace-en-pantalla');
  await page.getByTestId('dev-magic-link').click();
  await expect(page.getByTestId(`account-${ANDINA}`)).toBeVisible();
  await shot(page, '03-eleccion-de-organizacion');
  await page.goto('/login');
  await page.context().clearCookies();

  // ---------- 04-08 · Superadmin
  await login(page, 'superadmin.fundacion@masfamilia.example');
  await shot(page, '04-superadmin-organizaciones');
  await page.getByRole('link', { name: ANDINA }).click();
  await expect(page.getByTestId('users-auditors')).toBeVisible();
  await shot(page, '05-superadmin-ficha-organizacion', true);
  await page.goto('/admin/config/sampling-tables');
  await expect(page.locator('table')).toBeVisible();
  await shot(page, '06-config-tabla-de-minimos', true);
  await page.goto('/admin/config/questionnaires');
  await expect(page.getByText('P7.1').first()).toBeVisible();
  await shot(page, '07-config-cuestionario-m1');
  await page.goto('/admin/config/settings');
  await page.waitForLoadState('networkidle');
  await shot(page, '08-config-ajustes');
  await logout(page);

  // ---------- 09 · Administrador de organización
  await login(page, 'admin@andina.example');
  await page.getByTestId('new-auditors-email').fill('auditora.demo@auditoria.example');
  await page.getByTestId('add-auditors').click();
  await expect(page.getByTestId('users-auditors')).toContainText('auditora.demo@auditoria.example');
  await settle(page);
  await shot(page, '09-admin-organizacion-auditores');
  await logout(page);

  // ---------- 10-14 · Auditor
  await login(page, 'auditor1@auditoria.example', ANDINA);
  await page.waitForURL(/\/campaigns$/);

  // Second campaign (via API) so the list has more than one row.
  const small = await page.request.post('/api/campaigns', {
    data: { reference: 'Auditoría inicial · Planta Norte', norm: '1000-1', auditType: 'inicial', excellence: false, visitDate: '2026-12-15', scopeSize: 80, languages: ['es'] },
  });
  const smallId = (await small.json()).campaign.id;
  await page.request.post(`/api/campaigns/${smallId}/sample`, {
    multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: readFileSync(join(SAMPLES, 'muestra-valida-pequena-12.csv')) } },
  });

  await page.goto('/campaigns/new');
  await page.getByTestId('cf-reference').fill('Auditoría de renovación 2026');
  await page.getByTestId('cf-audit-type').click();
  await page.getByRole('option', { name: 'Renovación' }).click();
  await page.getByTestId('cf-visit-date').fill('2026-12-09');
  await page.getByTestId('cf-scope').fill('320');
  await page.getByTestId('cf-excellence').getByRole('switch').click();
  await expect(page.getByTestId('cf-excellence').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('cf-minimum')).toHaveText('26');
  await page.waitForTimeout(800);
  await shot(page, '11-nueva-campana-calculo-automatico', true);
  await page.getByTestId('cf-submit').click();
  await expect(page.getByTestId('campaign-status')).toHaveText('Borrador');
  const campaignUrl = page.url();
  await settle(page);
  await shot(page, '12-ficha-campana-borrador', true);

  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-invalida-errores-fila.csv'));
  await expect(page.getByTestId('sample-errors')).toBeVisible();
  await page.waitForTimeout(4500); // let the snackbar disappear
  await page.getByTestId('sample-errors').scrollIntoViewIfNeeded();
  await shot(page, '13-muestra-con-errores');

  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-valida-30.csv'));
  await expect(page.getByTestId('campaign-status')).toHaveText('Muestra cargada');
  await page.goto(campaignUrl);
  await expect(page.getByTestId('download-codes')).toBeVisible();
  await shot(page, '14-ficha-campana-muestra-cargada', true);

  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');
  await shot(page, '10-auditor-campanas');

  // Access code of a person without email (from the codes file the auditor downloads).
  const campaignId = campaignUrl.split('/').pop();
  const codesCsv = await (await page.request.get(`/api/campaigns/${campaignId}/access-codes?format=csv`)).text();
  const [, code, , , link] = codesCsv.replace('﻿', '').trim().split('\r\n')[1].split(',');
  await logout(page);

  // ---------- 15-17 · Participante sin correo
  await page.goto(new URL(link).pathname);
  await expect(page.getByTestId('access-code')).toBeVisible();
  await shot(page, '15-participante-introducir-codigo');
  await page.getByTestId('access-code').fill(code);
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('code-ok')).toBeVisible();
  await shot(page, '16-participante-codigo-correcto', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL(link).pathname);
  await page.getByTestId('access-code').fill(code);
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('code-ok')).toBeVisible();
  await shot(page, '17-participante-movil', true);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---------- 18 · Superadmin ve todas las campañas
  await login(page, 'superadmin.bumii@bumii.example');
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');
  await shot(page, '18-superadmin-todas-las-campanas');

  // ---------- 19 · Multiidioma
  await page.goto('/login');
  await page.context().clearCookies();
  await page.goto('/login');
  await login(page, 'auditor1@auditoria.example', ANDINA);
  await page.waitForURL(/\/campaigns$/);
  await page.getByRole('button', { name: 'fr', exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.goto(campaignUrl);
  await expect(page.getByTestId('download-codes')).toBeVisible();
  await shot(page, '19-multiidioma-frances');
  await page.getByRole('button', { name: 'es', exact: true }).first().click();
  await logout(page);

  // ---------- 20 · Correo de acceso con la marca efr
  const html = execSync(
    `npx tsx -e "import { renderTemplate } from './packages/mail/src'; process.stdout.write(renderTemplate('magic_link','es',{url:'https://efr-staging.bumii.ai/auth/verify?token=demo',minutes:'15'}).html)"`,
    { cwd: ROOT },
  ).toString();
  await page.setViewportSize({ width: 720, height: 640 });
  await page.setContent(html);
  await shot(page, '20-correo-enlace-de-acceso');
});

