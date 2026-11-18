/**
 * Phase 1 acceptance (E2E), with the roles of decision 56: the superadmin (F+f) creates an audit entity
 * with its coordinator and an organization assigned to them → the coordinator creates an auditor and
 * designates them for the organization → the auditor signs in with a magic link, creates the campaign,
 * uploads a sample with errors, fixes it, and the campaign ends in `muestra_cargada` with the right
 * minimum and window → the coordinator only sees the aggregate.
 */
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { login, logout, matSelect, openMagicLink } from './helpers';

const SAMPLES = join(__dirname, '../seed/samples');
const run = Date.now().toString(36);
const ENTITY = `Certificadora E2E ${run} (sintética)`;
const ORG = `Org E2E ${run} (sintética)`;
const COORDINATOR = `coordinacion.${run}@cert-e2e.example`;
const AUDITOR = `auditor.${run}@cert-e2e.example`;

test('phase 1 end-to-end flow', async ({ page }) => {
  // 1. Superadmin (F+f) creates the audit entity with its coordinator…
  await login(page, 'superadmin.fundacion@masfamilia.example');
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await page.goto('/admin/audit-entities');
  await page.getByTestId('new-entity').click();
  await page.getByTestId('entity-name').fill(ENTITY);
  await matSelect(page, 'entity-country', /España/);
  await page.getByTestId('entity-coordinator-email').fill(COORDINATOR);
  await page.getByTestId('entity-submit').click();
  await expect(page.getByRole('heading', { name: ENTITY })).toBeVisible();
  await expect(page.getByTestId('users-coordinators')).toContainText(COORDINATOR);

  // …and the organization, assigned to that entity and coordinator.
  await page.goto('/admin/organizations');
  await page.getByTestId('new-org').click();
  await page.getByTestId('org-name').fill(ORG);
  await matSelect(page, 'org-country', /España/);
  await matSelect(page, 'org-entity', ENTITY);
  await matSelect(page, 'org-coordinator', COORDINATOR);
  await page.getByTestId('org-submit').click();
  await expect(page.getByRole('heading', { name: ORG })).toBeVisible();
  await expect(page.getByTestId('assign-coordinator')).toContainText(COORDINATOR);

  // The organization list is searched and filtered on the server (hundreds of organizations).
  await page.goto('/admin/organizations');
  await page.getByTestId('org-search').fill(`org e2e ${run}`.toUpperCase());
  await expect(page.getByTestId('org-table').locator('tbody tr')).toHaveCount(1);
  await page.getByTestId('org-search').fill('');
  await matSelect(page, 'org-filter-entity', ENTITY);
  await expect(page.getByTestId('org-table').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('org-table')).toContainText(ORG);
  await logout(page);

  // 2. The coordinator creates an auditor and designates them for the organization.
  await login(page, COORDINATOR);
  await expect(page).toHaveURL(/\/my\/organizations$/);
  await expect(page.getByTestId('my-orgs')).toContainText(ORG);
  await page.goto('/my/auditors');
  await page.getByTestId('new-auditors-email').fill(AUDITOR);
  await page.getByTestId('add-auditors').click();
  await expect(page.getByTestId('users-auditors')).toContainText(AUDITOR);
  await page.goto('/my/organizations');
  const row = page.locator('tr', { hasText: ORG });
  await row.locator('mat-form-field').click(); // the label is part of the clickable field
  await page.getByRole('option', { name: AUDITOR }).click();
  await expect(row.locator('mat-select')).toContainText(AUDITOR);
  await logout(page);

  // 3. The auditor signs in and creates the audit (ES, Madrid: interviews start Wed 25 Nov 2026, 120 people).
  await login(page, AUDITOR);
  await expect(page).toHaveURL(/\/my\/organizations$/);
  await page.locator('tr', { hasText: ORG }).getByRole('link', { name: /nueva auditoría/i }).click();
  await expect(page.getByTestId('cf-organization')).toContainText(ORG);
  await page.getByTestId('cf-reference').fill(`Auditoría E2E ${run}`);
  await page.getByTestId('cf-start-date').fill('2026-11-25');
  await page.getByTestId('cf-scope').fill('120');
  await expect(page.getByTestId('cf-minimum')).toHaveText('20');
  await expect(page.getByTestId('cf-maximum')).toHaveText('20'); // empty = the minimum
  await page.getByTestId('cf-max').fill('25');
  await expect(page.getByTestId('cf-maximum')).toHaveText('25');
  await page.getByTestId('cf-submit').click();
  await expect(page.getByTestId('campaign-status')).toHaveText('Borrador');
  await expect(page.getByTestId('campaign-minimum')).toHaveText('20');
  await expect(page.getByTestId('campaign-maximum')).toHaveText('25');

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
  expect(campaign.sampling).toMatchObject({ minimum: 20, maximum: 25 });
  expect(campaign.window).toMatchObject({
    openDate: '2026-11-25',
    closeDate: '2026-12-08',
    opensAt: '2026-11-25T08:00:00.000Z', // 09:00 Europe/Madrid
    closesAt: '2026-12-08T22:59:59.999Z', // 23:59 Europe/Madrid, 10th business day
  });
  await expect(page.getByTestId('campaign-opens')).toContainText('25 nov 2026');
  await expect(page.getByTestId('campaign-closes')).toContainText('8 dic 2026');

  // 7. The coordinator finds the audit with the search and sees it only as aggregate: no sample, no codes.
  await logout(page);
  await login(page, COORDINATOR);
  await page.goto('/campaigns');
  await page.getByTestId('campaign-search').fill(`E2E ${run}`);
  await expect(page.getByTestId('campaign-table').locator('tbody tr')).toHaveCount(1);
  await page.getByTestId('campaign-table').getByRole('link', { name: `Auditoría E2E ${run}` }).click();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
  await expect(page.getByTestId('aggregate-notice')).toBeVisible();
  await expect(page.getByTestId('sample-section')).toHaveCount(0);
  expect((await page.request.get(`/api/campaigns/${id}/sample/summary`)).status()).toBe(403);
  expect((await page.request.get(`/api/campaigns/${id}/access-codes`)).status()).toBe(403);
});

test('an email with accounts in two audit entities chooses where to enter', async ({ page }) => {
  await openMagicLink(page, 'auditor1@auditoria.example');
  await expect(page.getByRole('heading', { name: /Elige la entidad de auditoría/ })).toBeVisible();
  await page.getByTestId('account-AENOR').click();
  await expect(page).toHaveURL(/\/my\/organizations$/);
  await expect(page.getByTestId('user-info')).toContainText('AENOR');
  await expect(page.getByTestId('my-orgs')).toContainText('Ibérica Logística');
});

test('a person without email opens the link from the codes file and enters the access code', async ({ page }) => {
  await login(page, 'auditor2@auditoria.example');
  const options = await (await page.request.get('/api/campaigns/options')).json();
  const created = await page.request.post('/api/campaigns', {
    data: { organizationId: options.organizations[0].id, reference: `Códigos ${run}`, norm: '1000-1', auditType: 'inicial', excellence: false, interviewStartDate: '2026-11-25', scopeSize: 40, languages: ['es', 'en', 'pt'] },
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
