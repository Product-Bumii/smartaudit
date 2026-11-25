/**
 * Idempotent seed with SYNTHETIC data only (see docs/datos-sinteticos.md).
 * Reuses the API models; every email is encrypted and hashed like in production.
 */
import { type Language, type Question, type QuestionnaireLanguage, type Role } from '@smartaudit/shared';
import type { Types } from 'mongoose';
import { FieldCrypto } from '../apps/api/src/lib/crypto';
import {
  AuditEntity,
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
  coordinatorCO: 'coordinacion@icontec.example',
  coordinatorES: 'coordinacion@aenor.example',
  /** Auditor of both audit entities → account selection after the magic link. */
  auditorMulti: 'auditor1@auditoria.example',
  auditorES: 'auditor2@auditoria.example',
} as const;

/**
 * Audit entities (certification bodies): the real master list provided by F+f (decision 67). Their
 * coordinators, auditors and organizations in the seed are synthetic. Country only where it is certain.
 */
export const SEED_ENTITY_CATALOG: { name: string; country: string | null }[] = [
  { name: 'AENOR', country: 'ES' },
  { name: 'APCER', country: 'PT' },
  { name: 'AUDELCO', country: null },
  { name: 'CMD', country: null },
  { name: 'DNV', country: null },
  { name: 'EDUQATIA', country: null },
  { name: 'ICONTEC', country: 'CO' },
  { name: 'LOT', country: null },
  { name: 'SGS', country: null },
];
/** Entities that carry the synthetic test users. */
export const SEED_ENTITIES = {
  CO: { name: 'ICONTEC', country: 'CO' },
  ES: { name: 'AENOR', country: 'ES' },
} as const;

export const SEED_ORGS = {
  CO: { name: 'Andina Servicios S.A.S. (sintética)', country: 'CO', timeZone: 'America/Bogota', defaultLanguage: 'es' },
  ES: { name: 'Ibérica Logística S.L. (sintética)', country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'es' },
  /** Assigned to a coordinator but still without auditor (to try the assignment). */
  CO2: { name: 'Costa Alimentos S.A.S. (sintética)', country: 'CO', timeZone: 'America/Bogota', defaultLanguage: 'es' },
  ES2: { name: 'Montaña Textil S.L. (sintética)', country: 'ES', timeZone: 'Europe/Madrid', defaultLanguage: 'es' },
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
    log('questionnaire M1 v1 published (es approved; en, ca, pt, fr pending approval)');
  }

  await syncQuestionnaireWithSeed(log);


  const upsertUser = async (email: string, role: Role, auditEntityId: Types.ObjectId | null) => {
    const emailHash = crypto.hash(email);
    const existing = await User.findOne({ emailHash, auditEntityId });
    if (existing) return existing;
    log(`user ${role}${auditEntityId ? ` @ ${auditEntityId}` : ''}`);
    return User.create({ emailEncrypted: crypto.encrypt(email), emailHash, role, auditEntityId, preferredLanguage: 'es' });
  };
  const upsertEntity = async (e: { name: string; country: string | null }) =>
    (await AuditEntity.findOne({ name: e.name })) ?? (await AuditEntity.create(e));
  /** Creates the organization and, only when it has no assignment yet, assigns it. */
  const upsertOrg = async (
    o: (typeof SEED_ORGS)[keyof typeof SEED_ORGS],
    assignment: { auditEntityId: Types.ObjectId; coordinatorId: Types.ObjectId; auditorId: Types.ObjectId | null },
  ) => {
    const org = (await Organization.findOne({ name: o.name })) ?? (await Organization.create(o));
    if (!org.auditEntityId) {
      org.set({ ...assignment, assignmentHistory: [{ ...assignment, at: new Date(), by: null }] });
      await org.save();
    }
    return org;
  };

  await upsertUser(SEED_USERS.superBumii, 'SUPERADMIN_BUMII', null);
  await upsertUser(SEED_USERS.superFundacion, 'SUPERADMIN_FUNDACION', null);
  for (const e of SEED_ENTITY_CATALOG) await upsertEntity(e);
  const andes = await upsertEntity(SEED_ENTITIES.CO);
  const iberica = await upsertEntity(SEED_ENTITIES.ES);
  const coordCO = await upsertUser(SEED_USERS.coordinatorCO, 'COORDINATOR', andes._id);
  const coordES = await upsertUser(SEED_USERS.coordinatorES, 'COORDINATOR', iberica._id);
  const auditorCO = await upsertUser(SEED_USERS.auditorMulti, 'AUDITOR', andes._id);
  const auditorMultiES = await upsertUser(SEED_USERS.auditorMulti, 'AUDITOR', iberica._id);
  const auditorES = await upsertUser(SEED_USERS.auditorES, 'AUDITOR', iberica._id);
  await upsertOrg(SEED_ORGS.CO, { auditEntityId: andes._id, coordinatorId: coordCO._id, auditorId: auditorCO._id });
  await upsertOrg(SEED_ORGS.ES, { auditEntityId: iberica._id, coordinatorId: coordES._id, auditorId: auditorMultiES._id });
  await upsertOrg(SEED_ORGS.CO2, { auditEntityId: andes._id, coordinatorId: coordCO._id, auditorId: null });
  await upsertOrg(SEED_ORGS.ES2, { auditEntityId: iberica._id, coordinatorId: coordES._id, auditorId: auditorES._id });
}

/**
 * Existing databases: if the latest published M1 questionnaire lacks languages (e.g. pt, fr) or questions
 * (e.g. P11–P15 Bienestar, change group 3) present in the seed file, publish a NEW version with them merged by
 * question/option code; new languages are pending approval. Published versions are never edited; campaigns
 * keep their own snapshot.
 */
async function syncQuestionnaireWithSeed(log: (m: string) => void): Promise<void> {
  const latest = await Questionnaire.findOne({ module: 'M1', status: 'published' }).sort({ version: -1 }).lean();
  if (!latest) return;
  const present = new Set((latest.languages as QuestionnaireLanguage[]).map((l) => l.lang));
  const missing = (questionnaire.languages as QuestionnaireLanguage[]).map((l) => l.lang).filter((l) => !present.has(l));
  const presentCodes = new Set((latest.questions as Question[]).map((q) => q.code));
  const newQuestions = (questionnaire.questions as Question[]).filter((q) => !presentCodes.has(q.code));
  if (missing.length === 0 && newQuestions.length === 0) return;
  const what = [missing.length ? `languages ${missing.join(', ')}` : '', newQuestions.length ? `questions ${newQuestions.map((q) => q.code).join(', ')}` : ''].filter(Boolean).join(' and ');
  if (await Questionnaire.exists({ module: 'M1', status: 'draft' })) {
    log(`questionnaire: ${what} not added (a draft exists)`);
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
  questions.push(...structuredClone(newQuestions));
  questions.sort((a, b) => a.order - b.order);
  const version = latest.version + 1;
  await Questionnaire.create({
    module: 'M1',
    version,
    title: latest.title,
    status: 'published',
    publishedAt: new Date(),
    notes: `Copia de la versión ${latest.version} con ${[missing.length ? `idiomas añadidos: ${missing.join(', ')}` : '', newQuestions.length ? `preguntas añadidas: ${newQuestions.map((q) => q.code).join(', ')}` : ''].filter(Boolean).join('; ')}`,
    languages: [...(latest.languages as QuestionnaireLanguage[]), ...missing.map((lang: Language) => ({ lang, status: 'pending_approval' }))],
    questions,
  });
  log(`questionnaire M1 v${version} published with ${what}`);
}
