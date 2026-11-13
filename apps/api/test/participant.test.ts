import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_USERS } from '../../../seed/seed-lib';
import { Campaign, ParticipantContact, Respondent } from '../src/models';
import { campaignInput, sessionFor, startTestEnv, type TestEnv } from './helpers';

const csv = readFileSync(join(__dirname, '../../../seed/samples/muestra-valida-30.csv'));

let env: TestEnv;
let slug: string;
let campaignId: string;
let codes: string[];
let otherCampaignCode: string;

async function createCampaignWithCodes(cookie: string) {
  const c = await request(env.app).post('/api/campaigns').set('Cookie', cookie).send(campaignInput()).expect(201);
  await request(env.app).post(`/api/campaigns/${c.body.campaign.id}/sample`).set('Cookie', cookie).attach('file', csv, 'm.csv').expect(200);
  const res = await request(env.app).get(`/api/campaigns/${c.body.campaign.id}/access-codes?format=csv`).set('Cookie', cookie).expect(200);
  const list = res.text.replace('﻿', '').trim().split('\r\n').slice(1).map((l) => l.split(',')[1]);
  return { id: c.body.campaign.id as string, slug: c.body.campaign.slug as string, codes: list };
}

beforeAll(async () => {
  env = await startTestEnv({ rateLimits: { accessCodePerIp: 4 } });
  const auditor = await sessionFor(env, SEED_USERS.auditorMulti, env.orgs.CO);
  const a = await createCampaignWithCodes(auditor);
  ({ slug, codes } = a);
  campaignId = a.id;
  otherCampaignCode = (await createCampaignWithCodes(auditor)).codes[0];
});
afterAll(() => env?.stop());

const access = (code: string, s = slug) => request(env.app).post(`/api/participant/c/${s}/access`).send({ code });

describe('participant landing /c/:slug', () => {
  it('exposes only the offered languages, without organization data', async () => {
    const res = await request(env.app).get(`/api/participant/c/${slug}`).expect(200);
    expect(res.body).toEqual({ offeredLanguages: ['es'] });
    await request(env.app).get('/api/participant/c/NOT-A-SLUG').expect(404);
    await request(env.app).get('/api/participant/c/zzzzzzzzzz').expect(404);
  });

  it('accepts a valid code typed in lowercase with dashes; not open before the window', async () => {
    const typed = `${codes[0].slice(0, 4).toLowerCase()}-${codes[0].slice(4).toLowerCase()}`;
    const res = await access(typed).expect(200);
    expect(res.body.availability).toBe('not_open_yet');
    expect(res.body.window).toMatchObject({ timeZone: 'America/Bogota' });
    expect(JSON.stringify(res.body)).not.toMatch(/@|respondent|contact/i);
  });

  it('reports open, completed and unavailable states', async () => {
    await Campaign.updateOne({ _id: campaignId }, { $set: { status: 'en_curso', 'window.opensAt': new Date('2026-11-01T00:00:00Z') } });
    expect((await access(codes[1]).expect(200)).body.availability).toBe('open');

    const contact = await ParticipantContact.findOne({ campaignId, noEmail: true }).sort({ sourceRow: 1 }).skip(1).lean();
    await Respondent.updateOne({ _id: contact!.respondentId }, { $set: { status: 'completed', completedAt: new Date() } });
    expect((await access(codes[1]).expect(200)).body.availability).toBe('completed');

    await Campaign.updateOne({ _id: campaignId }, { $set: { status: 'suspendida' } });
    expect((await access(codes[2]).expect(200)).body.availability).toBe('unavailable');
  });

  it('rejects codes of another campaign and malformed codes, then locks the IP temporarily', async () => {
    expect((await access(otherCampaignCode).expect(401)).body.error.code).toBe('INVALID_ACCESS_CODE');
    await access('1234').expect(401);
    await access('ABCDEFGH').expect(401);
    await access('ABCDEFGJ').expect(401);
    // 4 failed attempts reached: even a valid code is blocked during the lockout window.
    expect((await access(codes[0]).expect(429)).body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
