import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Campaign, ParticipantContact, Settings, getSettings } from '@smartaudit/api/models';
import { runRetentionPurge } from '../src/jobs/retention';

let rs: MongoMemoryReplSet;
beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 90_000 }] });
  await mongoose.connect(rs.getUri('worker_test'));
});
afterAll(async () => {
  await mongoose.disconnect();
  await rs?.stop();
});

const oid = () => new mongoose.Types.ObjectId();
async function campaign(status: string, closedAt: Date) {
  const c = await Campaign.create({
    module: 'M1',
    organizationId: oid(),
    slug: `s${Math.random().toString(36).slice(2, 12)}`,
    createdBy: oid(),
    status,
    statusHistory: [{ from: 'en_curso', to: status === 'informe_generado' ? 'finalizada' : status, at: closedAt }],
  });
  await ParticipantContact.create({ campaignId: c._id, organizationId: c.organizationId, respondentId: oid(), sourceRow: 2, noEmail: true });
  return c;
}

describe('retention purge', () => {
  it('does nothing while disabled (default)', async () => {
    await getSettings();
    expect(await runRetentionPurge(new Date())).toEqual({ skipped: true, contactsDeleted: 0, interviewsAnonymized: 0 });
  });

  it('deletes contacts of campaigns closed before the cut-off only', async () => {
    const now = new Date('2026-11-12T00:00:00Z');
    const old = await campaign('finalizada', new Date('2026-08-01T00:00:00Z'));
    const recent = await campaign('finalizada', new Date('2026-11-01T00:00:00Z'));
    const running = await campaign('en_curso', new Date('2026-01-01T00:00:00Z'));
    await Settings.updateOne({ key: 'global' }, { $set: { retention: { enabled: true, deleteContactsAfterDays: 30, anonymizeResponsesAfterYears: 5 } } });
    const r = await runRetentionPurge(now);
    expect(r).toMatchObject({ skipped: false, contactsDeleted: 1 });
    expect(await ParticipantContact.countDocuments({ campaignId: old._id })).toBe(0);
    expect(await ParticipantContact.countDocuments({ campaignId: recent._id })).toBe(1);
    expect(await ParticipantContact.countDocuments({ campaignId: running._id })).toBe(1);
  });
});
