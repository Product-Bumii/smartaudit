import { Router, type Request } from 'express';
import type { Model } from 'mongoose';
import {
  can,
  languageSchema,
  missingTranslations,
  MODULES,
  objectIdSchema,
  questionnaireDraftUpdateSchema,
  samplingTableInputSchema,
  settingsUpdateSchema,
  validateQuestionnaire,
  validateSamplingTable,
  type Language,
  type Question,
  type SamplingBracket,
} from '@smartaudit/shared';
import { z } from 'zod';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors';
import { requireAction } from '../middleware/auth';
import { getSettings, Questionnaire, SamplingTable, Settings } from '../models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyModel = Model<any>;

async function nextVersion(model: AnyModel, filter: Record<string, unknown>): Promise<number> {
  const last = await model.findOne(filter).sort({ version: -1 }).select({ version: 1 }).lean<{ version: number }>();
  return (last?.version ?? 0) + 1;
}

async function findById(model: AnyModel, id: string) {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const doc = await model.findById(parsed.data);
  if (!doc) throw notFound();
  return doc;
}

const assertDraft = (doc: { status: string }) => {
  if (doc.status !== 'draft') throw conflict('PUBLISHED_VERSION_IS_IMMUTABLE');
};

const cfgAudit = (req: Request, action: string, resourceType: string, doc: { _id: unknown; version?: number }, meta = {}) =>
  audit(req, { action, resourceType, resourceId: String(doc._id), organizationId: null, meta: { version: doc.version, ...meta } });

/** Text content of one language, to detect translation changes between saves. */
const languageFingerprint = (questions: Question[], lang: Language) =>
  JSON.stringify(
    questions.map((q) => [q.text?.[lang], q.help?.[lang], q.options.map((o) => [o.label?.[lang], o.freeText?.label?.[lang]])]),
  );

export function configRouter(_ctx: AppContext): Router {
  const r = Router();
  r.use(requireAction('config.manage'));

  // ---------------- Sampling tables
  r.get('/sampling-tables', async (_req, res) => {
    res.json({ items: await SamplingTable.find().sort({ version: -1 }).lean() });
  });
  r.get('/sampling-tables/:id', async (req, res) => {
    res.json({ item: await findById(SamplingTable, String(req.params.id)) });
  });
  r.post('/sampling-tables', async (req, res) => {
    const input = samplingTableInputSchema.parse(req.body);
    if (await SamplingTable.exists({ status: 'draft' })) throw conflict('DRAFT_ALREADY_EXISTS');
    const doc = await SamplingTable.create({ ...input, version: await nextVersion(SamplingTable, {}), createdBy: req.user!.id });
    await cfgAudit(req, 'config.samplingTable.create', 'samplingTable', doc);
    res.status(201).json({ item: doc, issues: validateSamplingTable(input.brackets as SamplingBracket[]) });
  });
  r.put('/sampling-tables/:id', async (req, res) => {
    const doc = await findById(SamplingTable, String(req.params.id));
    assertDraft(doc);
    const input = samplingTableInputSchema.parse(req.body);
    doc.set(input);
    await doc.save();
    await cfgAudit(req, 'config.samplingTable.update', 'samplingTable', doc);
    res.json({ item: doc, issues: validateSamplingTable(input.brackets as SamplingBracket[]) });
  });
  r.post('/sampling-tables/:id/publish', async (req, res) => {
    const doc = await findById(SamplingTable, String(req.params.id));
    assertDraft(doc);
    const issues = validateSamplingTable(doc.toObject().brackets as SamplingBracket[]);
    if (issues.length) throw unprocessable('INVALID_SAMPLING_TABLE', { issues });
    doc.set({ status: 'published', publishedAt: new Date(), publishedBy: req.user!.id });
    await doc.save();
    await cfgAudit(req, 'config.samplingTable.publish', 'samplingTable', doc);
    res.json({ item: doc });
  });
  r.delete('/sampling-tables/:id', async (req, res) => {
    const doc = await findById(SamplingTable, String(req.params.id));
    assertDraft(doc);
    await doc.deleteOne();
    await cfgAudit(req, 'config.samplingTable.delete', 'samplingTable', doc);
    res.status(204).end();
  });

  // ---------------- Questionnaires
  r.get('/questionnaires', async (req, res) => {
    const module = z.enum(MODULES).default('M1').parse(req.query.module ?? undefined);
    const items = await Questionnaire.find({ module }).sort({ version: -1 }).select({ questions: 0 }).lean();
    res.json({ items });
  });
  r.get('/questionnaires/:id', async (req, res) => {
    res.json({ item: await findById(Questionnaire, String(req.params.id)) });
  });
  r.post('/questionnaires/:id/new-version', async (req, res) => {
    const source = await findById(Questionnaire, String(req.params.id));
    if (await Questionnaire.exists({ module: source.module, status: 'draft' })) throw conflict('DRAFT_ALREADY_EXISTS');
    const doc = await Questionnaire.create({
      module: source.module,
      title: source.title,
      version: await nextVersion(Questionnaire, { module: source.module }),
      languages: source.toObject().languages,
      questions: source.toObject().questions,
      createdBy: req.user!.id,
      notes: `Copia de la versión ${source.version}`,
    });
    await cfgAudit(req, 'config.questionnaire.create', 'questionnaire', doc, { from: source.version });
    res.status(201).json({ item: doc });
  });
  r.put('/questionnaires/:id', async (req, res) => {
    const doc = await findById(Questionnaire, String(req.params.id));
    assertDraft(doc);
    const input = questionnaireDraftUpdateSchema.parse(req.body);
    const questions = input.questions as Question[];
    const issues = validateQuestionnaire(questions);
    if (issues.length) throw unprocessable('INVALID_QUESTIONNAIRE', { issues });
    const before = doc.toObject().questions as Question[];
    // Any language whose texts changed needs a new approval.
    const languages = doc.toObject().languages.map((l: { lang: Language; status: string }) =>
      languageFingerprint(before, l.lang) === languageFingerprint(questions, l.lang)
        ? l
        : { lang: l.lang, status: 'pending_approval', approvedAt: null, approvedBy: null },
    );
    doc.set({ questions, languages, ...(input.title !== undefined ? { title: input.title } : {}) });
    doc.markModified('questions');
    await doc.save();
    await cfgAudit(req, 'config.questionnaire.update', 'questionnaire', doc);
    res.json({ item: doc });
  });
  r.post('/questionnaires/:id/languages/:lang/approve', async (req, res) => {
    const doc = await findById(Questionnaire, String(req.params.id));
    const lang = languageSchema.parse(req.params.lang);
    const missing = missingTranslations(doc.toObject().questions as Question[], lang);
    if (missing.length) throw unprocessable('MISSING_TRANSLATIONS', { issues: missing });
    const languages = doc.toObject().languages as { lang: Language; status: string }[];
    const entry = { lang, status: 'approved', approvedAt: new Date(), approvedBy: req.user!.id };
    const next = languages.some((l) => l.lang === lang)
      ? languages.map((l) => (l.lang === lang ? entry : l))
      : [...languages, entry];
    doc.set({ languages: next });
    await doc.save();
    await cfgAudit(req, 'config.questionnaire.approveLanguage', 'questionnaire', doc, { lang });
    res.json({ item: doc });
  });
  r.post('/questionnaires/:id/publish', async (req, res) => {
    const doc = await findById(Questionnaire, String(req.params.id));
    assertDraft(doc);
    const questions = doc.toObject().questions as Question[];
    const issues = validateQuestionnaire(questions);
    if (issues.length) throw unprocessable('INVALID_QUESTIONNAIRE', { issues });
    const languages = doc.toObject().languages as { lang: Language; status: string }[];
    if (!languages.some((l) => l.status === 'approved')) throw unprocessable('NO_APPROVED_LANGUAGE');
    doc.set({ status: 'published', publishedAt: new Date(), publishedBy: req.user!.id });
    await doc.save();
    await cfgAudit(req, 'config.questionnaire.publish', 'questionnaire', doc);
    res.json({ item: doc });
  });
  r.delete('/questionnaires/:id', async (req, res) => {
    const doc = await findById(Questionnaire, String(req.params.id));
    assertDraft(doc);
    await doc.deleteOne();
    await cfgAudit(req, 'config.questionnaire.delete', 'questionnaire', doc);
    res.status(204).end();
  });

  // ---------------- Settings
  r.get('/settings', async (_req, res) => {
    res.json({ item: await getSettings() });
  });
  r.put('/settings', async (req, res) => {
    const input = settingsUpdateSchema.parse(req.body);
    const technical = ['confidenceThreshold', 'llmProvider', 'retention'] as const;
    if (technical.some((k) => input[k] !== undefined) && !can(req.user!.role, 'settings.technical')) throw forbidden();
    await getSettings();
    const item = await Settings.findOneAndUpdate({ key: 'global' }, { $set: { ...input, updatedBy: req.user!.id } }, { new: true });
    await audit(req, { action: 'settings.update', resourceType: 'settings', resourceId: 'global', organizationId: null, meta: { fields: Object.keys(input) } });
    res.json({ item });
  });

  return r;
}

