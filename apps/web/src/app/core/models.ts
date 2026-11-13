/** API DTO types shared with the backend (type-only imports: no runtime code from packages/shared). */
export type {
  AccountChoice,
  ApiErrorBody,
  AuditType,
  CampaignDto,
  CampaignStatus,
  EntityStatus,
  Language,
  OrganizationDto,
  Role,
  SampleError,
  SessionUser,
  UserDto,
} from '@smartaudit/shared';

import type { CampaignDto } from '@smartaudit/shared';

export const LANGS = ['es', 'en', 'ca'] as const;
export const AUDIT_TYPE_VALUES = ['inicial', 'mantenimiento', 'renovacion'] as const;
export const SUPERADMIN_ROLE_VALUES = ['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION'] as const;

export interface CampaignListItem extends CampaignDto {
  organizationName: string | null;
}

export interface CampaignOptions {
  norms: string[];
  auditTypes: string[];
  languages: { lang: 'es' | 'en' | 'ca'; approved: boolean }[];
}

export interface CampaignPreview {
  minimum:
    | { ok: true; minimum: number | null; requiresAuditorChoice: boolean; auditorChosen: boolean; bracket: { min: number; max: number | null; required: number; rangeMax?: number | null } }
    | { ok: false; error: string };
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
