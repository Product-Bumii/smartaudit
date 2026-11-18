import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { MagicLinkToken, User } from '../src/models';
import { loadConfig } from '../src/config';
import { lastMagicToken, sessionFor, startTestEnv, TEST_ENV, type TestEnv } from './helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv({ rateLimits: { magicLinkPerEmail: 5 } });
});
afterAll(() => env?.stop());

const cookiesOf = (res: request.Response): string[] => {
  const raw = res.headers['set-cookie'] as unknown;
  return Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
};
const cookieValue = (res: request.Response, name: string) =>
  cookiesOf(res).find((c) => c.startsWith(`${name}=`))?.split(';')[0];

describe('magic link authentication', () => {
  it('logs in a single-account user with a one-time link and sets a secure session cookie', async () => {
    await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.coordinatorCO }).expect(202);
    const token = lastMagicToken(env.mail, SEED_USERS.coordinatorCO);
    expect(env.mail.outbox.at(-1)!.html).toContain('powered by Bumii');

    const res = await request(env.app).post('/api/auth/verify').send({ token }).expect(200);
    expect(res.body.status).toBe('authenticated');
    expect(res.body.user).toMatchObject({ role: 'COORDINATOR', auditEntityId: env.entities.CO, auditEntityName: 'ICONTEC', email: SEED_USERS.coordinatorCO });
    const setCookie = cookiesOf(res).find((c) => c.startsWith('sa_session='))!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    const me = await request(env.app).get('/api/auth/me').set('Cookie', cookieValue(res, 'sa_session')!).expect(200);
    expect(me.body.user.role).toBe('COORDINATOR');

    // Single use
    await request(env.app).post('/api/auth/verify').send({ token }).expect(401);
  });

  it('stores only the token hash and expires links after 15 minutes', async () => {
    await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.superBumii }).expect(202);
    const token = lastMagicToken(env.mail, SEED_USERS.superBumii);
    const record = await MagicLinkToken.findOne().sort({ createdAt: -1 }).lean();
    expect(JSON.stringify(record)).not.toContain(token);
    const minutes = (record!.expiresAt.getTime() - env.ctx.now().getTime()) / 60000;
    expect(minutes).toBe(15);
    await MagicLinkToken.updateOne({ _id: record!._id }, { $set: { expiresAt: new Date('2026-11-12T11:00:00Z') } });
    await request(env.app).post('/api/auth/verify').send({ token }).expect(401);
  });

  it('asks to choose an audit entity when the email has several accounts', async () => {
    await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.auditorMulti, language: 'pt' }).expect(202);
    expect(env.mail.outbox.at(-1)!.subject).toContain('ligação de acesso');
    const token = lastMagicToken(env.mail, SEED_USERS.auditorMulti);
    const res = await request(env.app).post('/api/auth/verify').send({ token }).expect(200);
    expect(res.body.status).toBe('select_account');
    expect(res.body.accounts).toHaveLength(2);
    expect(cookieValue(res, 'sa_session')).toBeUndefined();
    const selection = cookieValue(res, 'sa_select')!;

    const list = await request(env.app).get('/api/auth/accounts').set('Cookie', selection).expect(200);
    expect(list.body.accounts).toHaveLength(2);

    const other = await User.findOne({ role: 'COORDINATOR' }).lean();
    await request(env.app).post('/api/auth/select').set('Cookie', selection).send({ userId: String(other!._id) }).expect(401);
    await request(env.app).post('/api/auth/select').send({ userId: res.body.accounts[0].userId }).expect(401);

    const es = res.body.accounts.find((a: { auditEntityId: string }) => a.auditEntityId === env.entities.ES);
    const ok = await request(env.app).post('/api/auth/select').set('Cookie', selection).send({ userId: es.userId }).expect(200);
    expect(ok.body.user).toMatchObject({ role: 'AUDITOR', auditEntityId: env.entities.ES });
    expect(cookieValue(ok, 'sa_session')).toBeDefined();
  });

  it('does not reveal unknown emails and sends nothing', async () => {
    const before = env.mail.outbox.length;
    await request(env.app).post('/api/auth/magic-link').send({ email: 'nadie@nowhere.example' }).expect(202);
    expect(env.mail.outbox.length).toBe(before);
  });

  it('rate-limits magic link requests per email', async () => {
    const email = 'limite@nowhere.example';
    for (let i = 0; i < 5; i++) await request(env.app).post('/api/auth/magic-link').send({ email }).expect(202);
    const res = await request(env.app).post('/api/auth/magic-link').send({ email }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('rejects invalid input with the uniform error format', async () => {
    const res = await request(env.app).post('/api/auth/magic-link').send({ email: 'not-an-email' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    await request(env.app).get('/api/auth/me').expect(401);
    await request(env.app).get('/api/nope').expect(404);
  });

  it('updates the preferred language and logs out', async () => {
    const cookie = await sessionFor(env, SEED_USERS.coordinatorES, env.entities.ES);
    const res = await request(env.app).patch('/api/auth/me').set('Cookie', cookie).send({ preferredLanguage: 'en' }).expect(200);
    expect(res.body.user.preferredLanguage).toBe('en');
    const out = await request(env.app).post('/api/auth/logout').expect(200);
    expect(cookiesOf(out).some((c) => c.startsWith('sa_session=;'))).toBe(true);
  });

  it('a deactivated user loses access immediately', async () => {
    const cookie = await sessionFor(env, SEED_USERS.auditorES, env.entities.ES);
    await request(env.app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    await User.updateOne({ emailHash: env.ctx.crypto.hash(SEED_USERS.auditorES) }, { $set: { status: 'inactive' } });
    await request(env.app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    await User.updateOne({ emailHash: env.ctx.crypto.hash(SEED_USERS.auditorES) }, { $set: { status: 'active' } });
  });

  it('returns the link on screen only in test environments with DEV_SHOW_MAGIC_LINK', async () => {
    const off = await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.coordinatorES }).expect(202);
    expect(off.body).toEqual({ ok: true });
    env.ctx.config.devShowMagicLink = true;
    try {
      const on = await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.coordinatorES }).expect(202);
      expect(on.body.devLink).toMatch(/^http:\/\/localhost:4200\/auth\/verify\?token=[\w-]{40,}$/);
      const token = new URL(on.body.devLink).searchParams.get('token');
      await request(env.app).post('/api/auth/verify').send({ token }).expect(200);
      const unknown = await request(env.app).post('/api/auth/magic-link').send({ email: 'nadie@nowhere.example' }).expect(202);
      expect(unknown.body.devLink).toBeUndefined();
    } finally {
      env.ctx.config.devShowMagicLink = false;
    }
  });

  it('refuses DEV_SHOW_MAGIC_LINK in production', () => {
    expect(() => loadConfig({ ...TEST_ENV, NODE_ENV: 'production', MAIL_PROVIDER: 'smtp', DEV_SHOW_MAGIC_LINK: 'true' })).toThrow(/not allowed/);
    expect(loadConfig({ ...TEST_ENV, NODE_ENV: 'production', MAIL_PROVIDER: 'smtp' }).devShowMagicLink).toBe(false);
    expect(() => loadConfig({ ...TEST_ENV, NODE_ENV: 'production', MAIL_PROVIDER: 'disabled' })).toThrow(/not allowed/);
  });

  it('allows the on-screen link in staging (no email), with secure cookies and no dev outbox', () => {
    const c = loadConfig({ ...TEST_ENV, NODE_ENV: 'staging', MAIL_PROVIDER: 'disabled', DEV_SHOW_MAGIC_LINK: 'true' });
    expect(c).toMatchObject({ devShowMagicLink: true, cookieSecure: true, enableDevOutbox: false });
    expect(() => loadConfig({ ...TEST_ENV, NODE_ENV: 'staging', MAIL_PROVIDER: 'memory', ENABLE_DEV_OUTBOX: 'true' })).toThrow(/not allowed in staging/);
  });

  it('reports health', async () => {
    const res = await request(env.app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});
