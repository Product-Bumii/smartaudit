/**
 * Acceptance criterion: no email in clear text anywhere in the database, and respondents hold no
 * identifiers. Also unit-tests the field encryption.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { FieldCrypto } from '../src/lib/crypto';
import { Respondent } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, TEST_ENV, type TestEnv } from './helpers';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
  const auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.CO);
  const admin = await sessionFor(env, SEED_USERS.adminCO, env.orgs.CO);
  await request(env.app).post(`/api/organizations/${env.orgs.CO}/auditors`).set('Cookie', admin).send({ email: 'privacidad@auditoria.example' }).expect(201);
  const c = await request(env.app).post('/api/campaigns').set('Cookie', auditor).send(campaignInput()).expect(201);
  await request(env.app)
    .post(`/api/campaigns/${c.body.campaign.id}/sample`)
    .set('Cookie', auditor)
    .attach('file', readFileSync(join(__dirname, '../../../seed/samples/muestra-valida-30.csv')), 'm.csv')
    .expect(200);
  await request(env.app).post('/api/auth/magic-link').send({ email: SEED_USERS.adminCO }).expect(202);
});
afterAll(() => env?.stop());

describe('privacy', () => {
  it('stores no clear-text email in any collection', async () => {
    const db = mongoose.connection.db!;
    const collections = await db.listCollections().toArray();
    expect(collections.length).toBeGreaterThanOrEqual(12);
    for (const { name } of collections) {
      const docs = await db.collection(name).find().toArray();
      for (const d of docs) {
        // The configured system sender (e.g. no-reply@bumii.ai) is not personal data.
        if (name === 'settings') delete d.mailFromAddress;
        expect(JSON.stringify(d), `${name}`).not.toMatch(EMAIL_RE);
      }
    }
  });

  it('respondents only carry demographics and status', async () => {
    const r = await Respondent.findOne().lean();
    expect(Object.keys(r!).sort()).toEqual(['__v', '_id', 'campaignId', 'completedAt', 'createdAt', 'demographics', 'module', 'organizationId', 'startedAt', 'status', 'updatedAt']);
  });

  it('AES-256-GCM round-trips, detects tampering and requires a 32-byte key', () => {
    const c = new FieldCrypto(TEST_ENV.FIELD_ENCRYPTION_KEY, TEST_ENV.EMAIL_HASH_KEY);
    const enc = c.encrypt('persona@empresa.example');
    expect(enc).not.toContain('persona');
    expect(c.encrypt('persona@empresa.example')).not.toBe(enc); // random IV
    expect(c.decrypt(enc)).toBe('persona@empresa.example');
    const parts = enc.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => c.decrypt(parts.join(':'))).toThrow();
    expect(() => c.decrypt('v0:a:b:c')).toThrow('Invalid encrypted payload');
    expect(c.hash('a@b.co')).toBe(c.hash('a@b.co'));
    expect(() => new FieldCrypto(Buffer.alloc(16).toString('base64'), 'k')).toThrow();
  });
});
