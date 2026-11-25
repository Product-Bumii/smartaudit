import {
  canTransition,
  campaignAccess,
  maximumReached,
  deriveM1Campaign,
  isSuperadmin,
  objectIdSchema,
  type CampaignAccess,
  offeredLanguages,
  type CampaignDto,
  type CampaignM1Input,
  type CampaignStatus,
  type Language,
  type M1Derivation,
  type Question,
  type QuestionnaireLanguage,
  type SamplingBracket,
} from '@smartaudit/shared';
import { Types } from 'mongoose';
import type { AppContext } from '../context';
import { forbidden, notFound, unprocessable } from '../lib/errors';
import type { AuthUser } from '../middleware/auth';
import { assignmentOf } from './organizations';
import {
  Campaign,
  getSettings,
  Organization,
  Questionnaire,
  Respondent,
  SamplingTable,
  type CampaignDoc,
  type OrganizationDoc,
} from '../models';

/** Current published configuration a new or editable campaign is computed with. */
export async function currentConfiguration() {
  const [table, questionnaire] = await Promise.all([
    SamplingTable.findOne({ status: 'published' }).sort({ version: -1 }).lean(),
    Questionnaire.findOne({ module: 'M1', status: 'published' }).sort({ version: -1 }).lean(),
  ]);
  if (!table) throw unprocessable('NO_PUBLISHED_SAMPLING_TABLE');
  if (!questionnaire) throw unprocessable('NO_PUBLISHED_QUESTIONNAIRE');
  return { table, questionnaire };
}

export interface CampaignProblems {
  code: string;
  details?: unknown;
}

export interface ComputedCampaign {
  derivation: M1Derivation;
  problems: CampaignProblems[];
  offered: Language[];
  set: Record<string, unknown>;
}

/** Validates the input against current configuration and computes every derived field. */
export async function computeCampaign(
  ctx: AppContext,
  org: OrganizationDoc,
  leadAuditorId: string,
  input: CampaignM1Input,
): Promise<ComputedCampaign> {
  const settings = await getSettings();
  const conf = await currentConfiguration();
  const problems: CampaignProblems[] = [];

  if (!settings.norms.includes(input.norm)) problems.push({ code: 'INVALID_NORM', details: { allowed: settings.norms } });

  const questions = conf.questionnaire.questions as Question[];
  const qLanguages = conf.questionnaire.languages as QuestionnaireLanguage[];
  const offered = offeredLanguages(qLanguages, input.languages);
  if (offered.length === 0) problems.push({ code: 'NO_APPROVED_LANGUAGE_SELECTED' });

  const derivation = deriveM1Campaign({
    scopeSize: input.scopeSize,
    auditorMinimum: input.auditorMinimum ?? null,
    maxCompleted: input.maxCompleted ?? null,
    interviewStartDate: input.interviewStartDate,
    timeZone: org.timeZone,
    brackets: conf.table.brackets as SamplingBracket[],
    questions,
    auditType: input.auditType,
    excellence: input.excellence,
    wellbeing: input.wellbeing,
    norm: input.norm,
    now: ctx.now(),
  });
  if (!derivation.minimum.ok) problems.push({ code: derivation.minimum.error });
  else if (derivation.minimum.minimum === null) {
    problems.push({ code: 'AUDITOR_MINIMUM_REQUIRED', details: { min: derivation.minimum.bracket.required, max: derivation.minimum.bracket.rangeMax } });
  }
  if (derivation.windowError) problems.push({ code: 'INVALID_START_DATE', details: { reason: derivation.windowError } });
  const max = derivation.maximum;
  if (max && !max.ok) problems.push({ code: max.error, details: { minimum: m0(derivation), scopeSize: input.scopeSize } });

  const m = derivation.minimum;
  const set = {
    reference: input.reference || null,
    m1Config: {
      norm: input.norm,
      auditType: input.auditType,
      excellence: input.excellence,
      wellbeing: input.wellbeing,
      leadAuditorId,
      efrManagerName: input.efrManagerName ?? null,
      interviewStartDate: input.interviewStartDate,
      scopeSize: input.scopeSize,
      auditorMinimum: m.ok && m.auditorChosen ? input.auditorMinimum : null,
      maxCompleted: max?.ok && max.auditorChosen ? max.maximum : null,
      languages: input.languages,
    },
    sampling: m.ok
      ? {
          tableId: conf.table._id,
          tableVersion: conf.table.version,
          scopeSize: input.scopeSize,
          bracketIndex: m.bracketIndex,
          bracket: m.bracket,
          minimum: m.minimum,
          maximum: max?.ok ? max.maximum : null,
          requiresAuditorChoice: m.requiresAuditorChoice,
          auditorChosen: m.auditorChosen,
        }
      : null,
    samplingTableSnapshot: conf.table.brackets,
    questionnaireSnapshot: { questionnaireId: conf.questionnaire._id, version: conf.questionnaire.version, languages: qLanguages, questions },
    offeredLanguages: offered,
    activatedQuestions: derivation.questions,
    window: derivation.window ? { ...derivation.window, extensions: [] } : null,
  };
  return { derivation, problems, offered, set };
}

const m0 = (d: M1Derivation) => (d.minimum.ok ? d.minimum.minimum : null);

/**
 * Closes a running campaign (`en_curso` → `finalizada`) once its completed interviews reach the maximum
 * (decision 65). Returns whether it was closed. Called whenever an interview is completed.
 * TODO(Fase 2): call it from the interview engine when an interview reaches `completedAt`.
 */
export async function closeIfMaximumReached(ctx: AppContext, campaignId: string): Promise<boolean> {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || !canTransition(campaign.status as CampaignStatus, 'finalizada')) return false;
  const completed = await Respondent.countDocuments({ campaignId: campaign._id, status: 'completed' });
  if (!maximumReached(completed, campaign.sampling?.maximum)) return false;
  const from = campaign.status as CampaignStatus;
  const updated = await Campaign.updateOne(
    { _id: campaign._id, status: from },
    {
      $set: { status: 'finalizada' },
      $push: { statusHistory: { from, to: 'finalizada', at: ctx.now(), by: null, reason: 'maximum_reached' } },
    },
  );
  return updated.modifiedCount === 1;
}

/**
 * Mongo filter for the campaign list (find and aggregate): superadmins see all; coordinators and auditors only campaigns of
 * their audit entity where they are the lead auditor or (coordinators) of the organizations they coordinate.
 * The precise access level of each campaign comes from the shared `campaignAccess`.
 */
export async function campaignListScope(user: AuthUser): Promise<Record<string, unknown>> {
  if (isSuperadmin(user.role)) return {};
  // ObjectIds (not strings): the filter is also used in aggregations, which do not cast.
  const or: Record<string, unknown>[] = [{ 'm1Config.leadAuditorId': new Types.ObjectId(user.id) }];
  if (user.role === 'COORDINATOR') {
    const orgIds = await Organization.find({ auditEntityId: user.auditEntityId, coordinatorId: user.id }).distinct('_id');
    or.push({ organizationId: { $in: orgIds } });
  }
  return { auditEntityId: new Types.ObjectId(user.auditEntityId!), $or: or };
}

export const accessFor = (user: AuthUser, campaign: CampaignDoc, org: OrganizationDoc): CampaignAccess =>
  campaignAccess(
    { id: user.id, role: user.role, auditEntityId: user.auditEntityId },
    { auditEntityId: String(campaign.auditEntityId), leadAuditorId: String(campaign.m1Config!.leadAuditorId) },
    assignmentOf(org),
  );

/**
 * Loads a campaign the user may act on with one of the `allowed` access levels.
 * No access at all → 404 (existence not disclosed); visible but not enough → 403.
 */
export async function findCampaignForUser(user: AuthUser, id: string, allowed: readonly CampaignAccess[]) {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const campaign = await Campaign.findById(parsed.data);
  if (!campaign) throw notFound();
  const org = (await Organization.findById(campaign.organizationId).lean()) as OrganizationDoc | null;
  if (!org) throw notFound();
  const access = accessFor(user, campaign.toObject() as CampaignDoc, org);
  if (access === 'none') throw notFound();
  if (!allowed.includes(access)) throw forbidden();
  return { campaign, org, access };
}

export const MANAGE: readonly CampaignAccess[] = ['manage'];
export const ANY_ACCESS: readonly CampaignAccess[] = ['manage', 'supervise', 'aggregate'];

export async function findOrganization(id: unknown) {
  const org = await Organization.findById(id).lean();
  if (!org) throw notFound();
  return org as OrganizationDoc;
}

export function toCampaignDto(raw: object, access: CampaignAccess): CampaignDto {
  const c = raw as CampaignDoc;
  const m1 = c.m1Config!;
  const s = c.sampling;
  return {
    id: String(c._id),
    module: 'M1',
    organizationId: String(c.organizationId),
    auditEntityId: String(c.auditEntityId),
    access,
    slug: c.slug,
    reference: c.reference ?? null,
    status: c.status as CampaignStatus,
    m1Config: {
      norm: m1.norm,
      auditType: m1.auditType as CampaignDto['m1Config']['auditType'],
      excellence: m1.excellence,
      wellbeing: m1.wellbeing ?? false,
      leadAuditorId: String(m1.leadAuditorId),
      efrManagerName: m1.efrManagerName ?? null,
      interviewStartDate: m1.interviewStartDate,
      scopeSize: m1.scopeSize,
      auditorMinimum: m1.auditorMinimum ?? null,
      maxCompleted: m1.maxCompleted ?? null,
      languages: m1.languages as Language[],
    },
    sampling:
      s && s.tableVersion != null
        ? {
            tableVersion: s.tableVersion,
            scopeSize: s.scopeSize as number,
            bracket: { min: s.bracket?.min as number, max: s.bracket?.max ?? null },
            minimum: s.minimum ?? null,
            maximum: s.maximum ?? null,
            requiresAuditorChoice: Boolean(s.requiresAuditorChoice),
            auditorChosen: Boolean(s.auditorChosen),
          }
        : null,
    window: c.window?.openDate
      ? {
          timeZone: c.window.timeZone as string,
          businessDays: c.window.businessDays ?? [],
          openDate: c.window.openDate,
          closeDate: c.window.closeDate as string,
          opensAt: new Date(c.window.opensAt as Date).toISOString(),
          closesAt: new Date(c.window.closesAt as Date).toISOString(),
          reminders: (c.window.reminders ?? []) as NonNullable<CampaignDto['window']>['reminders'],
          extensions: ((c.window.extensions ?? []) as { from: string; to: string; at: Date | string; reason?: string | null }[]).map((e) => ({
            from: e.from,
            to: e.to,
            at: new Date(e.at).toISOString(),
            reason: e.reason ?? null,
          })),
        }
      : null,
    questionnaire: c.questionnaireSnapshot?.version
      ? { version: c.questionnaireSnapshot.version, offeredLanguages: (c.offeredLanguages ?? []) as Language[] }
      : null,
    activatedQuestions: (c.activatedQuestions ?? []) as CampaignDto['activatedQuestions'],
    sampleSize: c.sampleSize,
    statusHistory: (c.statusHistory ?? []).map((h) => ({
      from: (h.from ?? null) as CampaignStatus | null,
      to: h.to as CampaignStatus,
      at: new Date(h.at).toISOString(),
      reason: h.reason ?? null,
    })),
  };
}
