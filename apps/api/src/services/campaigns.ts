import {
  deriveM1Campaign,
  isSuperadmin,
  objectIdSchema,
  offeredLanguages,
  officialHolidays,
  type CampaignDto,
  type CampaignM1Input,
  type CampaignStatus,
  type Language,
  type M1Derivation,
  type Question,
  type QuestionnaireLanguage,
  type SamplingBracket,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { notFound, unprocessable } from '../lib/errors';
import type { AuthUser } from '../middleware/auth';
import {
  Campaign,
  getSettings,
  HolidayCalendar,
  Organization,
  Questionnaire,
  SamplingTable,
  type CampaignDoc,
  type OrganizationDoc,
} from '../models';

/** Current published configuration a new or editable campaign is computed with. */
export async function currentConfiguration(country: string, visitDate: string) {
  const [table, questionnaire] = await Promise.all([
    SamplingTable.findOne({ status: 'published' }).sort({ version: -1 }).lean(),
    Questionnaire.findOne({ module: 'M1', status: 'published' }).sort({ version: -1 }).lean(),
  ]);
  if (!table) throw unprocessable('NO_PUBLISHED_SAMPLING_TABLE');
  if (!questionnaire) throw unprocessable('NO_PUBLISHED_QUESTIONNAIRE');

  // The window (10 business days) can start in the previous year.
  const visitYear = Number(visitDate.slice(0, 4)) || new Date().getUTCFullYear();
  const calendars: { year: number; version: number | null; source: string }[] = [];
  const dates: string[] = [];
  for (const year of [visitYear - 1, visitYear]) {
    const cal = await HolidayCalendar.findOne({ country, year, status: 'published' }).sort({ version: -1 }).lean();
    if (cal) {
      calendars.push({ year, version: cal.version, source: 'holidayCalendars' });
      dates.push(...cal.dates);
    } else {
      // DECISIÓN POR DEFECTO: without a published calendar, fall back to the official list.
      calendars.push({ year, version: null, source: 'date-holidays-fallback' });
      dates.push(...officialHolidays(country, year));
    }
  }
  return { table, questionnaire, holidays: { country, calendars, dates } };
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
  const conf = await currentConfiguration(org.country, input.visitDate);
  const problems: CampaignProblems[] = [];

  if (!settings.norms.includes(input.norm)) problems.push({ code: 'INVALID_NORM', details: { allowed: settings.norms } });

  const questions = conf.questionnaire.questions as Question[];
  const qLanguages = conf.questionnaire.languages as QuestionnaireLanguage[];
  const offered = offeredLanguages(qLanguages, input.languages);
  if (offered.length === 0) problems.push({ code: 'NO_APPROVED_LANGUAGE_SELECTED' });

  const derivation = deriveM1Campaign({
    scopeSize: input.scopeSize,
    auditorMinimum: input.auditorMinimum ?? null,
    visitDate: input.visitDate,
    timeZone: org.timeZone,
    holidays: new Set(conf.holidays.dates),
    brackets: conf.table.brackets as SamplingBracket[],
    questions,
    auditType: input.auditType,
    excellence: input.excellence,
    norm: input.norm,
    now: ctx.now(),
  });
  if (!derivation.minimum.ok) problems.push({ code: derivation.minimum.error });
  else if (derivation.minimum.minimum === null) {
    problems.push({ code: 'AUDITOR_MINIMUM_REQUIRED', details: { min: derivation.minimum.bracket.required, max: derivation.minimum.bracket.rangeMax } });
  }
  if (derivation.windowError) problems.push({ code: 'INVALID_VISIT_DATE', details: { reason: derivation.windowError } });

  const m = derivation.minimum;
  const set = {
    reference: input.reference || null,
    m1Config: {
      norm: input.norm,
      auditType: input.auditType,
      excellence: input.excellence,
      leadAuditorId,
      efrManagerName: input.efrManagerName ?? null,
      visitDate: input.visitDate,
      scopeSize: input.scopeSize,
      auditorMinimum: m.ok && m.auditorChosen ? input.auditorMinimum : null,
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
          requiresAuditorChoice: m.requiresAuditorChoice,
          auditorChosen: m.auditorChosen,
        }
      : null,
    samplingTableSnapshot: conf.table.brackets,
    questionnaireSnapshot: { questionnaireId: conf.questionnaire._id, version: conf.questionnaire.version, languages: qLanguages, questions },
    offeredLanguages: offered,
    activatedQuestions: derivation.questions,
    holidaySnapshot: conf.holidays,
    window: derivation.window ? { ...derivation.window, extensions: [] } : null,
  };
  return { derivation, problems, offered, set };
}

/** Mongo filter restricting campaigns to what the user may see. */
export function campaignScope(user: AuthUser): Record<string, unknown> {
  if (isSuperadmin(user.role)) return {};
  return {
    organizationId: user.organizationId,
    'm1Config.leadAuditorId': user.id,
  };
}

export async function findCampaignForUser(user: AuthUser, id: string) {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const campaign = await Campaign.findOne({ _id: parsed.data, ...campaignScope(user) });
  if (!campaign) throw notFound();
  return campaign;
}

export async function findOrganization(id: unknown) {
  const org = await Organization.findById(id).lean();
  if (!org) throw notFound();
  return org;
}

export function toCampaignDto(raw: object): CampaignDto {
  const c = raw as CampaignDoc;
  const m1 = c.m1Config!;
  const s = c.sampling;
  return {
    id: String(c._id),
    module: 'M1',
    organizationId: String(c.organizationId),
    slug: c.slug,
    reference: c.reference ?? null,
    status: c.status as CampaignStatus,
    m1Config: {
      norm: m1.norm,
      auditType: m1.auditType as CampaignDto['m1Config']['auditType'],
      excellence: m1.excellence,
      leadAuditorId: String(m1.leadAuditorId),
      efrManagerName: m1.efrManagerName ?? null,
      visitDate: m1.visitDate,
      scopeSize: m1.scopeSize,
      auditorMinimum: m1.auditorMinimum ?? null,
      languages: m1.languages as Language[],
    },
    sampling:
      s && s.tableVersion != null
        ? {
            tableVersion: s.tableVersion,
            scopeSize: s.scopeSize as number,
            bracket: { min: s.bracket?.min as number, max: s.bracket?.max ?? null },
            minimum: s.minimum ?? null,
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
