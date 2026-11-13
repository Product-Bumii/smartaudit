import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { AuditLog, Campaign, ParticipantContact, Respondent } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

const SAMPLES = join(__dirname, '../../../seed/samples');
const sample = (name: string) => readFileSync(join(SAMPLES, name));

let env: TestEnv;
let auditor: string;
beforeAll(async () => {
  env = await startTestEnv();
  auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.CO);
});
afterAll(() => env?.stop());

const binaryParser = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('campaign creation and derived values', () => {
  it('computes minimum, window (CO holidays) and activated questions', async () => {
    const res = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput()).expect(201);
    const c = res.body.campaign;
    expect(c.status).toBe('borrador');
    expect(c.sampling).toMatchObject({ tableVersion: 1, scopeSize: 120, bracket: { min: 91, max: 150 }, minimum: 20 });
    expect(c.window).toMatchObject({
      openDate: '2026-11-24',
      closeDate: '2026-12-07',
      opensAt: '2026-11-24T14:00:00.000Z',
      closesAt: '2026-12-08T04:59:59.999Z',
    });
    expect(c.window.businessDays).not.toContain('2026-12-08');
    expect(c.window.reminders.map((r: { date: string }) => r.date)).toEqual(['2026-11-27', '2026-12-03']);
    const states = Object.fromEntries(c.activatedQuestions.map((q: { code: string; state: string }) => [q.code, q.state]));
    expect(states).toMatchObject({ P1: 'active', 'P7.1': 'conditional', P8: 'inactive', P9: 'inactive', P10: 'active' });
    // Only approved languages are offered to participants.
    expect(c.questionnaire).toEqual({ version: 1, offeredLanguages: ['es'] });
    expect(c.slug).toMatch(/^[a-z2-9]{10}$/);
    expect(await AuditLog.exists({ action: 'campaign.create', resourceId: c.id })).toBeTruthy();
  });

  it('activates P8 for renewal and P9 for excellence', async () => {
    const res = await request(env.app).post('/api/campaigns/preview').set('Cookie', auditor).send(campaignInput({ auditType: 'renovacion', excellence: true })).expect(200);
    const states = Object.fromEntries(res.body.questions.map((q: { code: string; state: string }) => [q.code, q.state]));
    expect(states.P8).toBe('active');
    expect(states.P9).toBe('active');
    expect(res.body.problems).toEqual([]);
  });

  it('requires the auditor figure (91–143) above 16.000 people', async () => {
    const res = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput({ scopeSize: 20000 })).expect(422);
    expect(res.body.error.details.problems[0]).toMatchObject({ code: 'AUDITOR_MINIMUM_REQUIRED', details: { min: 91, max: 143 } });
    const bad = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput({ scopeSize: 20000, auditorMinimum: 150 })).expect(422);
    expect(bad.body.error.details.problems[0].code).toBe('CHOICE_OUT_OF_RANGE');
    const ok = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput({ scopeSize: 20000, auditorMinimum: 100 })).expect(201);
    expect(ok.body.campaign.sampling).toMatchObject({ minimum: 100, auditorChosen: true, requiresAuditorChoice: true });
  });

  it('validates norm, visit date and languages', async () => {
    const res = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput({ norm: '3000', visitDate: '2026-02-30', languages: ['en'] })).expect(422);
    expect(res.body.error.details.problems.map((p: { code: string }) => p.code)).toEqual(['INVALID_NORM', 'NO_APPROVED_LANGUAGE_SELECTED', 'INVALID_VISIT_DATE']);
  });

  it('provides form options', async () => {
    const res = await request(env.app).get('/api/campaigns/options').set('Cookie', auditor).expect(200);
    expect(res.body.norms).toEqual(['1000-1', '1000-2']);
    expect(res.body.languages).toEqual([
      { lang: 'es', approved: true },
      { lang: 'en', approved: false },
      { lang: 'ca', approved: false },
    ]);
  });
});

describe('sample template, upload and validation', () => {
  let campaignId: string;
  beforeAll(async () => {
    const res = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput()).expect(201);
    campaignId = res.body.campaign.id;
  });

  it('downloads the template as xlsx and csv', async () => {
    const x = await request(env.app).get('/api/campaigns/sample-template?format=xlsx').set('Cookie', auditor).buffer().parse(binaryParser).expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['muestra', 'instrucciones']);
    expect(wb.worksheets[0].getRow(1).getCell(1).text).toBe('correo');
    const c = await request(env.app).get('/api/campaigns/sample-template?format=csv').set('Cookie', auditor).expect(200);
    expect(c.text.replace('﻿', '').split('\r\n')[0]).toBe('correo,sexo,tramo_edad,centro_trabajo,tipo_puesto,tramo_antiguedad,area,turnos,teletrabajo,hijos_o_dependientes,rlpt');
  });

  it('rejects a file with row errors and loads nothing', async () => {
    const res = await request(env.app)
      .post(`/api/campaigns/${campaignId}/sample`)
      .set('Cookie', auditor)
      .attach('file', sample('muestra-invalida-errores-fila.csv'), 'muestra-invalida-errores-fila.csv')
      .expect(422);
    expect(res.body.error.code).toBe('SAMPLE_INVALID');
    const codes = res.body.error.details.errors.map((e: { row: number; code: string }) => `${e.row}:${e.code}`);
    expect(codes).toEqual(['3:INVALID_EMAIL', '5:DUPLICATE_EMAIL', '6:INVALID_VALUE', '7:INVALID_VALUE', '8:REQUIRED', '9:INVALID_VALUE']);
    expect(await Respondent.countDocuments({ campaignId })).toBe(0);
    expect((await Campaign.findById(campaignId).lean())!.status).toBe('borrador');
  });

  it('rejects prohibited columns', async () => {
    const res = await request(env.app)
      .post(`/api/campaigns/${campaignId}/sample`)
      .set('Cookie', auditor)
      .attach('file', sample('muestra-invalida-columnas-prohibidas.csv'), 'x.csv')
      .expect(422);
    expect(res.body.error.details.errors.filter((e: { code: string }) => e.code === 'FORBIDDEN_COLUMN').map((e: { column: string }) => e.column)).toEqual(['nombre', 'dni', 'salario']);
  });

  it('rejects unsupported files', async () => {
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', Buffer.from('x'), 'a.pdf').expect(400);
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', Buffer.from('x'), 'a.xlsx').expect(400);
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).expect(400);
  });

  it('loads a valid CSV, generates tokens and codes and moves to muestra_cargada', async () => {
    const res = await request(env.app)
      .post(`/api/campaigns/${campaignId}/sample`)
      .set('Cookie', auditor)
      .attach('file', sample('muestra-valida-30.csv'), 'muestra-valida-30.csv')
      .expect(200);
    expect(res.body.stats).toEqual({ total: 30, withEmail: 25, noEmail: 5 });
    expect(res.body.campaign.status).toBe('muestra_cargada');
    expect(res.body.campaign.sampleSize).toBe(30);
    expect(res.body.campaign.statusHistory.map((h: { to: string }) => h.to)).toEqual(['borrador', 'muestra_cargada']);
    expect(await ParticipantContact.countDocuments({ campaignId, invitationTokenHash: { $type: 'string' } })).toBe(25);
    expect(await ParticipantContact.countDocuments({ campaignId, accessCodeHash: { $type: 'string' } })).toBe(5);
    expect(await Respondent.countDocuments({ campaignId, status: 'pending' })).toBe(30);
  });

  it('summarizes the sample with distinct values and alerts', async () => {
    const res = await request(env.app).get(`/api/campaigns/${campaignId}/sample/summary`).set('Cookie', auditor).expect(200);
    expect(res.body).toMatchObject({ total: 30, withEmail: 25, noEmail: 5, minimum: 20, alerts: [] });
    expect(res.body.distinctValues.workCenter).toEqual([
      { value: 'Oficina sur', count: 10 },
      { value: 'Planta norte', count: 10 },
      { value: 'Sede central', count: 10 },
    ]);
    expect(res.body.distribution.sex.find((s: { value: string }) => s.value === 'Mujer').count).toBe(10);
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
  });

  it('replaces the sample with an xlsx while muestra_cargada and alerts below the minimum', async () => {
    const res = await request(env.app)
      .post(`/api/campaigns/${campaignId}/sample?mode=replace`)
      .set('Cookie', auditor)
      .attach('file', sample('muestra-valida-30.xlsx'), 'muestra-valida-30.xlsx')
      .expect(200);
    expect(res.body.campaign.sampleSize).toBe(30);
    expect(await Respondent.countDocuments({ campaignId })).toBe(30);

    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', sample('muestra-valida-pequena-12.csv'), 'p.csv').expect(200);
    const summary = await request(env.app).get(`/api/campaigns/${campaignId}/sample/summary`).set('Cookie', auditor).expect(200);
    expect(summary.body.alerts).toEqual(['SAMPLE_BELOW_MINIMUM']);
    expect(await ParticipantContact.countDocuments({ campaignId })).toBe(12);

    // Back to the 30-person sample for the next tests.
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', sample('muestra-valida-30.csv'), 'm.csv').expect(200);
  });

  it('does not allow append before launch', async () => {
    const res = await request(env.app).post(`/api/campaigns/${campaignId}/sample?mode=append`).set('Cookie', auditor).attach('file', sample('muestra-valida-30.csv'), 'm.csv').expect(409);
    expect(res.body.error.code).toBe('SAMPLE_MODE_NOT_ALLOWED');
  });

  it('appends while running and detects emails already in the campaign', async () => {
    await Campaign.updateOne({ _id: campaignId }, { $set: { status: 'en_curso' } });
    const dup = await request(env.app).post(`/api/campaigns/${campaignId}/sample?mode=append`).set('Cookie', auditor).attach('file', sample('muestra-valida-30.csv'), 'm.csv').expect(422);
    expect(dup.body.error.details.errors[0].code).toBe('EMAIL_ALREADY_IN_CAMPAIGN');
    const ok = await request(env.app).post(`/api/campaigns/${campaignId}/sample?mode=append`).set('Cookie', auditor).attach('file', sample('muestra-valida-pequena-12.csv'), 'p.csv').expect(200);
    expect(ok.body.campaign.sampleSize).toBe(42);
    expect(ok.body.campaign.status).toBe('en_curso');
    await Campaign.updateOne({ _id: campaignId }, { $set: { status: 'muestra_cargada' } });
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', sample('muestra-valida-30.csv'), 'm.csv').expect(200);
  });

  it('downloads the access codes for people without email (audited)', async () => {
    const res = await request(env.app).get(`/api/campaigns/${campaignId}/access-codes?format=csv`).set('Cookie', auditor).expect(200);
    const lines = res.text.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('fila,codigo,centro_trabajo,tipo_puesto,enlace');
    expect(lines).toHaveLength(6);
    const [row, code, , , link] = lines[1].split(',');
    expect(row).toBe('7');
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(link).toMatch(/^http:\/\/localhost:4200\/c\/[a-z2-9]{10}$/);
    const x = await request(env.app).get(`/api/campaigns/${campaignId}/access-codes?format=xlsx`).set('Cookie', auditor).buffer().parse(binaryParser).expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.body);
    expect(wb.worksheets[0].getRow(2).getCell(2).text).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(await AuditLog.countDocuments({ action: 'accessCodes.export', resourceId: campaignId })).toBe(2);
  });

  it('edits the campaign before launch and recomputes values', async () => {
    const res = await request(env.app).put(`/api/campaigns/${campaignId}`).set('Cookie', auditor).send(campaignInput({ scopeSize: 600, auditType: 'renovacion' })).expect(200);
    expect(res.body.campaign.sampling.minimum).toBe(52);
    expect(res.body.campaign.status).toBe('muestra_cargada');
  });

  it('suspends, resumes and cancels; then it is no longer editable', async () => {
    const s = await request(env.app).post(`/api/campaigns/${campaignId}/status`).set('Cookie', auditor).send({ to: 'suspendida', reason: 'prueba' }).expect(200);
    expect(s.body.campaign.status).toBe('suspendida');
    await request(env.app).post(`/api/campaigns/${campaignId}/status`).set('Cookie', auditor).send({ to: 'borrador' }).expect(409);
    const r = await request(env.app).post(`/api/campaigns/${campaignId}/status`).set('Cookie', auditor).send({ to: 'muestra_cargada' }).expect(200);
    expect(r.body.campaign.status).toBe('muestra_cargada');
    await request(env.app).post(`/api/campaigns/${campaignId}/status`).set('Cookie', auditor).send({ to: 'envios_activos' }).expect(409);
    await request(env.app).post(`/api/campaigns/${campaignId}/status`).set('Cookie', auditor).send({ to: 'cancelada' }).expect(200);
    await request(env.app).put(`/api/campaigns/${campaignId}`).set('Cookie', auditor).send(campaignInput()).expect(409);
    await request(env.app).post(`/api/campaigns/${campaignId}/sample`).set('Cookie', auditor).attach('file', sample('muestra-valida-30.csv'), 'm.csv').expect(409);
  });
});
