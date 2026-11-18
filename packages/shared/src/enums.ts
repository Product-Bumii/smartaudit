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

export const AUDIT_TYPES = ['inicial', 'mantenimiento', 'renovacion'] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

/** Default norm list. The live list is stored in `settings.norms`. */
export const DEFAULT_NORMS = ['1000-1', '1000-2'] as const;

export const QUESTION_TYPES = ['single', 'multi', 'yes_no', 'free_text'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ABSTENTION_CODE = 'ABSTENCION';

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
