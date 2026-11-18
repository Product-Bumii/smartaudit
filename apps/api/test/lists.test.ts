import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { Campaign, Organization } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

let env: TestEnv;
let superadmin: string;
let auditor: string;
let coordinator: string;
beforeAll(async () => {
  env = await startTestEnv();
  superadmin = await sessionFor(env, SEED_USERS.superFundacion);
  auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.entities.CO);
  coordinator = await sessionFor(env, SEED_USERS.coordinatorCO, env.entities.CO);
  // 30 extra organizations without audit entity, to page through.
  await Organization.insertMany(
    Array.from({ length: 30 }, (_, i) => ({ name: `Empresa ${String(i + 1).padStart(2, '0')} (sintética)`, country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'es' })),
  );
});
afterAll(() => env?.stop());

const names = (res: request.Response) => res.body.items.map((o: { name: string }) => o.name);

describe('organization list (superadmins): search, filters, sorting and pages', () => {
  it('pages with 25 rows by default, sorted by name ignoring accents and case', async () => {
    const res = await request(env.app).get('/api/organizations').set('Cookie', superadmin).expect(200);
    expect(res.body).toMatchObject({ total: 34, page: 1, pageSize: 25 });
    expect(res.body.items).toHaveLength(25);
    expect(names(res).slice(0, 3)).toEqual(['Andina Servicios S.A.S. (sintética)', 'Costa Alimentos S.A.S. (sintética)', 'Empresa 01 (sintética)']);
    const last = await request(env.app).get('/api/organizations?page=2&pageSize=25').set('Cookie', superadmin).expect(200);
    expect(last.body.items).toHaveLength(9);
    expect(names(last).at(-1)).toBe('Montaña Textil S.L. (sintética)');
  });

  it('searches by name without accents and filters by audit entity and status', async () => {
    const montana = await request(env.app).get('/api/organizations?q=montana').set('Cookie', superadmin).expect(200);
    expect(names(montana)).toEqual(['Montaña Textil S.L. (sintética)']);
    const icontec = await request(env.app).get(`/api/organizations?auditEntityId=${env.entities.CO}`).set('Cookie', superadmin).expect(200);
    expect(names(icontec)).toEqual(['Andina Servicios S.A.S. (sintética)', 'Costa Alimentos S.A.S. (sintética)']);
    const none = await request(env.app).get('/api/organizations?auditEntityId=none&pageSize=10&sort=name&dir=desc').set('Cookie', superadmin).expect(200);
    expect(none.body.total).toBe(30);
    expect(names(none)[0]).toBe('Empresa 30 (sintética)');
    const inactive = await request(env.app).get('/api/organizations?status=inactive').set('Cookie', superadmin).expect(200);
    expect(inactive.body.total).toBe(0);
    await request(env.app).get('/api/organizations?pageSize=1000').set('Cookie', superadmin).expect(400);
  });

  it('coordinators and auditors page and search their own organizations only', async () => {
    const mine = await request(env.app).get('/api/assigned-organizations?q=costa').set('Cookie', coordinator).expect(200);
    expect(mine.body).toMatchObject({ total: 1, page: 1, pageSize: 25 });
    expect(names(mine)).toEqual(['Costa Alimentos S.A.S. (sintética)']);
    const audited = await request(env.app).get('/api/assigned-organizations?q=empresa').set('Cookie', auditor).expect(200);
    expect(audited.body.total).toBe(0);
  });
});

describe('campaign list: search, status filter, sorting and pages', () => {
  beforeAll(async () => {
    for (let i = 1; i <= 12; i++) {
      await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput({ reference: `Auditoría ${String(i).padStart(2, '0')}` })).expect(201);
    }
    const cancelled = await Campaign.findOne({ reference: 'Auditoría 12' });
    await Campaign.updateOne({ _id: cancelled!._id }, { $set: { status: 'cancelada' } });
  });

  it('pages newest first and searches reference or organization', async () => {
    const res = await request(env.app).get('/api/campaigns?pageSize=10').set('Cookie', auditor).expect(200);
    expect(res.body).toMatchObject({ total: 12, page: 1, pageSize: 10 });
    expect(res.body.items[0]).toMatchObject({ reference: 'Auditoría 12', organizationName: 'Andina Servicios S.A.S. (sintética)', access: 'manage' });
    const byRef = await request(env.app).get('/api/campaigns?q=auditoria 0').set('Cookie', auditor).expect(200);
    expect(byRef.body.total).toBe(9);
    const byOrg = await request(env.app).get('/api/campaigns?q=andina').set('Cookie', auditor).expect(200);
    expect(byOrg.body.total).toBe(12);
    const none = await request(env.app).get('/api/campaigns?q=logistica').set('Cookie', auditor).expect(200);
    expect(none.body.total).toBe(0);
  });

  it('filters open / closed / one status and sorts by reference', async () => {
    const open = await request(env.app).get('/api/campaigns?status=open&sort=reference').set('Cookie', auditor).expect(200);
    expect(open.body.total).toBe(11);
    expect(open.body.items[0].reference).toBe('Auditoría 01');
    const closed = await request(env.app).get('/api/campaigns?status=closed').set('Cookie', auditor).expect(200);
    expect(closed.body.items.map((c: { reference: string }) => c.reference)).toEqual(['Auditoría 12']);
    const draft = await request(env.app).get('/api/campaigns?status=borrador&sort=reference&dir=desc&pageSize=10&page=2').set('Cookie', auditor).expect(200);
    expect(draft.body.items.map((c: { reference: string }) => c.reference)).toEqual(['Auditoría 01']);
  });

  it('the coordinator sees them with aggregate access; superadmins see all; other entities nothing', async () => {
    const coord = await request(env.app).get('/api/campaigns?sort=organization').set('Cookie', coordinator).expect(200);
    expect(coord.body.total).toBe(12);
    expect(coord.body.items.every((c: { access: string }) => c.access === 'aggregate')).toBe(true);
    const sup = await request(env.app).get(`/api/campaigns?organizationId=${env.orgs.CO}&sort=interviewStartDate`).set('Cookie', superadmin).expect(200);
    expect(sup.body.total).toBe(12);
    const other = await sessionFor(env, SEED_USERS.coordinatorES, env.entities.ES);
    expect((await request(env.app).get('/api/campaigns').set('Cookie', other).expect(200)).body.total).toBe(0);
  });
});
