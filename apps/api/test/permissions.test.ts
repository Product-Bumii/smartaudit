/**
 * Integration tests for permissions and organization isolation:
 * no role reaches another organization's resources; ORG_ADMIN never reads samples or responses.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { User } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

const csv = readFileSync(join(__dirname, '../../../seed/samples/muestra-valida-30.csv'));

let env: TestEnv;
let s: Record<'superBumii' | 'superFundacion' | 'adminCO' | 'adminES' | 'auditorCO' | 'auditorMultiES' | 'auditorES', string>;
let campaignCO: string;
let auditorESId: string;

beforeAll(async () => {
  env = await startTestEnv();
  s = {
    superBumii: await sessionFor(env, SEED_USERS.superBumii, null),
    superFundacion: await sessionFor(env, SEED_USERS.superFundacion, null),
    adminCO: await sessionFor(env, SEED_USERS.adminCO, env.orgs.CO),
    adminES: await sessionFor(env, SEED_USERS.adminES, env.orgs.ES),
    auditorCO: await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.CO),
    auditorMultiES: await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.ES),
    auditorES: await sessionFor(env, SEED_USERS.auditorES, env.orgs.ES),
  };
  const res = await request(env.app).post('/api/campaigns').set('Cookie', s.auditorCO).send(campaignInput()).expect(201);
  campaignCO = res.body.campaign.id;
  await request(env.app).post(`/api/campaigns/${campaignCO}/sample`).set('Cookie', s.auditorCO).attach('file', csv, 'm.csv').expect(200);
  auditorESId = String((await User.findOne({ emailHash: env.ctx.crypto.hash(SEED_USERS.auditorES) }).lean())!._id);
});
afterAll(() => env?.stop());

type Call = [method: 'get' | 'post' | 'put' | 'patch', path: () => string, body?: object];
const call = (cookie: string, [method, path, body]: Call) => {
  const req = request(env.app)[method](path()).set('Cookie', cookie);
  return body ? req.send(body) : req;
};

const campaignResources: Call[] = [
  ['get', () => `/api/campaigns/${campaignCO}`],
  ['put', () => `/api/campaigns/${campaignCO}`, campaignInput()],
  ['get', () => `/api/campaigns/${campaignCO}/sample/summary`],
  ['get', () => `/api/campaigns/${campaignCO}/access-codes`],
  ['post', () => `/api/campaigns/${campaignCO}/status`, { to: 'suspendida' }],
];

describe('ORG_ADMIN', () => {
  it('can never read campaigns, samples, codes or responses', async () => {
    for (const c of [...campaignResources, ['get', () => '/api/campaigns'] as Call, ['post', () => '/api/campaigns', campaignInput()] as Call]) {
      const res = await call(s.adminCO, c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(403);
    }
  });

  it('manages the auditors of its organization only', async () => {
    const list = await call(s.adminCO, ['get', () => `/api/organizations/${env.orgs.CO}/auditors`]).expect(200);
    expect(list.body.items.length).toBe(1);
    await call(s.adminCO, ['post', () => `/api/organizations/${env.orgs.CO}/auditors`, { email: 'nuevo.auditor@auditoria.example' }]).expect(201);
    await call(s.adminCO, ['get', () => `/api/organizations/${env.orgs.ES}/auditors`]).expect(404);
    await call(s.adminCO, ['post', () => `/api/organizations/${env.orgs.ES}/auditors`, { email: 'x@auditoria.example' }]).expect(404);
    await call(s.adminCO, ['patch', () => `/api/organizations/${env.orgs.ES}/auditors/${auditorESId}`, { status: 'inactive' }]).expect(404);
    // Even with its own org in the URL, it cannot touch another org's user.
    await call(s.adminCO, ['patch', () => `/api/organizations/${env.orgs.CO}/auditors/${auditorESId}`, { status: 'inactive' }]).expect(404);
  });

  it('cannot manage organizations, org admins or configuration', async () => {
    await call(s.adminCO, ['get', () => '/api/organizations']).expect(403);
    await call(s.adminCO, ['get', () => `/api/organizations/${env.orgs.CO}`]).expect(403);
    await call(s.adminCO, ['post', () => `/api/organizations/${env.orgs.CO}/admins`, { email: 'otro@andina.example' }]).expect(403);
    await call(s.adminCO, ['get', () => '/api/config/sampling-tables']).expect(403);
    await call(s.adminCO, ['get', () => '/api/config/settings']).expect(403);
  });
});

describe('AUDITOR of another organization', () => {
  it.each(['auditorES', 'auditorMultiES'] as const)('%s gets 404 on every resource of the CO campaign', async (who) => {
    for (const c of [...campaignResources, ['post', () => `/api/campaigns/${campaignCO}/sample`] as Call]) {
      const res = await call(s[who], c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(404);
    }
    const list = await call(s[who], ['get', () => '/api/campaigns']).expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).not.toContain(campaignCO);
  });

  it('cannot manage auditors or organizations', async () => {
    await call(s.auditorES, ['get', () => `/api/organizations/${env.orgs.ES}/auditors`]).expect(403);
    await call(s.auditorES, ['get', () => '/api/organizations']).expect(403);
    await call(s.auditorES, ['get', () => '/api/config/questionnaires']).expect(403);
  });

  it('another auditor of the same organization cannot see a campaign they did not create', async () => {
    await call(s.adminCO, ['post', () => `/api/organizations/${env.orgs.CO}/auditors`, { email: 'colega@auditoria.example' }]).expect(201);
    const colleague = await sessionFor(env, 'colega@auditoria.example', env.orgs.CO);
    for (const c of campaignResources) {
      const res = await call(colleague, c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(404);
    }
    const list = await call(colleague, ['get', () => '/api/campaigns']).expect(200);
    expect(list.body.items).toEqual([]);
  });
});

describe('Superadmins', () => {
  it('see and suspend campaigns of every organization but do not load samples or create campaigns', async () => {
    for (const who of ['superBumii', 'superFundacion'] as const) {
      await call(s[who], ['get', () => `/api/campaigns/${campaignCO}`]).expect(200);
      const list = await call(s[who], ['get', () => '/api/campaigns']).expect(200);
      expect(list.body.items.map((i: { id: string }) => i.id)).toContain(campaignCO);
      await call(s[who], ['post', () => `/api/campaigns/${campaignCO}/sample`]).expect(403);
      await call(s[who], ['post', () => '/api/campaigns', campaignInput()]).expect(403);
      await call(s[who], ['put', () => `/api/campaigns/${campaignCO}`, campaignInput()]).expect(403);
    }
    await call(s.superFundacion, ['post', () => `/api/campaigns/${campaignCO}/status`, { to: 'suspendida' }]).expect(200);
    await call(s.superBumii, ['post', () => `/api/campaigns/${campaignCO}/status`, { to: 'muestra_cargada' }]).expect(200);
  });

  it('only SUPERADMIN_BUMII changes technical settings', async () => {
    await call(s.superFundacion, ['put', () => '/api/config/settings', { confidenceThreshold: 0.7 }]).expect(403);
    await call(s.superFundacion, ['put', () => '/api/config/settings', { mailFromName: 'SmartAudit efr · Fundación' }]).expect(200);
    const res = await call(s.superBumii, ['put', () => '/api/config/settings', { confidenceThreshold: 0.85 }]).expect(200);
    expect(res.body.item.confidenceThreshold).toBe(0.85);
    expect(res.body.item.retention.enabled).toBe(false);
  });

  it('manage organizations and org admins', async () => {
    const res = await call(s.superFundacion, [
      'post',
      () => '/api/organizations',
      { name: 'Nueva Org (sintética)', country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'ca', adminEmail: 'admin@nueva.example' },
    ]).expect(201);
    expect(res.body.admin).toMatchObject({ role: 'ORG_ADMIN', email: 'admin@nueva.example', preferredLanguage: 'ca' });
    expect(env.mail.outbox.at(-1)).toMatchObject({ to: 'admin@nueva.example' });
    await call(s.superFundacion, ['post', () => `/api/organizations/${res.body.organization.id}/admins`, { email: 'admin@nueva.example' }]).expect(409);
    await call(s.superFundacion, ['post', () => '/api/organizations', { name: 'X', country: 'zz', timeZone: 'Europe/Madrid', defaultLanguage: 'es' }]).expect(400);
    const upd = await call(s.superBumii, ['patch', () => `/api/organizations/${res.body.organization.id}`, { status: 'inactive' }]).expect(200);
    expect(upd.body.organization.status).toBe('inactive');
  });

  it('users of an inactive organization lose access', async () => {
    await call(s.superBumii, ['patch', () => `/api/organizations/${env.orgs.ES}`, { status: 'inactive' }]).expect(200);
    await call(s.adminES, ['get', () => '/api/auth/me']).expect(401);
    await call(s.superBumii, ['patch', () => `/api/organizations/${env.orgs.ES}`, { status: 'active' }]).expect(200);
    await call(s.adminES, ['get', () => '/api/auth/me']).expect(200);
  });
});
