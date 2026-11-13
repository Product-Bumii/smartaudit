import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { AuditLog, Questionnaire, SamplingTable } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
let admin: string;
beforeAll(async () => {
  env = await startTestEnv();
  admin = await sessionFor(env, SEED_USERS.superFundacion, null);
});
afterAll(() => env?.stop());

describe('sampling tables (versioned)', () => {
  it('creates a draft, rejects invalid publish, publishes and freezes campaigns', async () => {
    const auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.CO);
    const before = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput()).expect(201);

    const list = await request(env.app).get('/api/config/sampling-tables').set('Cookie', admin).expect(200);
    const v1 = list.body.items[0];
    await request(env.app).put(`/api/config/sampling-tables/${v1._id}`).set('Cookie', admin).send({ brackets: v1.brackets }).expect(409);

    const draft = await request(env.app)
      .post('/api/config/sampling-tables')
      .set('Cookie', admin)
      .send({ brackets: [{ min: 1, max: 100, required: 15 }, { min: 102, max: null, required: 30 }] })
      .expect(201);
    expect(draft.body.item.version).toBe(2);
    expect(draft.body.issues).toEqual([{ code: 'NOT_CONTIGUOUS', index: 1 }]);
    await request(env.app).post('/api/config/sampling-tables').set('Cookie', admin).send({ brackets: v1.brackets }).expect(409);
    await request(env.app).post(`/api/config/sampling-tables/${draft.body.item._id}/publish`).set('Cookie', admin).expect(422);
    await request(env.app)
      .put(`/api/config/sampling-tables/${draft.body.item._id}`)
      .set('Cookie', admin)
      .send({ brackets: [{ min: 1, max: 100, required: 15 }, { min: 101, max: null, required: 30 }] })
      .expect(200);
    await request(env.app).post(`/api/config/sampling-tables/${draft.body.item._id}/publish`).set('Cookie', admin).expect(200);

    const after = await request(env.app).post('/api/campaigns/preview').set('Cookie', auditor).send(campaignInput()).expect(200);
    expect(after.body.minimum.minimum).toBe(30);
    // The existing campaign keeps the version it was created with.
    const existing = await request(env.app).get(`/api/campaigns/${before.body.campaign.id}`).set('Cookie', auditor).expect(200);
    expect(existing.body.campaign.sampling).toMatchObject({ tableVersion: 1, minimum: 20 });

    // Restore the seed rules for other tests: publish v3 = v1 brackets.
    await request(env.app).post('/api/config/sampling-tables').set('Cookie', admin).send({ brackets: v1.brackets }).expect(201);
    const v3 = await SamplingTable.findOne({ version: 3 });
    await request(env.app).post(`/api/config/sampling-tables/${v3!._id}/publish`).set('Cookie', admin).expect(200);
    expect(await AuditLog.countDocuments({ action: /config\.samplingTable/ })).toBeGreaterThanOrEqual(5);
  });

  it('deletes drafts only', async () => {
    const d = await request(env.app).post('/api/config/sampling-tables').set('Cookie', admin).send({ brackets: [{ min: 1, max: null, required: 3 }] }).expect(201);
    await request(env.app).delete(`/api/config/sampling-tables/${d.body.item._id}`).set('Cookie', admin).expect(204);
    const v1 = await SamplingTable.findOne({ version: 1 });
    await request(env.app).delete(`/api/config/sampling-tables/${v1!._id}`).set('Cookie', admin).expect(409);
    await request(env.app).get('/api/config/sampling-tables/nope').set('Cookie', admin).expect(404);
  });
});

describe('questionnaires (versions and languages)', () => {
  it('clones, edits (resetting changed translations), approves and publishes', async () => {
    const list = await request(env.app).get('/api/config/questionnaires?module=M1').set('Cookie', admin).expect(200);
    expect(list.body.items).toHaveLength(1);
    const v1 = await request(env.app).get(`/api/config/questionnaires/${list.body.items[0]._id}`).set('Cookie', admin).expect(200);
    expect(v1.body.item.languages.map((l: { lang: string; status: string }) => `${l.lang}:${l.status}`)).toEqual(['es:approved', 'en:pending_approval', 'ca:pending_approval', 'pt:pending_approval', 'fr:pending_approval']);

    await request(env.app).put(`/api/config/questionnaires/${v1.body.item._id}`).set('Cookie', admin).send({ questions: v1.body.item.questions }).expect(409);

    // Approving a translation of the published version is metadata only.
    const appr = await request(env.app).post(`/api/config/questionnaires/${v1.body.item._id}/languages/en/approve`).set('Cookie', admin).expect(200);
    expect(appr.body.item.languages.find((l: { lang: string }) => l.lang === 'en').status).toBe('approved');

    const v2 = await request(env.app).post(`/api/config/questionnaires/${v1.body.item._id}/new-version`).set('Cookie', admin).expect(201);
    expect(v2.body.item).toMatchObject({ version: 2, status: 'draft' });
    const questions = v2.body.item.questions;
    questions[0].text.es = 'Texto revisado P1';
    delete questions[0].text.ca;
    const upd = await request(env.app).put(`/api/config/questionnaires/${v2.body.item._id}`).set('Cookie', admin).send({ questions }).expect(200);
    expect(upd.body.item.languages.map((l: { lang: string; status: string }) => `${l.lang}:${l.status}`)).toEqual(['es:pending_approval', 'en:approved', 'ca:pending_approval', 'pt:pending_approval', 'fr:pending_approval']);

    const missing = await request(env.app).post(`/api/config/questionnaires/${v2.body.item._id}/languages/ca/approve`).set('Cookie', admin).expect(422);
    expect(missing.body.error.details.issues[0]).toMatchObject({ question: 'P1', lang: 'ca', field: 'text' });

    const invalid = structuredClone(questions);
    invalid[1].code = 'P1';
    await request(env.app).put(`/api/config/questionnaires/${v2.body.item._id}`).set('Cookie', admin).send({ questions: invalid }).expect(422);

    await request(env.app).post(`/api/config/questionnaires/${v2.body.item._id}/languages/es/approve`).set('Cookie', admin).expect(200);
    await request(env.app).post(`/api/config/questionnaires/${v2.body.item._id}/publish`).set('Cookie', admin).expect(200);
    expect(await Questionnaire.countDocuments({ status: 'published' })).toBe(2);
  });
});
