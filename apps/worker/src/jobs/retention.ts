/**
 * Retention purge (section 4). OFF by default (`settings.retention.enabled = false`).
 * - Deletes participant contacts of campaigns closed more than X days ago.
 * - Anonymizes free texts of interviews of campaigns closed more than Y years ago.
 */
import { retentionCutoffs, type RetentionSettings } from '@smartaudit/shared';
import { AuditLog, Campaign, getSettings, Interview, ParticipantContact } from '@smartaudit/api/models';

const CLOSED = ['finalizada', 'informe_generado', 'cancelada'];

const closedBefore = (cutoff: Date) => ({
  status: { $in: CLOSED },
  statusHistory: { $elemMatch: { to: { $in: ['finalizada', 'cancelada'] }, at: { $lt: cutoff } } },
});

export interface PurgeResult {
  skipped: boolean;
  contactsDeleted: number;
  interviewsAnonymized: number;
}

export async function runRetentionPurge(now: Date): Promise<PurgeResult> {
  const settings = await getSettings();
  const cutoffs = retentionCutoffs(settings.retention as RetentionSettings, now);
  if (!cutoffs) return { skipped: true, contactsDeleted: 0, interviewsAnonymized: 0 };

  let contactsDeleted = 0;
  let interviewsAnonymized = 0;
  if (cutoffs.contactsClosedBefore) {
    const ids = (await Campaign.find(closedBefore(cutoffs.contactsClosedBefore), { _id: 1 }).lean()).map((c) => c._id);
    contactsDeleted = (await ParticipantContact.deleteMany({ campaignId: { $in: ids } })).deletedCount;
  }
  if (cutoffs.anonymizeClosedBefore) {
    const ids = (await Campaign.find(closedBefore(cutoffs.anonymizeClosedBefore), { _id: 1 }).lean()).map((c) => c._id);
    const res = await Interview.updateMany(
      { campaignId: { $in: ids }, 'messages.0': { $exists: true } },
      { $set: { messages: [], 'answers.$[].originalText': null, 'answers.$[].supportingQuote': null, 'answers.$[].freeText': null } },
    );
    interviewsAnonymized = res.modifiedCount;
  }
  await AuditLog.create({
    action: 'retention.purge',
    resourceType: 'system',
    meta: { contactsDeleted, interviewsAnonymized },
    at: now,
  });
  return { skipped: false, contactsDeleted, interviewsAnonymized };
}
