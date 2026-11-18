/**
 * Assignment-based access (decision 56):
 * superadmins (F+f) assign each organization to an audit entity and one of its coordinators; the
 * coordinator designates the responsible auditor (possibly themselves). Campaigns belong to the audit
 * entity that created them and are managed by their lead auditor.
 */
import { isSuperadmin, type CampaignStatus, type EntityStatus, type Role } from './enums';

export interface AccessUser {
  id: string;
  role: Role;
  /** `null` for superadmins. */
  auditEntityId: string | null;
}

export interface OrganizationAssignment {
  auditEntityId: string | null;
  coordinatorId: string | null;
  auditorId: string | null;
}

export interface CampaignOwnership {
  auditEntityId: string;
  leadAuditorId: string;
}

/**
 * - `manage`: lead auditor — configuration, sample, codes, responses, report.
 * - `supervise`: superadmins — see everything, suspend or cancel; they do not load samples.
 * - `aggregate`: coordinator of the organization — status and aggregate progress only.
 * - `none`: answered as 404.
 */
export type CampaignAccess = 'manage' | 'supervise' | 'aggregate' | 'none';

export function campaignAccess(user: AccessUser, campaign: CampaignOwnership, org: OrganizationAssignment): CampaignAccess {
  if (isSuperadmin(user.role)) return 'supervise';
  // Campaigns stay with the audit entity that ran them, even if the organization changes entity.
  if (!user.auditEntityId || user.auditEntityId !== campaign.auditEntityId) return 'none';
  if (campaign.leadAuditorId === user.id) return 'manage';
  if (user.role === 'COORDINATOR' && org.auditEntityId === campaign.auditEntityId && org.coordinatorId === user.id) return 'aggregate';
  return 'none';
}

/** Campaigns that are over: they are not transferred and do not block an entity change. */
export const CLOSED_CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['informe_generado', 'cancelada'];
export const isCampaignClosed = (status: CampaignStatus): boolean => CLOSED_CAMPAIGN_STATUSES.includes(status);

/** Only the auditor currently assigned to an active organization creates campaigns for it. */
export function canCreateCampaignFor(user: AccessUser, org: OrganizationAssignment & { status: EntityStatus }): boolean {
  return (
    (user.role === 'AUDITOR' || user.role === 'COORDINATOR') &&
    user.auditEntityId !== null &&
    org.status === 'active' &&
    org.auditEntityId === user.auditEntityId &&
    org.auditorId === user.id
  );
}

/** Coordinators see (and reassign the auditor of) the organizations assigned to them. */
export function coordinatesOrganization(user: AccessUser, org: OrganizationAssignment): boolean {
  return user.role === 'COORDINATOR' && user.auditEntityId !== null && org.auditEntityId === user.auditEntityId && org.coordinatorId === user.id;
}

/** Who may change the auditor of an organization: superadmins and its coordinator. */
export function canAssignAuditor(user: AccessUser, org: OrganizationAssignment): boolean {
  if (isSuperadmin(user.role)) return org.auditEntityId !== null;
  return coordinatesOrganization(user, org);
}

export interface AssignableUser {
  id: string;
  role: Role;
  auditEntityId: string | null;
  status: EntityStatus;
}

/** An auditor of the organization's entity, or its own coordinator acting as auditor. */
export function isEligibleAuditor(candidate: AssignableUser, org: OrganizationAssignment): boolean {
  if (candidate.status !== 'active' || org.auditEntityId === null || candidate.auditEntityId !== org.auditEntityId) return false;
  return candidate.role === 'AUDITOR' || (candidate.role === 'COORDINATOR' && candidate.id === org.coordinatorId);
}

export function isEligibleCoordinator(candidate: AssignableUser, auditEntityId: string): boolean {
  return candidate.status === 'active' && candidate.role === 'COORDINATOR' && candidate.auditEntityId === auditEntityId;
}

export type AssignmentError = 'ORG_HAS_OPEN_CAMPAIGNS' | 'COORDINATOR_REQUIRES_AUDIT_ENTITY' | 'AUDITOR_REQUIRES_AUDIT_ENTITY';

export type AssignmentPlan =
  | {
      ok: true;
      assignment: OrganizationAssignment;
      /** Open campaigns of the organization move to this auditor (same audit entity). */
      transferCampaignsTo: string | null;
    }
  | { ok: false; error: AssignmentError };

/**
 * Computes the new assignment of an organization. `undefined` keeps the current value.
 * - Changing the audit entity clears coordinator and auditor (unless given) and is refused while the
 *   organization has open campaigns with the current entity.
 * - Changing the auditor moves the open campaigns to the new auditor; removing the auditor is refused
 *   while there are open campaigns.
 */
export function planAssignmentChange(
  current: OrganizationAssignment,
  next: Partial<OrganizationAssignment>,
  openCampaigns: number,
): AssignmentPlan {
  const auditEntityId = next.auditEntityId !== undefined ? next.auditEntityId : current.auditEntityId;
  const entityChanged = auditEntityId !== current.auditEntityId;
  if (entityChanged && openCampaigns > 0) return { ok: false, error: 'ORG_HAS_OPEN_CAMPAIGNS' };
  const coordinatorId = next.coordinatorId !== undefined ? next.coordinatorId : entityChanged ? null : current.coordinatorId;
  const auditorId = next.auditorId !== undefined ? next.auditorId : entityChanged ? null : current.auditorId;
  if (auditEntityId === null && coordinatorId !== null) return { ok: false, error: 'COORDINATOR_REQUIRES_AUDIT_ENTITY' };
  if (auditEntityId === null && auditorId !== null) return { ok: false, error: 'AUDITOR_REQUIRES_AUDIT_ENTITY' };
  const auditorChanged = !entityChanged && auditorId !== current.auditorId;
  if (auditorChanged && auditorId === null && openCampaigns > 0) return { ok: false, error: 'ORG_HAS_OPEN_CAMPAIGNS' };
  return {
    ok: true,
    assignment: { auditEntityId, coordinatorId, auditorId },
    transferCampaignsTo: auditorChanged ? auditorId : null,
  };
}
