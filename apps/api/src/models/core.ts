/** auditEntities, organizations, users, magicLinkTokens, auditLogs, settings */
import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { DEFAULT_NORMS, ENTITY_STATUSES, LANGUAGES, ROLES } from '@smartaudit/shared';

/**
 * Audit entity (certification body such as ICONTEC, AENOR, SGS): master table managed by superadmins.
 * Coordinators and auditors belong to one.
 */
const auditEntitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Optional: some bodies work in several countries. */
    country: { type: String, default: null },
    status: { type: String, enum: ENTITY_STATUSES, required: true, default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'auditEntities' },
);
export type AuditEntityDoc = InferSchemaType<typeof auditEntitySchema> & { _id: Types.ObjectId };
export const AuditEntity = model('AuditEntity', auditEntitySchema);

/** Organization = audited efr company. It has no users; it is assigned to an audit entity. */
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    timeZone: { type: String, required: true },
    defaultLanguage: { type: String, enum: LANGUAGES, required: true, default: 'es' },
    status: { type: String, enum: ENTITY_STATUSES, required: true, default: 'active' },
    /** Assignment: set by superadmins (entity, coordinator) and by the coordinator (auditor). */
    auditEntityId: { type: Schema.Types.ObjectId, ref: 'AuditEntity', default: null },
    coordinatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    auditorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignmentHistory: [
      {
        _id: false,
        auditEntityId: { type: Schema.Types.ObjectId, default: null },
        coordinatorId: { type: Schema.Types.ObjectId, default: null },
        auditorId: { type: Schema.Types.ObjectId, default: null },
        at: { type: Date, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'organizations' },
);
organizationSchema.index({ auditEntityId: 1, coordinatorId: 1 });
organizationSchema.index({ auditEntityId: 1, auditorId: 1 });
/** Plain (lean) organization; the assignment history is only written, never read by the services. */
export type OrganizationDoc = Omit<InferSchemaType<typeof organizationSchema>, 'assignmentHistory'> & { _id: Types.ObjectId };
export const Organization = model('Organization', organizationSchema);

const userSchema = new Schema(
  {
    /** AES-256-GCM encrypted email; never stored in clear text. */
    emailEncrypted: { type: String, required: true },
    /** HMAC of the normalized email, for login lookup and uniqueness. */
    emailHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    /** Audit entity of coordinators and auditors; `null` for superadmins. */
    auditEntityId: { type: Schema.Types.ObjectId, ref: 'AuditEntity', default: null },
    status: { type: String, enum: ENTITY_STATUSES, required: true, default: 'active' },
    preferredLanguage: { type: String, enum: LANGUAGES, required: true, default: 'es' },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'users' },
);
// One account per audit entity: the same email may exist in several entities (e.g. a freelance auditor).
userSchema.index({ emailHash: 1, auditEntityId: 1 }, { unique: true });
userSchema.index({ auditEntityId: 1, role: 1 });
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);

const magicLinkTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'magicLinkTokens' },
);
// Expired tokens are removed by MongoDB one day after expiry.
magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });
export const MagicLinkToken = model('MagicLinkToken', magicLinkTokenSchema);

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    auditEntityId: { type: Schema.Types.ObjectId, ref: 'AuditEntity', default: null },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    /** Non-personal metadata only (counts, versions, states). */
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: 'auditLogs' },
);
auditLogSchema.index({ organizationId: 1, at: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
export const AuditLog = model('AuditLog', auditLogSchema);

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    confidenceThreshold: { type: Number, required: true, default: 0.8 },
    llmProvider: { type: String, required: true, default: 'mock' },
    mailFromName: { type: String, required: true, default: 'SmartAudit efr' },
    mailFromAddress: { type: String, required: true, default: 'no-reply@bumii.ai' },
    /** Daily sending cap (Google Workspace ≈ 2.000/day). Used by the worker from Phase 2. */
    mailDailyLimit: { type: Number, required: true, default: 1800 },
    norms: { type: [String], required: true, default: () => [...DEFAULT_NORMS] },
    mailTemplates: { type: Schema.Types.Mixed, default: {} },
    retention: {
      enabled: { type: Boolean, required: true, default: false },
      deleteContactsAfterDays: { type: Number, default: null },
      anonymizeResponsesAfterYears: { type: Number, default: null },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'settings' },
);
export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const Settings = model('Settings', settingsSchema);

/** Returns the global settings document, creating it with defaults if missing. */
export async function getSettings() {
  return Settings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
