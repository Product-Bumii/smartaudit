/** Shared API DTO shapes (serialized JSON). */
import type { CampaignAccess } from './access';
import type { CampaignWindow } from './business-days';
import type { CampaignStatus, EntityStatus, InterviewState, Language, QuestionType, RespondentStatus, Role } from './enums';
import type { ParticipantAvailability } from './participant';
import type { Progress } from './schedule';
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

/** One page of a list. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditEntityDto {
  id: string;
  name: string;
  country: string | null;
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
    /** Completed interviews at which the campaign closes (`null` while the minimum is unknown). */
    maximum: number | null;
    requiresAuditorChoice: boolean;
    auditorChosen: boolean;
  } | null;
  /** Window, with the extensions decided by the auditor (section 5.4: «queda registrado»). */
  window: (CampaignWindow & { extensions?: WindowExtensionView[] }) | null;
  questionnaire: { version: number; offeredLanguages: Language[] } | null;
  activatedQuestions: { code: string; order: number; mandatory: boolean; state: QuestionActivationState }[];
  sampleSize: number;
  statusHistory: { from: CampaignStatus | null; to: CampaignStatus; at: string; reason?: string | null }[];
}

export interface SampleUploadErrorDetails {
  errors: SampleError[];
}

// ---------- Participant interview (Phase 2)

export interface InterviewQuestionView {
  code: string;
  type: QuestionType;
  /** Text shown to the participant (AI phrasing checked by `safePhrasing`, or the official text). */
  text: string;
  help: string | null;
  options: { code: string; label: string; freeText: { label: string; required: boolean } | null }[];
  allowAbstain: boolean;
  mandatory: boolean;
}

export interface InterviewMessageView {
  role: 'assistant' | 'participant';
  kind: 'question' | 'clarification' | 'options' | 'abstain' | 'text' | 'closing';
  text: string;
  questionCode: string | null;
  at: string;
}

export interface InterviewStateDto {
  state: InterviewState;
  language: Language;
  messages: InterviewMessageView[];
  /** Question waiting for an answer; `null` when the interview is complete. */
  question: InterviewQuestionView | null;
  /** The last assistant message is the (single) clarification of `question`. */
  clarifying: boolean;
  progress: { answered: number; planned: number };
}

export interface ParticipantSessionDto {
  availability: ParticipantAvailability;
  offeredLanguages: Language[];
  window: { opensAt: string; closesAt: string; timeZone: string } | null;
  interview: { state: InterviewState; language: Language } | null;
}

// ---------- Campaign progress (auditor: per person; coordinator: aggregate only)

export interface ProgressPersonRow {
  /** Row in the auditor's own sample file (the only way to match people, never names). */
  sourceRow: number;
  noEmail: boolean;
  status: RespondentStatus;
  invitedAt: string | null;
  remindersSent: number;
  completedAt: string | null;
}

export interface CampaignProgressDto extends Progress {
  people: ProgressPersonRow[] | null;
}

export interface WindowExtensionView {
  /** Previous and new closing dates (local). */
  from: string;
  to: string;
  at: string;
  reason: string | null;
}
