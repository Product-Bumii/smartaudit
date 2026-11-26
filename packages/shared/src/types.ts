/** Shared API DTO shapes (serialized JSON). */
import type { CampaignAccess } from './access';
import type { CampaignWindow } from './business-days';
import type { AnswerMode, AnswerStatus, CampaignStatus, ReviewDecision, EntityStatus, InterviewState, Language, QuestionType, RespondentStatus, Role } from './enums';
import type { ParticipantAvailability } from './participant';
import type { Progress } from './schedule';
import type { LocalizedText, QuestionActivationState } from './questionnaire';
import type { CampaignResults, OptionResult, QuestionResult } from './results';
import type { M1Config } from './modules';
import type { SampleError, SmallGroup } from './sample-file';

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
  /** `text`: no option buttons, the participant answers in own words (decision 90). */
  answerMode: AnswerMode;
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

// ---------- Results, review and individual answers (cambios 4 · bloques 1 y 2)

/** Question texts and option labels in every language: the screen shows the user's language (Spanish fallback). */
export interface ResultsQuestionView extends Omit<QuestionResult, 'options'> {
  text: LocalizedText;
  options: (OptionResult & { label: LocalizedText })[];
}

export interface CampaignResultsDto extends Omit<CampaignResults, 'questions'> {
  questionnaireVersion: number | null;
  questions: ResultsQuestionView[];
}

export interface ReviewItemDto {
  /** Opaque reference of the interview (never the person). */
  interviewId: string;
  questionCode: string;
  questionText: LocalizedText;
  questionType: QuestionType;
  options: { code: string; label: LocalizedText }[];
  /** Language the person answered in. */
  language: Language;
  status: AnswerStatus;
  /** What the AI proposed (may be empty) and how sure it was. */
  aiCodes: string[];
  confidence: number | null;
  supportingQuote: string | null;
  originalText: string | null;
  followUpReason: string | null;
  clarificationsUsed: number;
  /** The conversation about this question only. */
  thread: { role: 'assistant' | 'participant'; text: string }[];
  review: { decision: ReviewDecision; optionCodes: string[]; note: string | null; reviewedAt: string } | null;
}

export interface ReviewListDto {
  items: ReviewItemDto[];
  counts: { pending: number; reviewed: number };
}

export interface ResponsesQuestionColumn {
  code: string;
  text: LocalizedText;
  options: { code: string; label: LocalizedText }[];
}

/** One completed interview: demographics and effective coded answers. Never an identity, file row or date. */
export interface ResponseRow {
  demographics: Record<string, string | boolean | null>;
  answers: Record<string, { kind: 'codes' | 'abstention' | 'no_valid_answer' | 'pending'; codes: string[]; reviewed: boolean }>;
}

export interface ResponsesDto {
  questions: ResponsesQuestionColumn[];
  rows: ResponseRow[];
  smallGroups: SmallGroup[];
}

/** Open answers, without demographics and not in interview order (P14–P15 «texto libre disociado»). */
export interface CommentsDto {
  questions: { code: string; text: LocalizedText; comments: string[] }[];
}
