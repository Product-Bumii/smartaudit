/**
 * Phase 1 acceptance (E2E): superadmin creates an organization and its admin → the admin creates an
 * auditor → the auditor signs in with a magic link, creates a campaign, uploads a sample with errors,
 * fixes it, and the campaign ends in `muestra_cargada` with the right minimum and window.
 */
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { login, logout, matSelect, openMagicLink } from './helpers';

const SAMPLES = join(__dirname, '../seed/samples');
const run = Date.now().toString(36);
const ORG = `Org E2E ${run} (sintética)`;
const ADMIN = `admin.${run}@org-e2e.example`;
const AUDITOR = `auditor.${run}@org-e2e.example`;

test('phase 1 end-to-end flow', async ({ page }) => {
  // 1. Superadmin creates the organization and its ORG_ADMIN.
  await login(page, 'superadmin.fundacion@masfamilia.example');
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await page.getByTestId('new-org').click();
  await page.getByTestId('org-name').fill(ORG);
  await matSelect(page, 'org-country', /España/);
  await page.getByTestId('org-admin-email').fill(ADMIN);
  await page.getByTestId('org-submit').click();
  await expect(page.getByRole('heading', { name: ORG })).toBeVisible();
  await expect(page.getByTestId('users-admins')).toContainText(ADMIN);
  await logout(page);

  // 2. The ORG_ADMIN creates an auditor.
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/org\/auditors$/);
  await page.getByTestId('new-auditors-email').fill(AUDITOR);
  await page.getByTestId('add-auditors').click();
  await expect(page.getByTestId('users-auditors')).toContainText(AUDITOR);
  await logout(page);

  // 3. The auditor signs in and creates a campaign (ES, Madrid: visit Wed 9 Dec 2026, 120 people).
  await login(page, AUDITOR);
  await expect(page).toHaveURL(/\/campaigns$/);
  await page.getByTestId('new-campaign').click();
  await page.getByTestId('cf-reference').fill(`Auditoría E2E ${run}`);
  await page.getByTestId('cf-visit-date').fill('2026-12-09');
  await page.getByTestId('cf-scope').fill('120');
  await expect(page.getByTestId('cf-minimum')).toHaveText('20');
  await page.getByTestId('cf-submit').click();
  await expect(page.getByTestId('campaign-status')).toHaveText('Borrador');
  await expect(page.getByTestId('campaign-minimum')).toHaveText('20');

  // 4. Upload a sample with errors: per-row errors, nothing loaded.
  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-invalida-errores-fila.csv'));
  const errors = page.getByTestId('sample-errors');
  await expect(errors).toBeVisible();
  await expect(errors).toContainText('Correo no válido');
  await expect(errors).toContainText('Correo repetido');
  await expect(errors.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByTestId('campaign-status')).toHaveText('Borrador');

  // 5. Fix it: upload the valid sample → muestra_cargada.
  await page.getByTestId('sample-file').setInputFiles(join(SAMPLES, 'muestra-valida-30.csv'));
  await expect(page.getByTestId('campaign-status')).toHaveText('Muestra cargada');
  await expect(page.getByTestId('campaign-sample-size')).toHaveText('30');
  await expect(page.getByTestId('distinct-workcenter')).toContainText('Sede central');
  await expect(page.getByTestId('download-codes')).toBeVisible();

  // 6. Minimum and window are correct (checked through the API with the auditor session).
  const id = page.url().split('/').pop();
  const { campaign } = await (await page.request.get(`/api/campaigns/${id}`)).json();
  expect(campaign.status).toBe('muestra_cargada');
  expect(campaign.sampling.minimum).toBe(20);
  expect(campaign.window).toMatchObject({
    openDate: '2026-11-25',
    closeDate: '2026-12-08',
    opensAt: '2026-11-25T08:00:00.000Z', // 09:00 Europe/Madrid
    closesAt: '2026-12-08T22:59:59.999Z', // 23:59 Europe/Madrid, business day before the visit
  });
  await expect(page.getByTestId('campaign-opens')).toContainText('25 nov 2026');
  await expect(page.getByTestId('campaign-closes')).toContainText('8 dic 2026');

  // 7. The ORG_ADMIN cannot read the campaign (isolation enforced by the API).
  await logout(page);
  await login(page, ADMIN);
  const forbidden = await page.request.get(`/api/campaigns/${id}`);
  expect(forbidden.status()).toBe(403);
});

test('an email with accounts in two organizations chooses where to enter', async ({ page }) => {
  await openMagicLink(page, 'auditor1@auditoria.example');
  await expect(page.getByRole('heading', { name: /Elige la organización/ })).toBeVisible();
  await page.getByTestId('account-Ibérica Logística S.L. (sintética)').click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByTestId('user-info')).toContainText('Ibérica Logística');
});

test('a person without email opens the link from the codes file and enters the access code', async ({ page }) => {
  await login(page, 'auditor2@auditoria.example');
  const created = await page.request.post('/api/campaigns', {
    data: { reference: `Códigos ${run}`, norm: '1000-1', auditType: 'inicial', excellence: false, visitDate: '2026-12-09', scopeSize: 40, languages: ['es', 'en', 'ca'] },
  });
  const { campaign } = await created.json();
  const fs = await import('node:fs');
  const upload = await page.request.post(`/api/campaigns/${campaign.id}/sample`, {
    multipart: { file: { name: 'muestra.csv', mimeType: 'text/csv', buffer: fs.readFileSync(join(SAMPLES, 'muestra-valida-30.csv')) } },
  });
  expect(upload.ok()).toBe(true);
  const codesCsv = await (await page.request.get(`/api/campaigns/${campaign.id}/access-codes?format=csv`)).text();
  const [, code, , , link] = codesCsv.replace('\uFEFF', '').trim().split('\r\n')[1].split(',');
  await logout(page);

  // The participant opens the printed link: it must ask for the code, not the internal login.
  await page.goto(new URL(link).pathname);
  await expect(page).toHaveURL(/\/c\/[a-z2-9]{10}$/);
  await page.getByTestId('access-code').fill('ZZZZZZZZ');
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('access-error')).toContainText('no es válido');
  await page.getByTestId('access-code').fill(code.toLowerCase());
  await page.getByTestId('access-submit').click();
  await expect(page.getByTestId('code-ok')).toBeVisible();
  await expect(page.getByTestId('not-open-yet')).toContainText('25 nov 2026');
});
