/**
 * Idempotent seed with SYNTHETIC data only (see docs/datos-sinteticos.md).
 * Reuses the API models; every email is encrypted and hashed like in production.
 */
import { type Language, type Question, type QuestionnaireLanguage, type Role } from '@smartaudit/shared';
import type { Types } from 'mongoose';
import { FieldCrypto } from '../apps/api/src/lib/crypto';
import {
  getSettings,
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

  await addMissingQuestionnaireLanguages(log);


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

/**
 * Existing databases: if the latest published M1 questionnaire lacks languages present in the seed file
 * (e.g. pt, fr added later), publish a NEW version with those texts merged by question/option code and the
 * new languages pending approval. Published versions are never edited; campaigns keep their own snapshot.
 */
async function addMissingQuestionnaireLanguages(log: (m: string) => void): Promise<void> {
  const latest = await Questionnaire.findOne({ module: 'M1', status: 'published' }).sort({ version: -1 }).lean();
  if (!latest) return;
  const present = new Set((latest.languages as QuestionnaireLanguage[]).map((l) => l.lang));
  const missing = (questionnaire.languages as QuestionnaireLanguage[]).map((l) => l.lang).filter((l) => !present.has(l));
  if (missing.length === 0) return;
  if (await Questionnaire.exists({ module: 'M1', status: 'draft' })) {
    log(`questionnaire: languages ${missing.join(', ')} not added (a draft exists)`);
    return;
  }
  const seedByCode = new Map((questionnaire.questions as Question[]).map((q) => [q.code, q]));
  const merge = (target: Record<string, string> | null | undefined, source: Record<string, string> | null | undefined) => {
    if (!target || !source) return target;
    for (const lang of missing) if (source[lang] && !target[lang]) target[lang] = source[lang];
    return target;
  };
  const questions = structuredClone(latest.questions as Question[]).map((q) => {
    const src = seedByCode.get(q.code);
    if (!src) return q;
    merge(q.text as Record<string, string>, src.text as Record<string, string>);
    merge(q.help as Record<string, string> | null, src.help as Record<string, string> | null);
    for (const o of q.options) {
      const so = src.options.find((x) => x.code === o.code);
      merge(o.label as Record<string, string>, so?.label as Record<string, string>);
      if (o.freeText && so?.freeText) merge(o.freeText.label as Record<string, string>, so.freeText.label as Record<string, string>);
    }
    return q;
  });
  const version = latest.version + 1;
  await Questionnaire.create({
    module: 'M1',
    version,
    title: latest.title,
    status: 'published',
    publishedAt: new Date(),
    notes: `Copia de la versión ${latest.version} con idiomas añadidos: ${missing.join(', ')}`,
    languages: [...(latest.languages as QuestionnaireLanguage[]), ...missing.map((lang: Language) => ({ lang, status: 'pending_approval' }))],
    questions,
  });
  log(`questionnaire M1 v${version} published with new languages ${missing.join(', ')} (pending approval)`);
}
