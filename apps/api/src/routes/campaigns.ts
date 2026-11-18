import { Router } from 'express';
import multer from 'multer';
import {
  AUDIT_TYPES,
  can,
  campaignCreateSchema,
  campaignM1InputSchema,
  canCreateCampaignFor,
  campaignStatusChangeSchema,
  canTransition,
  fileFormatQuerySchema,
  generateSlug,
  isCampaignEditable,
  objectIdSchema,
  sampleUploadQuerySchema,
  type CampaignAccess,
  type CampaignStatus,
  type QuestionnaireLanguage,
} from '@smartaudit/shared';
import { z } from 'zod';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { secureBytes } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../lib/errors';
import { requireAction, requireAuth, type AuthUser } from '../middleware/auth';
import { Campaign, getSettings, Organization, Questionnaire, type CampaignDoc, type OrganizationDoc } from '../models';
import { assignmentOf } from '../services/organizations';
import {
  accessFor,
  ANY_ACCESS,
  campaignListScope,
  computeCampaign,
  findCampaignForUser,
  MANAGE,
  MANAGE_OR_SUPERVISE,
  toCampaignDto,
} from '../services/campaigns';
import { accessCodesFile, MAX_SAMPLE_FILE_BYTES, sampleSummary, sampleTemplateFile, uploadSample } from '../services/sample';

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

  r.get('/', requireAction('campaign.view'), async (req, res) => {
    const user = req.user as AuthUser;
    const q = z.object({ organizationId: objectIdSchema.optional() }).parse(req.query);
    const filter: Record<string, unknown> = { module: 'M1', ...(await campaignListScope(user)) };
    if (q.organizationId) filter.organizationId = q.organizationId;
    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean<CampaignDoc[]>();
    const orgs = new Map(
      ((await Organization.find({ _id: { $in: campaigns.map((c) => c.organizationId) } }).lean()) as OrganizationDoc[]).map((o) => [String(o._id), o]),
    );
    const items = campaigns.flatMap((c) => {
      const org = orgs.get(String(c.organizationId));
      const access: CampaignAccess = org ? accessFor(user, c, org) : 'none';
      return access === 'none' ? [] : [{ ...toCampaignDto(c, access), organizationName: org!.name }];
    });
    res.json({ items });
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
      languages: ((questionnaire?.languages ?? []) as QuestionnaireLanguage[]).map((l) => ({ lang: l.lang, approved: l.status === 'approved' })),
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

  /** Manual transitions: suspend, cancel, resume. Automatic ones are done by the worker (Phase 2). */
  r.post('/:id/status', requireAuth, async (req, res) => {
    const user = req.user as AuthUser;
    const { to, reason } = campaignStatusChangeSchema.parse(req.body);
    if (!can(user.role, to === 'cancelada' ? 'campaign.cancel' : 'campaign.suspend')) throw forbidden();
    const { campaign, access } = await findCampaignForUser(user, String(req.params.id), MANAGE_OR_SUPERVISE);
    const from = campaign.status as CampaignStatus;
    const previous = (campaign.previousStatus ?? null) as CampaignStatus | null;
    const isManual = to === 'suspendida' || to === 'cancelada' || (from === 'suspendida' && to === previous);
    if (!isManual || !canTransition(from, to, previous)) throw conflict('TRANSITION_NOT_ALLOWED', { from, to });
    campaign.set({
      status: to,
      previousStatus: to === 'suspendida' ? from : null,
      statusHistory: [...campaign.statusHistory, { from, to, at: ctx.now(), by: user.id, reason: reason ?? null }],
    });
    await campaign.save();
    await audit(req, { action: 'campaign.status', resourceType: 'campaign', resourceId: String(campaign._id), organizationId: String(campaign.organizationId), meta: { from, to } });
    res.json({ campaign: toCampaignDto(campaign.toObject(), access) });
  });

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

  return r;
}

