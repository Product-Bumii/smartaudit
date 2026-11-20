/** campaigns, participantContacts, respondents, interviews, reports */
import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import {
  AGE_BANDS,
  ANSWER_STATUSES,
  AUDIT_TYPES,
  CAMPAIGN_STATUSES,
  INTERVIEW_STATES,
  LANGUAGES,
  MODULES,
  RESPONDENT_STATUSES,
  SENIORITY_BANDS,
  SEX_VALUES,
} from '@smartaudit/shared';

const m1ConfigSchema = new Schema(
  {
    norm: { type: String, required: true },
    auditType: { type: String, enum: AUDIT_TYPES, required: true },
    excellence: { type: Boolean, required: true },
    leadAuditorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    efrManagerName: { type: String, default: null },
    /** First day of interviews (local date); the window opens that day. */
    interviewStartDate: { type: String, required: true },
    scopeSize: { type: Number, required: true },
    auditorMinimum: { type: Number, default: null },
    /** Maximum chosen by the auditor (`null` = the minimum). */
    maxCompleted: { type: Number, default: null },
    languages: [{ type: String, enum: LANGUAGES }],
  },
  { _id: false },
);

const campaignSchema = new Schema(
  {
    module: { type: String, enum: MODULES, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    /** Audit entity that runs the campaign; it keeps it even if the organization changes entity. */
    auditEntityId: { type: Schema.Types.ObjectId, ref: 'AuditEntity', required: true },
    /** Public slug for the landing `/c/<slug>` (participants without email). */
    slug: { type: String, required: true, unique: true },
    reference: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, required: true, default: 'borrador' },
    /** State before suspension (to resume). */
    previousStatus: { type: String, enum: [...CAMPAIGN_STATUSES, null], default: null },
    statusHistory: [
      {
        _id: false,
        from: { type: String, default: null },
        to: { type: String, required: true },
        at: { type: Date, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reason: { type: String, default: null },
      },
    ],
    m1Config: { type: m1ConfigSchema, default: null },
    // TODO(M2): m2Config (measures inventory). TODO(M3): m3Config (journeys).
    m2Config: { type: Schema.Types.Mixed, default: null },
    m3Config: { type: Schema.Types.Mixed, default: null },
    /** Applied sampling: table version, declared size, bracket and minimum. */
    sampling: {
      tableId: { type: Schema.Types.ObjectId, ref: 'SamplingTable' },
      tableVersion: Number,
      scopeSize: Number,
      bracketIndex: Number,
      bracket: { _id: false, min: Number, max: { type: Number, default: null }, required: Number, rangeMax: { type: Number, default: null } },
      minimum: { type: Number, default: null },
      /** Completed interviews at which the campaign closes automatically. */
      maximum: { type: Number, default: null },
      requiresAuditorChoice: Boolean,
      auditorChosen: Boolean,
    },
    /** Frozen copy of the sampling table brackets used. */
    samplingTableSnapshot: { type: [Schema.Types.Mixed], default: [] },
    /** Frozen questionnaire (structure + texts) and its approved languages at snapshot time. */
    questionnaireSnapshot: {
      questionnaireId: { type: Schema.Types.ObjectId, ref: 'Questionnaire' },
      version: Number,
      languages: { type: [Schema.Types.Mixed], default: [] },
      questions: { type: [Schema.Types.Mixed], default: [] },
    },
    offeredLanguages: [{ type: String, enum: LANGUAGES }],
    activatedQuestions: { type: [Schema.Types.Mixed], default: [] },
    window: {
      timeZone: String,
      businessDays: [String],
      openDate: String,
      closeDate: String,
      opensAt: Date,
      closesAt: Date,
      reminders: { type: [Schema.Types.Mixed], default: [] },
      /** Extensions decided by the auditor (Phase 2). */
      extensions: { type: [Schema.Types.Mixed], default: [] },
    },
    sampleSize: { type: Number, required: true, default: 0 },
    sampleLoadedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'campaigns' },
);
campaignSchema.index({ organizationId: 1, status: 1 });
campaignSchema.index({ 'm1Config.leadAuditorId': 1 });
campaignSchema.index({ auditEntityId: 1, organizationId: 1 });
export type CampaignDoc = InferSchemaType<typeof campaignSchema> & { _id: Types.ObjectId };
export const Campaign = model('Campaign', campaignSchema);

/**
 * SEPARATE collection holding the only link between a person's contact data and their respondent
 * record. Used exclusively to send invitations/reminders and to update the status.
 */
const participantContactSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    respondentId: { type: Schema.Types.ObjectId, ref: 'Respondent', required: true },
    emailEncrypted: { type: String, default: null },
    emailHash: { type: String, default: null },
    noEmail: { type: Boolean, required: true, default: false },
    /** Invitation token for `/i/<token>` (people with email). Hash for lookup, encrypted to build the link. */
    invitationTokenHash: { type: String, default: null },
    invitationTokenEncrypted: { type: String, default: null },
    /** 8-char access code for `/c/<slug>` (people without email). Hash for lookup, encrypted for the paper list. */
    accessCodeHash: { type: String, default: null },
    accessCodeEncrypted: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    /** Row in the auditor's file, to match codes with the people in the auditor's own list. */
    sourceRow: { type: Number, required: true },
    sends: { type: [{ _id: false, kind: String, at: Date, messageId: String }], default: [] },
    /** Failed sends (retried with growing waits, at most 5 times per kind). */
    failures: { type: [{ _id: false, kind: String, at: Date }], default: [] },
    bounces: { type: [{ _id: false, at: Date, reason: String }], default: [] },
  },
  { timestamps: true, collection: 'participantContacts' },
);
participantContactSchema.index({ campaignId: 1, emailHash: 1 }, { unique: true, partialFilterExpression: { emailHash: { $type: 'string' } } });
participantContactSchema.index({ invitationTokenHash: 1 }, { unique: true, partialFilterExpression: { invitationTokenHash: { $type: 'string' } } });
participantContactSchema.index({ campaignId: 1, accessCodeHash: 1 }, { unique: true, partialFilterExpression: { accessCodeHash: { $type: 'string' } } });
participantContactSchema.index({ respondentId: 1 }, { unique: true });
export const ParticipantContact = model('ParticipantContact', participantContactSchema);

/** Respondent: demographics and status ONLY. No email, no personal identifiers. */
const respondentSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    module: { type: String, enum: MODULES, required: true },
    demographics: {
      sex: { type: String, enum: SEX_VALUES, required: true },
      ageBand: { type: String, enum: AGE_BANDS, required: true },
      workCenter: { type: String, required: true },
      jobType: { type: String, required: true },
      seniorityBand: { type: String, enum: [...SENIORITY_BANDS, null], default: null },
      area: { type: String, default: null },
      shifts: { type: Boolean, default: null },
      telework: { type: Boolean, default: null },
      dependents: { type: Boolean, default: null },
      rlpt: { type: Boolean, default: null },
    },
    status: { type: String, enum: RESPONDENT_STATUSES, required: true, default: 'pending' },
    startedAt: { type: Date, default: null },
    /** Billing unit: completed interview. */
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'respondents' },
);
respondentSchema.index({ campaignId: 1, status: 1 });
respondentSchema.index({ completedAt: 1 });
export const Respondent = model('Respondent', respondentSchema);

const answerSchema = new Schema(
  {
    questionCode: { type: String, required: true },
    originalText: { type: String, default: null },
    optionCodes: { type: [String], default: [] },
    freeText: { type: String, default: null },
    status: { type: String, enum: ANSWER_STATUSES, required: true },
    confidence: { type: Number, default: null },
    supportingQuote: { type: String, default: null },
    clarificationsUsed: { type: Number, default: 0 },
    viaButton: { type: Boolean, default: false },
    model: { type: String, default: null },
    promptVersion: { type: String, default: null },
    review: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      optionCodes: { type: [String], default: undefined },
      note: { type: String, default: null },
    },
  },
  { _id: false, timestamps: true },
);

/** Interview (Phase 2): state machine, messages and coded answers. */
const interviewSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    respondentId: { type: Schema.Types.ObjectId, ref: 'Respondent', required: true },
    module: { type: String, enum: MODULES, required: true },
    language: { type: String, enum: LANGUAGES, required: true },
    state: { type: String, enum: INTERVIEW_STATES, required: true, default: 'not_started' },
    currentQuestionCode: { type: String, default: null },
    /** Conversation shown to the participant (assistant questions/clarifications and participant inputs). */
    messages: { type: [{ _id: false, role: String, kind: String, text: String, questionCode: String, at: Date }], default: [] },
    answers: { type: [answerSchema], default: [] },
    llmModel: { type: String, default: null },
    promptVersion: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'interviews' },
);
interviewSchema.index({ respondentId: 1 }, { unique: true });
interviewSchema.index({ campaignId: 1, state: 1 });
export const Interview = model('Interview', interviewSchema);

/** Report (Phase 3): computed tables, AI synthesis and edits. */
const reportSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    module: { type: String, enum: MODULES, required: true },
    version: { type: Number, required: true },
    tables: { type: Schema.Types.Mixed, default: null },
    aiSynthesis: { type: String, default: null },
    editedSyntheses: { type: [{ _id: false, text: String, by: Schema.Types.ObjectId, at: Date }], default: [] },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    files: { type: [{ _id: false, kind: String, path: String, createdAt: Date }], default: [] },
  },
  { timestamps: true, collection: 'reports' },
);
reportSchema.index({ campaignId: 1, version: 1 }, { unique: true });
export const Report = model('Report', reportSchema);
