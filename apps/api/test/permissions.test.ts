/**
 * Integration tests for permissions and isolation (decision 56):
 * F+f superadmins assign organizations to audit entities and coordinators; the coordinator designates
 * the auditor; only the lead auditor reaches samples, codes and responses; nobody reaches another
 * audit entity's resources.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { Campaign, Organization, User } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

const csv = readFileSync(join(__dirname, '../../../seed/samples/muestra-valida-30.csv'));

let env: TestEnv;
let s: Record<'superBumii' | 'superFundacion' | 'coordCO' | 'coordES' | 'auditorCO' | 'auditorMultiES' | 'auditorES', string>;
let campaignCO: string;
const ids: Record<string, string> = {};

const userId = async (email: string, entity: string) =>
  String((await User.findOne({ emailHash: env.ctx.crypto.hash(email), auditEntityId: entity }).lean())!._id);

beforeAll(async () => {
  env = await startTestEnv();
  s = {
    superBumii: await sessionFor(env, SEED_USERS.superBumii, null),
    superFundacion: await sessionFor(env, SEED_USERS.superFundacion, null),
    coordCO: await sessionFor(env, SEED_USERS.coordinatorCO, env.entities.CO),
    coordES: await sessionFor(env, SEED_USERS.coordinatorES, env.entities.ES),
    auditorCO: await sessionFor(env, SEED_USERS.auditorMulti, env.entities.CO),
    auditorMultiES: await sessionFor(env, SEED_USERS.auditorMulti, env.entities.ES),
    auditorES: await sessionFor(env, SEED_USERS.auditorES, env.entities.ES),
  };
  ids.coordCO = await userId(SEED_USERS.coordinatorCO, env.entities.CO);
  ids.coordES = await userId(SEED_USERS.coordinatorES, env.entities.ES);
  ids.auditorCO = await userId(SEED_USERS.auditorMulti, env.entities.CO);
  ids.auditorES = await userId(SEED_USERS.auditorES, env.entities.ES);
  const res = await request(env.app).post('/api/campaigns').set('Cookie', s.auditorCO).send(campaignInput()).expect(201);
  campaignCO = res.body.campaign.id;
  expect(res.body.campaign).toMatchObject({ access: 'manage', auditEntityId: env.entities.CO });
  await request(env.app).post(`/api/campaigns/${campaignCO}/sample`).set('Cookie', s.auditorCO).attach('file', csv, 'm.csv').expect(200);
});
afterAll(() => env?.stop());

type Call = [method: 'get' | 'post' | 'put' | 'patch', path: () => string, body?: object];
const call = (cookie: string, [method, path, body]: Call) => {
  const req = request(env.app)[method](path()).set('Cookie', cookie);
  return body ? req.send(body) : req;
};

/** Everything beyond the aggregate view of a campaign. */
const managedResources: Call[] = [
  ['put', () => `/api/campaigns/${campaignCO}`, campaignInput()],
  ['get', () => `/api/campaigns/${campaignCO}/sample/summary`],
  ['get', () => `/api/campaigns/${campaignCO}/access-codes`],
  ['post', () => `/api/campaigns/${campaignCO}/sample`],
  ['post', () => `/api/campaigns/${campaignCO}/status`, { to: 'suspendida' }],
];
const campaignResources: Call[] = [['get', () => `/api/campaigns/${campaignCO}`], ...managedResources];

describe('COORDINATOR', () => {
  it('sees campaigns of the organizations it coordinates only as aggregate, never samples or codes', async () => {
    const detail = await call(s.coordCO, ['get', () => `/api/campaigns/${campaignCO}`]).expect(200);
    expect(detail.body.campaign).toMatchObject({ access: 'aggregate', sampleSize: 30 });
    const list = await call(s.coordCO, ['get', () => '/api/campaigns']).expect(200);
    expect(list.body.items.find((i: { id: string }) => i.id === campaignCO)).toMatchObject({ access: 'aggregate' });
    for (const c of managedResources) {
      const res = await call(s.coordCO, c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(403);
    }
  });

  it('a coordinator of another audit entity gets 404 on every campaign resource', async () => {
    for (const c of campaignResources) {
      const res = await call(s.coordES, c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(404);
    }
    const list = await call(s.coordES, ['get', () => '/api/campaigns']).expect(200);
    expect(list.body.items).toEqual([]);
  });

  it('lists the organizations assigned to it', async () => {
    const res = await call(s.coordCO, ['get', () => '/api/assigned-organizations']).expect(200);
    expect(res.body.items.map((o: { id: string }) => o.id).sort()).toEqual([env.orgs.CO, env.orgs.CO2].sort());
    const co = res.body.items.find((o: { id: string }) => o.id === env.orgs.CO);
    expect(co).toMatchObject({ coordinates: true, audits: false, auditor: { id: ids.auditorCO, email: SEED_USERS.auditorMulti } });
    expect(co.auditEntity.id).toBe(env.entities.CO);
  });

  it('manages the auditors of its audit entity only', async () => {
    const list = await call(s.coordCO, ['get', () => `/api/audit-entities/${env.entities.CO}/auditors`]).expect(200);
    expect(list.body.items.length).toBe(1);
    await call(s.coordCO, ['post', () => `/api/audit-entities/${env.entities.CO}/auditors`, { email: 'nuevo.auditor@auditoria.example' }]).expect(201);
    await call(s.coordCO, ['get', () => `/api/audit-entities/${env.entities.ES}/auditors`]).expect(404);
    await call(s.coordCO, ['post', () => `/api/audit-entities/${env.entities.ES}/auditors`, { email: 'x@auditoria.example' }]).expect(404);
    await call(s.coordCO, ['patch', () => `/api/audit-entities/${env.entities.ES}/auditors/${ids.auditorES}`, { status: 'inactive' }]).expect(404);
    // Even with its own entity in the URL, it cannot touch another entity's user.
    await call(s.coordCO, ['patch', () => `/api/audit-entities/${env.entities.CO}/auditors/${ids.auditorES}`, { status: 'inactive' }]).expect(404);
  });

  it('cannot manage organizations, audit entities, coordinators or configuration', async () => {
    await call(s.coordCO, ['get', () => '/api/organizations']).expect(403);
    await call(s.coordCO, ['get', () => `/api/organizations/${env.orgs.CO}`]).expect(403);
    await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.CO}/assignment`, { auditEntityId: env.entities.CO, coordinatorId: ids.coordCO }]).expect(403);
    await call(s.coordCO, ['get', () => '/api/audit-entities']).expect(403);
    await call(s.coordCO, ['post', () => `/api/audit-entities/${env.entities.CO}/coordinators`, { email: 'otro@certandes.example' }]).expect(403);
    await call(s.coordCO, ['get', () => '/api/config/sampling-tables']).expect(403);
    await call(s.coordCO, ['get', () => '/api/config/settings']).expect(403);
  });

  it('designates the auditor of its organizations, from its entity or itself', async () => {
    const eligible = await call(s.coordCO, ['get', () => `/api/organizations/${env.orgs.CO2}/assignable-auditors`]).expect(200);
    expect(eligible.body.items.map((u: { role: string }) => u.role).sort()).toEqual(['AUDITOR', 'AUDITOR', 'COORDINATOR']);
    await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.CO2}/auditor`, { auditorId: ids.auditorES }]).expect(422);
    await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.ES}/auditor`, { auditorId: ids.auditorCO }]).expect(404);
    await call(s.coordCO, ['get', () => `/api/organizations/${env.orgs.ES}/assignable-auditors`]).expect(404);
    await call(s.auditorCO, ['put', () => `/api/organizations/${env.orgs.CO2}/auditor`, { auditorId: ids.auditorCO }]).expect(403);

    // Self-assignment: the coordinator then acts as auditor of CO2.
    const res = await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.CO2}/auditor`, { auditorId: ids.coordCO }]).expect(200);
    expect(res.body.organization.auditor).toMatchObject({ id: ids.coordCO, role: 'COORDINATOR' });
    const created = await call(s.coordCO, ['post', () => '/api/campaigns', campaignInput({ organizationId: env.orgs.CO2 })]).expect(201);
    expect(created.body.campaign.access).toBe('manage');
    await call(s.coordCO, ['post', () => `/api/campaigns/${created.body.campaign.id}/sample`]).attach('file', csv, 'm.csv').expect(200);
    // Still only aggregate on the campaign led by auditor1.
    await call(s.coordCO, ['get', () => `/api/campaigns/${campaignCO}/sample/summary`]).expect(403);
  });

  it('reassigning the auditor moves open campaigns to the new one; removing it is refused while open', async () => {
    const newcomer = await call(s.coordCO, ['post', () => `/api/audit-entities/${env.entities.CO}/auditors`, { email: 'relevo@auditoria.example' }]).expect(201);
    const newcomerSession = await sessionFor(env, 'relevo@auditoria.example', env.entities.CO);
    const campaign = (await call(s.coordCO, ['get', () => '/api/campaigns']).expect(200)).body.items.find(
      (c: { organizationId: string }) => c.organizationId === env.orgs.CO2,
    );
    await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.CO2}/auditor`, { auditorId: newcomer.body.user.id }]).expect(200);
    const moved = await Campaign.findById(campaign.id).lean();
    expect(String(moved!.m1Config!.leadAuditorId)).toBe(newcomer.body.user.id);
    await call(newcomerSession, ['get', () => `/api/campaigns/${campaign.id}/sample/summary`]).expect(200);
    // The coordinator keeps the aggregate view only.
    const detail = await call(s.coordCO, ['get', () => `/api/campaigns/${campaign.id}`]).expect(200);
    expect(detail.body.campaign.access).toBe('aggregate');
    const refused = await call(s.coordCO, ['put', () => `/api/organizations/${env.orgs.CO2}/auditor`, { auditorId: null }]).expect(409);
    expect(refused.body.error.code).toBe('ORG_HAS_OPEN_CAMPAIGNS');
    const org = await Organization.findById(env.orgs.CO2).lean();
    expect(org!.assignmentHistory.length).toBe(3);
  });
});

describe('AUDITOR', () => {
  it.each(['auditorES', 'auditorMultiES'] as const)('%s (other audit entity) gets 404 on every resource of the CO campaign', async (who) => {
    for (const c of campaignResources) {
      const res = await call(s[who], c);
      expect(res.status, `${c[0]} ${c[1]()}`).toBe(404);
    }
    const list = await call(s[who], ['get', () => '/api/campaigns']).expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).not.toContain(campaignCO);
  });

  it('creates campaigns only for the organizations assigned to it', async () => {
    const options = await call(s.auditorCO, ['get', () => '/api/campaigns/options']).expect(200);
    expect(options.body.organizations.map((o: { id: string }) => o.id)).toEqual([env.orgs.CO]);
    for (const org of [env.orgs.ES, env.orgs.CO2, '0123456789abcdef01234567']) {
      await call(s.auditorCO, ['post', () => '/api/campaigns', campaignInput({ organizationId: org })]).expect(404);
      await call(s.auditorCO, ['post', () => '/api/campaigns/preview', campaignInput({ organizationId: org })]).expect(404);
    }
    const assigned = await call(s.auditorES, ['get', () => '/api/assigned-organizations']).expect(200);
    expect(assigned.body.items.map((o: { id: string; audits: boolean }) => [o.id, o.audits])).toEqual([[env.orgs.ES2, true]]);
  });

  it('cannot manage auditors, assignments, organizations or configuration', async () => {
    await call(s.auditorES, ['get', () => `/api/audit-entities/${env.entities.ES}/auditors`]).expect(403);
    await call(s.auditorES, ['get', () => '/api/organizations']).expect(403);
    await call(s.auditorES, ['get', () => '/api/audit-entities']).expect(403);
    await call(s.auditorES, ['get', () => `/api/organizations/${env.orgs.ES2}/assignable-auditors`]).expect(403);
    await call(s.auditorES, ['get', () => '/api/config/questionnaires']).expect(403);
  });

  it('another auditor of the same audit entity cannot see a campaign it does not lead', async () => {
    await call(s.coordCO, ['post', () => `/api/audit-entities/${env.entities.CO}/auditors`, { email: 'colega@auditoria.example' }]).expect(201);
    const colleague = await sessionFor(env, 'colega@auditoria.example', env.entities.CO);
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
      const detail = await call(s[who], ['get', () => `/api/campaigns/${campaignCO}`]).expect(200);
      expect(detail.body.campaign.access).toBe('supervise');
      const list = await call(s[who], ['get', () => '/api/campaigns']).expect(200);
      expect(list.body.items.map((i: { id: string }) => i.id)).toContain(campaignCO);
      await call(s[who], ['post', () => `/api/campaigns/${campaignCO}/sample`]).expect(403);
      await call(s[who], ['get', () => `/api/campaigns/${campaignCO}/sample/summary`]).expect(403);
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

  it('manage audit entities, coordinators and organization assignments', async () => {
    const entity = await call(s.superFundacion, [
      'post',
      () => '/api/audit-entities',
      { name: 'Certificadora Nueva (sintética)', country: 'ES', coordinatorEmail: 'coordinacion@nueva.example' },
    ]).expect(201);
    expect(entity.body.coordinator).toMatchObject({ role: 'COORDINATOR', email: 'coordinacion@nueva.example', auditEntityId: entity.body.auditEntity.id });
    expect(env.mail.outbox.at(-1)).toMatchObject({ to: 'coordinacion@nueva.example' });
    const entityId = entity.body.auditEntity.id;
    await call(s.superFundacion, ['post', () => `/api/audit-entities/${entityId}/coordinators`, { email: 'coordinacion@nueva.example' }]).expect(409);
    await call(s.superFundacion, ['post', () => '/api/audit-entities', { name: 'X', country: 'zz' }]).expect(400);
    const second = await call(s.superFundacion, ['post', () => `/api/audit-entities/${entityId}/coordinators`, { email: 'coordinacion2@nueva.example' }]).expect(201);

    const list = await call(s.superBumii, ['get', () => '/api/audit-entities']).expect(200);
    expect(list.body.items.find((e: { id: string }) => e.id === entityId)).toMatchObject({ coordinators: 2, auditors: 0, organizations: 0 });

    // Organization created already assigned; a coordinator of another entity is refused.
    const base = { name: 'Nueva Org (sintética)', country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'pt' };
    const bad = await call(s.superFundacion, ['post', () => '/api/organizations', { ...base, auditEntityId: entityId, coordinatorId: ids.coordES }]).expect(422);
    expect(bad.body.error.code).toBe('INVALID_COORDINATOR');
    expect(await Organization.countDocuments({ name: base.name })).toBe(0);
    await call(s.superFundacion, ['post', () => '/api/organizations', { ...base, coordinatorId: ids.coordES }]).expect(422);
    const org = await call(s.superFundacion, [
      'post',
      () => '/api/organizations',
      { ...base, auditEntityId: entityId, coordinatorId: entity.body.coordinator.id },
    ]).expect(201);
    expect(org.body.organization).toMatchObject({
      auditEntity: { id: entityId, name: 'Certificadora Nueva (sintética)' },
      coordinator: { email: 'coordinacion@nueva.example' },
      auditor: null,
    });
    const orgId = org.body.organization.id;
    const reassigned = await call(s.superBumii, ['put', () => `/api/organizations/${orgId}/assignment`, { auditEntityId: entityId, coordinatorId: second.body.user.id }]).expect(200);
    expect(reassigned.body.organization.coordinator.email).toBe('coordinacion2@nueva.example');
    const upd = await call(s.superBumii, ['patch', () => `/api/organizations/${orgId}`, { status: 'inactive' }]).expect(200);
    expect(upd.body.organization.status).toBe('inactive');
  });

  it('changing the audit entity is refused while campaigns are open and clears the auditor otherwise', async () => {
    const refused = await call(s.superFundacion, ['put', () => `/api/organizations/${env.orgs.CO}/assignment`, { auditEntityId: env.entities.ES, coordinatorId: ids.coordES }]).expect(409);
    expect(refused.body.error.code).toBe('ORG_HAS_OPEN_CAMPAIGNS');
    const moved = await call(s.superFundacion, ['put', () => `/api/organizations/${env.orgs.ES2}/assignment`, { auditEntityId: env.entities.CO, coordinatorId: ids.coordCO }]).expect(200);
    expect(moved.body.organization).toMatchObject({ auditEntity: { id: env.entities.CO }, coordinator: { id: ids.coordCO }, auditor: null });
    // The superadmin may also designate the auditor.
    const auditor = await call(s.superFundacion, ['put', () => `/api/organizations/${env.orgs.ES2}/auditor`, { auditorId: ids.auditorCO }]).expect(200);
    expect(auditor.body.organization.auditor.id).toBe(ids.auditorCO);
  });

  it('users of an inactive audit entity lose access', async () => {
    await call(s.superBumii, ['patch', () => `/api/audit-entities/${env.entities.ES}`, { status: 'inactive' }]).expect(200);
    await call(s.coordES, ['get', () => '/api/auth/me']).expect(401);
    await call(s.superBumii, ['patch', () => `/api/audit-entities/${env.entities.ES}`, { status: 'active' }]).expect(200);
    await call(s.coordES, ['get', () => '/api/auth/me']).expect(200);
  });
});
