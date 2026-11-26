import { Router } from 'express';
import { Types } from 'mongoose';
import multer from 'multer';
import {
  AUDIT_TYPES,
  can,
  campaignCreateSchema,
  campaignListQuerySchema,
  campaignProgress,
  extendWindow,
  windowExtensionSchema,
  type CampaignProgressDto,
  type ProgressPersonRow,
  type RespondentStatus,
  campaignM1InputSchema,
  CLOSED_CAMPAIGN_STATUSES,
  isAvailableLanguage,
  searchPattern,
  canCreateCampaignFor,
  fileFormatQuerySchema,
  generateSlug,
  isCampaignEditable,
  sampleUploadQuerySchema,
  type CampaignAccess,
  type CampaignStatus,
  type QuestionnaireLanguage,
  answerReviewSchema,
  objectIdSchema,
  reviewInputError,
  reviewListQuerySchema,
  type Question,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { secureBytes } from '../lib/crypto';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors';
import { requireAction, type AuthUser } from '../middleware/auth';
import { Campaign, getSettings, Organization, ParticipantContact, Questionnaire, Respondent, type CampaignDoc, type OrganizationDoc } from '../models';
import { assignmentOf } from '../services/organizations';
import {
  accessFor,
  ANY_ACCESS,
  campaignListScope,
  computeCampaign,
  findCampaignForUser,
  MANAGE,
  toCampaignDto,
} from '../services/campaigns';
import { campaignResults, individualResponses, openComments, reviewAnswer, reviewQueue } from '../services/results';
import { accessCodesFile, MAX_SAMPLE_FILE_BYTES, sampleSummary, sampleTemplateFile, uploadSample } from '../services/sample';

/** Results, review and individual answers: lead auditor and superadmins. */
const RESULTS_ACCESS: readonly CampaignAccess[] = ['manage', 'supervise'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SAMPLE_FILE_BYTES, files: 1 } });

const sendFile = (res: import('express').Response, f: { body: Buffer; contentType: string; filename: string }) => {
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(f.body);
};

/** The organization of a new campaign must be assigned to the requesting auditor (404 otherwise). */
async function organizationForNewCampaign(user: AuthUser, organizationId: string): Promise<OrganizationDoc> {
  const org = (await Organization.findById(organizationId).lean()) as OrganizationDoc | null;
  if (!org) throw notFound();
  const ok = canCreateCampaignFor({ id: user.id, role: user.role, auditEntityId: user.auditEntityId }, { ...assignmentOf(org), status: org.status as 'active' });
  if (!ok) throw notFound();
  return org;
}

export function campaignsRouter(ctx: AppContext): Router {
  const r = Router();

  /** Paged list with free search (reference or organization), status filter and sorting. */
  r.get('/', requireAction('campaign.view'), async (req, res) => {
    const user = req.user as AuthUser;
    const q = campaignListQuerySchema.parse(req.query);
    const match: Record<string, unknown> = { module: 'M1', ...(await campaignListScope(user)) };
    if (q.organizationId) match.organizationId = new Types.ObjectId(q.organizationId);
    if (q.status === 'open') match.status = { $nin: [...CLOSED_CAMPAIGN_STATUSES] };
    else if (q.status === 'closed') match.status = { $in: [...CLOSED_CAMPAIGN_STATUSES] };
    else if (q.status) match.status = q.status;
    const pattern = searchPattern(q.q);
    const sortField = { createdAt: 'createdAt', reference: 'reference', organization: 'organizationName', interviewStartDate: 'm1Config.interviewStartDate', status: 'status' }[q.sort];
    const dir = (q.dir ?? (q.sort === 'createdAt' ? 'desc' : 'asc')) === 'asc' ? 1 : -1;

    const [result] = await Campaign.aggregate<{ items: CampaignDoc[]; total: { n: number }[] }>(
      [
        { $match: match },
        { $lookup: { from: 'organizations', localField: 'organizationId', foreignField: '_id', as: 'org', pipeline: [{ $project: { name: 1 } }] } },
        { $set: { organizationName: { $first: '$org.name' } } },
        { $project: { org: 0 } },
        ...(pattern ? [{ $match: { $or: [{ reference: { $regex: pattern, $options: 'i' } }, { organizationName: { $regex: pattern, $options: 'i' } }] } }] : []),
        {
          $facet: {
            items: [{ $sort: { [sortField]: dir, _id: dir } }, { $skip: (q.page - 1) * q.pageSize }, { $limit: q.pageSize }],
            total: [{ $count: 'n' }],
          },
        },
      ],
      { collation: { locale: 'es', strength: 1 } },
    );
    const campaigns = result.items;
    const orgs = new Map(
      ((await Organization.find({ _id: { $in: campaigns.map((c) => c.organizationId) } }).lean()) as OrganizationDoc[]).map((o) => [String(o._id), o]),
    );
    const items = campaigns.flatMap((c) => {
      const org = orgs.get(String(c.organizationId));
      const access: CampaignAccess = org ? accessFor(user, c, org) : 'none';
      return access === 'none' ? [] : [{ ...toCampaignDto(c, access), organizationName: org!.name }];
    });
    res.json({ items, total: result.total[0]?.n ?? 0, page: q.page, pageSize: q.pageSize });
  });

  /** Form options for the auditor: organizations assigned to them, norms, audit types, languages. */
  r.get('/options', requireAction('campaign.create'), async (req, res) => {
    const user = req.user as AuthUser;
    const [settings, questionnaire, orgs] = await Promise.all([
      getSettings(),
      Questionnaire.findOne({ module: 'M1', status: 'published' }).sort({ version: -1 }).select({ languages: 1, version: 1 }).lean(),
      Organization.find({ auditEntityId: user.auditEntityId, auditorId: user.id, status: 'active' }).sort({ name: 1 }).lean(),
    ]);
    res.json({
      organizations: orgs.map((o) => ({ id: String(o._id), name: o.name, timeZone: o.timeZone, country: o.country })),
      norms: settings.norms,
      auditTypes: AUDIT_TYPES,
      languages: ((questionnaire?.languages ?? []) as QuestionnaireLanguage[])
        .filter((l) => isAvailableLanguage(l.lang))
        .map((l) => ({ lang: l.lang, approved: l.status === 'approved' })),
    });
  });

  r.get('/sample-template', requireAction('sample.manage'), async (req, res) => {
    const { format } = fileFormatQuerySchema.parse(req.query);
    sendFile(res, await sampleTemplateFile(format));
  });

  /** Live preview of the derived values while filling in the form (no persistence). */
  r.post('/preview', requireAction('campaign.create'), async (req, res) => {
    const user = req.user as AuthUser;
    const input = campaignCreateSchema.parse(req.body);
    const org = await organizationForNewCampaign(user, input.organizationId);
    const c = await computeCampaign(ctx, org, user.id, input);
    res.json({
      minimum: c.derivation.minimum,
      maximum: c.derivation.maximum,
      window: c.derivation.window,
      windowWarnings: c.derivation.windowWarnings,
      questions: c.derivation.questions,
      offeredLanguages: c.offered,
      problems: c.problems,
    });
  });

  r.post('/', requireAction('campaign.create'), async (req, res) => {
    const user = req.user as AuthUser;
    const input = campaignCreateSchema.parse(req.body);
    const org = await organizationForNewCampaign(user, input.organizationId);
    const c = await computeCampaign(ctx, org, user.id, input);
    if (c.problems.length) throw unprocessable('INVALID_CAMPAIGN', { problems: c.problems });
    const now = ctx.now();
    const campaign = await Campaign.create({
      module: 'M1',
      organizationId: org._id,
      auditEntityId: user.auditEntityId,
      slug: generateSlug(secureBytes),
      createdBy: user.id,
      status: 'borrador',
      statusHistory: [{ from: null, to: 'borrador', at: now, by: user.id, reason: 'created' }],
      ...c.set,
    });
    await audit(req, { action: 'campaign.create', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(org._id), meta: { minimum: c.set.sampling ? (c.set.sampling as { minimum: number }).minimum : null } });
    res.status(201).json({ campaign: toCampaignDto(campaign.toObject(), 'manage'), windowWarnings: c.derivation.windowWarnings });
  });

  r.get('/:id', requireAction('campaign.view'), async (req, res) => {
    const { campaign, org, access } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), ANY_ACCESS);
    res.json({
      campaign: toCampaignDto(campaign.toObject(), access),
      organization: { id: String(org._id), name: org.name, timeZone: org.timeZone, country: org.country },
    });
  });

  r.put('/:id', requireAction('campaign.edit'), async (req, res) => {
    const user = req.user as AuthUser;
    const { campaign, org } = await findCampaignForUser(user, String(req.params.id), MANAGE);
    if (!isCampaignEditable(campaign.status as CampaignStatus)) throw conflict('CAMPAIGN_NOT_EDITABLE');
    const input = campaignM1InputSchema.parse(req.body);
    // Only the lead auditor manages the campaign; the organization never changes.
    const c = await computeCampaign(ctx, org, String(campaign.m1Config!.leadAuditorId), input);
    if (c.problems.length) throw unprocessable('INVALID_CAMPAIGN', { problems: c.problems });
    campaign.set(c.set);
    await campaign.save();
    await audit(req, { action: 'campaign.update', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(org._id) });
    res.json({ campaign: toCampaignDto(campaign.toObject(), 'manage'), windowWarnings: c.derivation.windowWarnings });
  });

  // No manual status changes (change group 3, decision 88): the audit is scheduled once the sample is loaded,
  // opens by itself on the start date and closes at the end of the window or at the maximum.

  // ---------------- Sample
  r.post('/:id/sample', requireAction('sample.manage'), upload.single('file'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), MANAGE);
    if (!req.file) throw badRequest('FILE_REQUIRED');
    const { mode } = sampleUploadQuerySchema.parse(req.query);
    const result = await uploadSample(ctx, req, campaign, req.file, mode);
    const fresh = await Campaign.findById(campaign._id).lean();
    res.json({ campaign: toCampaignDto(fresh!, 'manage'), ...result });
  });

  r.get('/:id/sample/summary', requireAction('sample.view'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), MANAGE);
    res.json(await sampleSummary(campaign));
  });

  r.get('/:id/access-codes', requireAction('sample.manage'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), MANAGE);
    const { format } = fileFormatQuerySchema.parse(req.query);
    sendFile(res, await accessCodesFile(ctx, req, campaign, format));
  });

  // ---------------- Launch, progress and window (Phase 2)

  /** Progress: aggregate for everyone with access; per person (file row and status) only for the auditor and superadmins. */
  r.get('/:id/progress', requireAction('progress.viewAggregate'), async (req, res) => {
    const user = req.user as AuthUser;
    const { campaign, access } = await findCampaignForUser(user, String(req.params.id), ANY_ACCESS);
    const respondents = await Respondent.find({ campaignId: campaign._id }, { status: 1, completedAt: 1 }).lean();
    const counts: Partial<Record<RespondentStatus, number>> = {};
    for (const r of respondents) counts[r.status as RespondentStatus] = (counts[r.status as RespondentStatus] ?? 0) + 1;
    const progress = campaignProgress({
      sampleSize: campaign.sampleSize,
      counts,
      minimum: campaign.sampling?.minimum ?? null,
      maximum: campaign.sampling?.maximum ?? null,
      opensAt: campaign.window?.opensAt ?? null,
      closesAt: campaign.window?.closesAt ?? null,
      now: ctx.now(),
    });
    let people: ProgressPersonRow[] | null = null;
    if (access !== 'aggregate' && can(user.role, 'respondent.viewStatus')) {
      const byId = new Map(respondents.map((r) => [String(r._id), r]));
      const contacts = await ParticipantContact.find({ campaignId: campaign._id }, { respondentId: 1, sourceRow: 1, noEmail: 1, sends: 1 }).sort({ sourceRow: 1 }).lean();
      people = contacts.map((c) => {
        const r = byId.get(String(c.respondentId));
        const invitation = c.sends.find((s) => s.kind === 'invitation');
        return {
          sourceRow: c.sourceRow,
          noEmail: c.noEmail,
          status: (r?.status ?? 'pending') as RespondentStatus,
          invitedAt: invitation?.at ? new Date(invitation.at).toISOString() : null,
          remindersSent: c.sends.filter((s) => s.kind?.startsWith('reminder')).length,
          completedAt: r?.completedAt ? new Date(r.completedAt).toISOString() : null,
        };
      });
    }
    res.json({ ...progress, people } satisfies CampaignProgressDto);
  });

  /** The auditor may extend the window (recorded in the campaign and the audit log). */
  r.post('/:id/window/extend', requireAction('campaign.edit'), async (req, res) => {
    const user = req.user as AuthUser;
    const { campaign } = await findCampaignForUser(user, String(req.params.id), MANAGE);
    if (!['envios_activos', 'en_curso'].includes(campaign.status)) throw conflict('CAMPAIGN_NOT_RUNNING');
    const { closeDate, reason } = windowExtensionSchema.parse(req.body);
    const w = campaign.window!;
    const result = extendWindow({ closeDate: w.closeDate as string, timeZone: w.timeZone as string }, closeDate);
    if (!result.ok) throw unprocessable(result.error);
    const extension = { from: w.closeDate, to: result.closeDate, at: ctx.now(), by: user.id, reason: reason ?? null };
    campaign.set({
      'window.closeDate': result.closeDate,
      'window.closesAt': new Date(result.closesAt),
      'window.businessDays': [...(w.businessDays ?? []), ...result.addedBusinessDays],
      'window.extensions': [...(w.extensions ?? []), extension],
    });
    await campaign.save();
    await audit(req, { action: 'campaign.window.extend', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(campaign.organizationId), meta: { from: extension.from, to: extension.to } });
    res.json({ campaign: toCampaignDto(campaign.toObject(), 'manage') });
  });

  // ---------------- Results, review and individual answers (cambios 4 · bloques 1 y 2)
  // Lead auditor and superadmins only (`manage`, `supervise`); the coordinator sees the aggregate progress (403).

  /** Results tables (section 5.6), calculated in code over the completed interviews. */
  r.get('/:id/results', requireAction('report.manage'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), RESULTS_ACCESS);
    res.json(await campaignResults(campaign.toObject() as CampaignDoc));
  });

  /** Answers sent to review: the conversation about that question and what the AI proposed. Individual data → logged. */
  r.get('/:id/review', requireAction('responses.review'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), RESULTS_ACCESS);
    const { state } = reviewListQuerySchema.parse(req.query);
    const list = await reviewQueue(campaign.toObject() as CampaignDoc, state);
    await audit(req, { action: 'responses.review.view', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(campaign.organizationId), meta: { state, items: list.items.length } });
    res.json(list);
  });

  /** The auditor's decision on one answer: option code(s), abstention or «sin respuesta válida». */
  r.put('/:id/review/:interviewId/:questionCode', requireAction('responses.review'), async (req, res) => {
    const user = req.user as AuthUser;
    const { campaign } = await findCampaignForUser(user, String(req.params.id), RESULTS_ACCESS);
    if (campaign.status === 'informe_generado') throw conflict('REPORT_ALREADY_GENERATED');
    const input = answerReviewSchema.parse(req.body);
    const interviewId = objectIdSchema.safeParse(req.params.interviewId);
    if (!interviewId.success) throw notFound();
    const question = ((campaign.questionnaireSnapshot?.questions ?? []) as Question[]).find((q) => q.code === req.params.questionCode);
    if (!question) throw notFound();
    const error = reviewInputError(question, input.decision, input.optionCodes);
    if (error) throw unprocessable(error);
    const outcome = await reviewAnswer(campaign.toObject() as CampaignDoc, interviewId.data, question.code, input, user.id, ctx.now());
    if (outcome === 'NOT_FOUND') throw notFound();
    if (outcome === 'NOT_REVIEWABLE') throw conflict('NOT_REVIEWABLE');
    await audit(req, {
      action: 'responses.review',
      resourceType: 'interview',
      resourceId: interviewId.data,
      organizationId: String(campaign.organizationId),
      meta: { campaignId: String(campaign._id), questionCode: question.code, decision: input.decision },
    });
    res.json(await reviewQueue(campaign.toObject() as CampaignDoc, 'pending').then((l) => ({ counts: l.counts })));
  });

  /** Individual answers with demographics (never identity). The page shows the confidentiality notice first. */
  r.get('/:id/responses', requireAction('responses.viewIndividual'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), RESULTS_ACCESS);
    const dto = await individualResponses(campaign.toObject() as CampaignDoc);
    await audit(req, { action: 'responses.view', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(campaign.organizationId), meta: { rows: dto.rows.length } });
    res.json(dto);
  });

  /** Open answers apart, without demographics (P14–P15 «texto libre disociado»; P10 too, decision 96). */
  r.get('/:id/comments', requireAction('responses.viewIndividual'), async (req, res) => {
    const { campaign } = await findCampaignForUser(req.user as AuthUser, String(req.params.id), RESULTS_ACCESS);
    const dto = await openComments(campaign.toObject() as CampaignDoc);
    await audit(req, { action: 'responses.comments.view', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(campaign.organizationId), meta: { comments: dto.questions.reduce((n, q) => n + q.comments.length, 0) } });
    res.json(dto);
  });

  return r;
}

