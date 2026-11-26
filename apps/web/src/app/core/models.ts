/** API DTO types shared with the backend (type-only imports: no runtime code from packages/shared). */
export type {
  AccountChoice,
  ApiErrorBody,
  AuditEntityDto,
  AuditType,
  CampaignAccess,
  CampaignProgressDto,
  CampaignResultsDto,
  CommentsDto,
  LocalizedText,
  ResponseRow,
  ResponsesDto,
  ReviewDecision,
  ReviewItemDto,
  ReviewListDto,
  InterviewQuestionView,
  InterviewStateDto,
  ParticipantSessionDto,
  ParticipantTestLinkDto,
  CampaignDto,
  CampaignStatus,
  EntityStatus,
  Language,
  OrganizationDto,
  Paged,
  Role,
  SampleError,
  SessionUser,
  UserDto,
  UserRef,
} from '@smartaudit/shared';

import type { AuditEntityDto, CampaignDto, Language, OrganizationDto } from '@smartaudit/shared';

/**
 * Languages offered in the interface and selectors. `pt` = portugués de Portugal (pt-PT). The `ca`
 * translation files are kept but Catalan is not offered (decision 66).
 */
export const LANGS = ['es', 'en', 'pt', 'fr'] as const;
export const PAGE_SIZES = [10, 25, 50, 100];
/** Status filter of the audit list: groups or one status. */
/** Statuses offered in the list filter (no manual launch, suspension or cancellation since change group 3). */
export const CAMPAIGN_STATUS_VALUES = ['borrador', 'muestra_cargada', 'en_curso', 'finalizada', 'informe_generado'] as const;
/** Audit types that can be chosen (change group 3). Older audits may still show «mantenimiento». */
export const AUDIT_TYPE_VALUES = ['inicial', 'renovacion'] as const;
export const SUPERADMIN_ROLE_VALUES = ['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION'] as const;

export interface CampaignListItem extends CampaignDto {
  organizationName: string | null;
}

export interface AuditEntityListItem extends AuditEntityDto {
  coordinators: number;
  auditors: number;
  organizations: number;
}

/** Organization assigned to the current coordinator or auditor. */
export interface AssignedOrganization extends OrganizationDto {
  coordinates: boolean;
  audits: boolean;
}

export interface CampaignOptions {
  organizations: { id: string; name: string; timeZone: string; country: string }[];
  norms: string[];
  auditTypes: string[];
  languages: { lang: Language; approved: boolean }[];
}

export interface CampaignPreview {
  minimum:
    | { ok: true; minimum: number | null; requiresAuditorChoice: boolean; auditorChosen: boolean; bracket: { min: number; max: number | null; required: number; rangeMax?: number | null } }
    | { ok: false; error: string };
  maximum: { ok: true; maximum: number; auditorChosen: boolean } | { ok: false; error: string } | null;
  window: CampaignDto['window'];
  windowWarnings: string[];
  questions: CampaignDto['activatedQuestions'];
  offeredLanguages: string[];
  problems: { code: string; details?: Record<string, unknown> }[];
}

export interface CountItem {
  value: string;
  count: number;
}

export interface SampleSummary {
  total: number;
  withEmail: number;
  noEmail: number;
  minimum: number | null;
  alerts: string[];
  byStatus: Record<string, number>;
  distribution: { sex: CountItem[]; ageBand: CountItem[] };
  distinctValues: { workCenter: CountItem[]; jobType: CountItem[]; area: CountItem[] };
  smallGroups: { field: string; value: string; count: number }[];
  loadedAt: string | null;
}
