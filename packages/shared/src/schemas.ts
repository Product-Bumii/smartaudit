/**
 * Zod schemas for API input validation. Shared by the API (server-side validation) and usable
 * by the web client for typing.
 */
import { z } from 'zod';
import { isValidTimeZone } from './business-days';
import { AUDIT_TYPES, ENTITY_STATUSES, LANGUAGES, QUESTION_TYPES, ROLES } from './enums';
import type { Activation } from './questionnaire';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'INVALID_ID');
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_DATE');
export const languageSchema = z.enum(LANGUAGES);

export const emailSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email().max(254),
);

export const timeZoneSchema = z.string().min(1).refine(isValidTimeZone, 'INVALID_TIME_ZONE');
export const countrySchema = z.string().regex(/^[A-Z]{2}$/, 'INVALID_COUNTRY');

// ---------- Auth
export const magicLinkRequestSchema = z.object({ email: emailSchema, language: languageSchema.optional() });
export const magicLinkVerifySchema = z.object({ token: z.string().min(20).max(200) });
export const selectAccountSchema = z.object({ userId: objectIdSchema });

// ---------- Organizations and users
export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: countrySchema,
  timeZone: timeZoneSchema,
  defaultLanguage: languageSchema,
  adminEmail: emailSchema.optional(),
});
export const organizationUpdateSchema = organizationCreateSchema
  .omit({ adminEmail: true })
  .partial()
  .extend({ status: z.enum(ENTITY_STATUSES).optional() });

export const userCreateSchema = z.object({ email: emailSchema, preferredLanguage: languageSchema.optional() });
export const userStatusSchema = z.object({ status: z.enum(ENTITY_STATUSES) });
export const superadminCreateSchema = userCreateSchema.extend({
  role: z.enum(ROLES).refine((r) => r.startsWith('SUPERADMIN'), 'INVALID_ROLE'),
});
export const userPreferencesSchema = z.object({ preferredLanguage: languageSchema });

// ---------- Configuration
export const samplingBracketSchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(1).nullable(),
  required: z.number().int().min(1),
  rangeMax: z.number().int().min(1).nullable().optional(),
});
export const samplingTableInputSchema = z.object({
  brackets: z.array(samplingBracketSchema).min(1).max(50),
  notes: z.string().max(1000).optional(),
});


const localizedTextSchema = z.partialRecord(languageSchema, z.string().max(2000));

export const activationSchema: z.ZodType<Activation> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('answer_in'), question: z.string().min(1), values: z.array(z.string()).min(1) }),
    z.object({
      kind: z.literal('campaign_in'),
      field: z.enum(['auditType', 'excellence', 'norm']),
      values: z.array(z.union([z.string(), z.boolean()])).min(1),
    }),
    z.object({ kind: z.literal('all'), of: z.array(activationSchema).min(1) }),
    z.object({ kind: z.literal('any'), of: z.array(activationSchema).min(1) }),
    z.object({ kind: z.literal('not'), expr: activationSchema }),
  ]),
);

export const questionSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_.]{1,20}$/),
  block: z.string().min(1).max(50),
  order: z.number().int().min(1),
  type: z.enum(QUESTION_TYPES),
  text: localizedTextSchema,
  help: localizedTextSchema.nullable().optional(),
  options: z.array(
    z.object({
      code: z.string().regex(/^[A-Z0-9_]{1,40}$/),
      label: localizedTextSchema,
      freeText: z.object({ label: localizedTextSchema, required: z.boolean() }).nullable().optional(),
    }),
  ),
  activation: activationSchema,
  mandatory: z.boolean(),
  allowAbstain: z.boolean().default(true),
  maxClarifications: z.number().int().min(0).max(3).default(1),
  reportMapping: z.string().max(100).nullable().optional(),
});
export const questionnaireDraftUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  questions: z.array(questionSchema).min(1).max(100),
});
export const questionnaireLanguageSchema = z.object({ lang: languageSchema });

export const settingsUpdateSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1).optional(),
  llmProvider: z.string().min(1).max(50).optional(),
  mailFromName: z.string().min(1).max(100).optional(),
  mailFromAddress: emailSchema.optional(),
  norms: z.array(z.string().min(1).max(20)).min(1).optional(),
  retention: z
    .object({
      enabled: z.boolean(),
      deleteContactsAfterDays: z.number().int().min(1).nullable(),
      anonymizeResponsesAfterYears: z.number().int().min(1).nullable(),
    })
    .optional(),
});

// ---------- Campaigns
export const campaignM1InputSchema = z.object({
  reference: z.string().trim().max(120).optional(),
  norm: z.string().min(1).max(20),
  auditType: z.enum(AUDIT_TYPES),
  excellence: z.boolean(),
  efrManagerName: z.string().trim().max(200).nullable().optional(),
  visitDate: isoDateSchema,
  scopeSize: z.number().int().min(1).max(10_000_000),
  auditorMinimum: z.number().int().min(1).nullable().optional(),
  languages: z.array(languageSchema).min(1).max(LANGUAGES.length),
});
export type CampaignM1Input = z.infer<typeof campaignM1InputSchema>;

export const campaignStatusChangeSchema = z.object({
  to: z.enum(['suspendida', 'cancelada', 'borrador', 'muestra_cargada', 'envios_activos', 'en_curso']),
  reason: z.string().trim().max(500).optional(),
});

// ---------- Participants (public landing)
export const campaignSlugSchema = z.string().regex(/^[a-z2-9]{10}$/, 'INVALID_SLUG');
export const accessCodeInputSchema = z.object({ code: z.string().min(1).max(40) });

export const sampleUploadQuerySchema = z.object({ mode: z.enum(['replace', 'append']).default('replace') });
export const fileFormatQuerySchema = z.object({ format: z.enum(['xlsx', 'csv']).default('xlsx') });
