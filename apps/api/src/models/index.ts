export * from './core';
export * from './configuration';
export * from './campaign';

import { AuditLog, MagicLinkToken, Organization, Settings, User } from './core';
import { HolidayCalendar, Questionnaire, SamplingTable } from './configuration';
import { Campaign, Interview, ParticipantContact, Report, Respondent } from './campaign';

export const ALL_MODELS = [
  Organization,
  User,
  MagicLinkToken,
  SamplingTable,
  HolidayCalendar,
  Questionnaire,
  Campaign,
  ParticipantContact,
  Respondent,
  Interview,
  Report,
  AuditLog,
  Settings,
];

/** Creates collections and indexes (used by migrations, seed and tests). */
export async function syncAllIndexes(): Promise<void> {
  for (const m of ALL_MODELS) {
    await m.createCollection().catch(() => undefined);
    await m.syncIndexes();
  }
}
