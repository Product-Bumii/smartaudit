/** Domain enumerations. Values are stable internal codes (never translated). */

/**
 * `COORDINATOR` = audit coordinator of an audit entity (certification body such as ICONTEC, AENOR, SGS).
 * `AUDITOR` belongs to an audit entity too. The audited company (organization) has no users (decision 56).
 */
export const ROLES = ['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION', 'COORDINATOR', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];
export const SUPERADMIN_ROLES: readonly Role[] = ['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION'];
export const isSuperadmin = (role: Role): boolean => SUPERADMIN_ROLES.includes(role);

/** `pt` = Portuguese of Portugal (pt-PT). */
export const LANGUAGES = ['es', 'en', 'ca', 'pt', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'es';
/**
 * Languages offered in the interface, to organizations, users and participants. `ca` keeps its translations
 * and questionnaire texts but is not offered (decision 66).
 */
export const AVAILABLE_LANGUAGES = ['es', 'en', 'pt', 'fr'] as const satisfies readonly Language[];
export type AvailableLanguage = (typeof AVAILABLE_LANGUAGES)[number];
export const isAvailableLanguage = (lang: string): lang is AvailableLanguage =>
  (AVAILABLE_LANGUAGES as readonly string[]).includes(lang);

export const MODULES = ['M1', 'M2', 'M3'] as const;
export type Module = (typeof MODULES)[number];

export const ENTITY_STATUSES = ['active', 'inactive'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const CONFIG_STATUSES = ['draft', 'published'] as const;
export type ConfigStatus = (typeof CONFIG_STATUSES)[number];

export const TRANSLATION_STATUSES = ['pending_approval', 'approved'] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

/** Campaign states approved by the Fundación (section 5.1). */
export const CAMPAIGN_STATUSES = [
  'borrador',
  'muestra_cargada',
  'envios_activos',
  'en_curso',
  'finalizada',
  'informe_generado',
  'suspendida',
  'cancelada',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Audit types that can be chosen (change group 3: only initial or renewal, decision 85). */
export const AUDIT_TYPES = ['inicial', 'renovacion'] as const;
/** `mantenimiento` is no longer offered; kept only so older audits keep working. */
export const LEGACY_AUDIT_TYPES = ['mantenimiento'] as const;
export const STORED_AUDIT_TYPES = [...AUDIT_TYPES, ...LEGACY_AUDIT_TYPES] as const;
export type AuditType = (typeof STORED_AUDIT_TYPES)[number];

/** Default norm list. The live list is stored in `settings.norms`. */
export const DEFAULT_NORMS = ['1000-1', '1000-2'] as const;

export const QUESTION_TYPES = ['single', 'multi', 'yes_no', 'free_text'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
/**
 * How a closed question is answered (decision 90): `buttons` = options as buttons or own words (questionnaires
 * up to change group 3); `text` = conversational interview, always in own words (only «Prefiero no responder»
 * remains a button).
 */
export const ANSWER_MODES = ['buttons', 'text'] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

export const ABSTENTION_CODE = 'ABSTENCION';

/**
 * What the auditor decides on an answer sent to review (cambios 4, decision 94): the option code(s), an
 * abstention, or «sin respuesta válida» (excluded from the percentages, like an abstention, but counted apart).
 */
export const REVIEW_DECISIONS = ['codes', 'abstention', 'no_valid_answer'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * `pending` = loaded in the sample but not yet invited (Phase 1).
 * `invited`, `started`, `completed` are used from Phase 2 on.
 */
export const RESPONDENT_STATUSES = ['pending', 'invited', 'started', 'completed'] as const;
export type RespondentStatus = (typeof RESPONDENT_STATUSES)[number];

export const SEX_VALUES = ['Mujer', 'Hombre', 'Otro', 'No indica'] as const;
export type Sex = (typeof SEX_VALUES)[number];

export const AGE_BANDS = ['<30', '30-40', '41-50', '51-60', '>60'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const SENIORITY_BANDS = ['<2', '2-5', '6-10', '>10'] as const;
export type SeniorityBand = (typeof SENIORITY_BANDS)[number];

export const ANSWER_STATUSES = ['classified', 'ambiguous', 'abstained', 'off_topic', 'pending_review'] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export const INTERVIEW_STATES = ['not_started', 'in_progress', 'completed'] as const;
export type InterviewState = (typeof INTERVIEW_STATES)[number];
