/**
 * Idempotent seed with SYNTHETIC data only (see docs/datos-sinteticos.md).
 * Reuses the API models; every email is encrypted and hashed like in production.
 */
import { applyHolidayOverrides, officialHolidays, type Role } from '@smartaudit/shared';
import type { Types } from 'mongoose';
import { FieldCrypto } from '../apps/api/src/lib/crypto';
import {
  getSettings,
  HolidayCalendar,
  Organization,
  Questionnaire,
  SamplingTable,
  syncAllIndexes,
  User,
} from '../apps/api/src/models';
import questionnaire from './data/questionnaire-m1-v1.json';
import samplingTable from './data/sampling-table-v1.json';

export const SEED_USERS = {
  superBumii: 'superadmin.bumii@bumii.example',
  superFundacion: 'superadmin.fundacion@masfamilia.example',
  adminCO: 'admin@andina.example',
  adminES: 'admin@iberica.example',
  auditorMulti: 'auditor1@auditoria.example',
  auditorES: 'auditor2@auditoria.example',
} as const;

export const SEED_ORGS = {
  CO: { name: 'Andina Servicios S.A.S. (sintética)', country: 'CO', timeZone: 'America/Bogota', defaultLanguage: 'es' },
  ES: { name: 'Ibérica Logística S.L. (sintética)', country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'es' },
} as const;

export async function runSeed(crypto: FieldCrypto, log: (m: string) => void = console.log): Promise<void> {
  await syncAllIndexes();
  await getSettings();

  if (!(await SamplingTable.exists({ version: samplingTable.version }))) {
    await SamplingTable.create({ version: samplingTable.version, status: 'published', publishedAt: new Date(), brackets: samplingTable.brackets, notes: samplingTable.source });
    log('sampling table v1 published');
  }

  if (!(await Questionnaire.exists({ module: 'M1', version: questionnaire.version }))) {
    await Questionnaire.create({
      module: 'M1',
      version: questionnaire.version,
      title: questionnaire.title,
      status: 'published',
      publishedAt: new Date(),
      notes: questionnaire.source,
      languages: questionnaire.languages.map((l) => ({ ...l, approvedAt: l.status === 'approved' ? new Date() : null })),
      questions: questionnaire.questions,
    });
    log('questionnaire M1 v1 published (es approved; en, ca pending approval)');
  }

  for (const country of ['CO', 'ES']) {
    for (const year of [2026, 2027]) {
      if (await HolidayCalendar.exists({ country, year })) continue;
      const officialDates = officialHolidays(country, year);
      const overrides = { add: [], remove: [] };
      await HolidayCalendar.create({ country, year, version: 1, status: 'published', publishedAt: new Date(), officialDates, overrides, dates: applyHolidayOverrides(officialDates, overrides) });
      log(`holidays ${country} ${year} published`);
    }
  }

  const upsertUser = async (email: string, role: Role, organizationId: Types.ObjectId | null) => {
    const emailHash = crypto.hash(email);
    if (await User.exists({ emailHash, organizationId })) return;
    await User.create({ emailEncrypted: crypto.encrypt(email), emailHash, role, organizationId, preferredLanguage: 'es' });
    log(`user ${role}${organizationId ? ` @ ${organizationId}` : ''}`);
  };
  const upsertOrg = async (o: (typeof SEED_ORGS)[keyof typeof SEED_ORGS]) =>
    (await Organization.findOne({ name: o.name })) ?? (await Organization.create(o));

  await upsertUser(SEED_USERS.superBumii, 'SUPERADMIN_BUMII', null);
  await upsertUser(SEED_USERS.superFundacion, 'SUPERADMIN_FUNDACION', null);
  const co = await upsertOrg(SEED_ORGS.CO);
  const es = await upsertOrg(SEED_ORGS.ES);
  await upsertUser(SEED_USERS.adminCO, 'ORG_ADMIN', co._id);
  await upsertUser(SEED_USERS.adminES, 'ORG_ADMIN', es._id);
  // Same email in two organizations → account selection after the magic link.
  await upsertUser(SEED_USERS.auditorMulti, 'AUDITOR', co._id);
  await upsertUser(SEED_USERS.auditorMulti, 'AUDITOR', es._id);
  await upsertUser(SEED_USERS.auditorES, 'AUDITOR', es._id);
}
