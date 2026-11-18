/** Shared API DTO shapes (serialized JSON). */
import type { CampaignAccess } from './access';
import type { CampaignWindow } from './business-days';
import type { CampaignStatus, EntityStatus, Language, Role } from './enums';
import type { QuestionActivationState } from './questionnaire';
import type { M1Config } from './modules';
import type { SampleError } from './sample-file';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface SessionUser {
  id: string;
  role: Role;
  /** Audit entity (certification body) of coordinators and auditors; `null` for superadmins. */
  auditEntityId: string | null;
  auditEntityName: string | null;
  email: string;
  preferredLanguage: Language;
}

export interface AccountChoice {
  userId: string;
  role: Role;
  auditEntityId: string | null;
  auditEntityName: string | null;
}

export interface UserRef {
  id: string;
  email: string;
  role: Role;
  status: EntityStatus;
}

export interface AuditEntityDto {
  id: string;
  name: string;
  country: string;
  status: EntityStatus;
}

export interface OrganizationDto {
  id: string;
  name: string;
  country: string;
  timeZone: string;
  defaultLanguage: Language;
  status: EntityStatus;
  auditEntity: { id: string; name: string } | null;
  coordinator: UserRef | null;
  auditor: UserRef | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  auditEntityId: string | null;
  status: EntityStatus;
  preferredLanguage: Language;
}

export interface CampaignDto {
  id: string;
  module: 'M1';
  organizationId: string;
  organizationName?: string | null;
  auditEntityId: string;
  /** What the requesting user may do with this campaign. */
  access: CampaignAccess;
  slug: string;
  reference: string | null;
  status: CampaignStatus;
  m1Config: M1Config;
  sampling: {
    tableVersion: number;
    scopeSize: number;
    bracket: { min: number; max: number | null };
    minimum: number | null;
    requiresAuditorChoice: boolean;
    auditorChosen: boolean;
  } | null;
  window: CampaignWindow | null;
  questionnaire: { version: number; offeredLanguages: Language[] } | null;
  activatedQuestions: { code: string; order: number; mandatory: boolean; state: QuestionActivationState }[];
  sampleSize: number;
  statusHistory: { from: CampaignStatus | null; to: CampaignStatus; at: string; reason?: string | null }[];
}

export interface SampleUploadErrorDetails {
  errors: SampleError[];
}
