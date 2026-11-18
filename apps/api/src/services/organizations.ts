import type { Request } from 'express';
import {
  CLOSED_CAMPAIGN_STATUSES,
  isEligibleAuditor,
  isEligibleCoordinator,
  planAssignmentChange,
  type OrganizationAssignment,
  type OrganizationDto,
  type Role,
} from '@smartaudit/shared';
import type { Types } from 'mongoose';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { conflict, notFound, unprocessable } from '../lib/errors';
import { AuditEntity, Campaign, Organization, User, type OrganizationDoc, type UserDoc } from '../models';
import { toUserRef } from './users';

const idOrNull = (v: Types.ObjectId | null | undefined) => (v ? String(v) : null);

export const assignmentOf = (o: OrganizationDoc): OrganizationAssignment => ({
  auditEntityId: idOrNull(o.auditEntityId),
  coordinatorId: idOrNull(o.coordinatorId),
  auditorId: idOrNull(o.auditorId),
});

/** DTOs with the assignment resolved (entity name, coordinator and auditor emails). */
export async function toOrganizationDtos(ctx: AppContext, orgs: OrganizationDoc[]): Promise<OrganizationDto[]> {
  const entityIds = orgs.map((o) => o.auditEntityId).filter(Boolean);
  const userIds = orgs.flatMap((o) => [o.coordinatorId, o.auditorId]).filter(Boolean);
  const [entities, users] = await Promise.all([
    AuditEntity.find({ _id: { $in: entityIds } }, { name: 1 }).lean(),
    User.find({ _id: { $in: userIds } }).lean(),
  ]);
  const entityById = new Map(entities.map((e) => [String(e._id), e]));
  const userById = new Map(users.map((u) => [String(u._id), u as UserDoc]));
  return orgs.map((o) => {
    const entity = o.auditEntityId ? entityById.get(String(o.auditEntityId)) : undefined;
    return {
      id: String(o._id),
      name: o.name,
      country: o.country,
      timeZone: o.timeZone,
      defaultLanguage: o.defaultLanguage as OrganizationDto['defaultLanguage'],
      status: o.status as OrganizationDto['status'],
      auditEntity: entity ? { id: String(entity._id), name: entity.name } : null,
      coordinator: toUserRef(ctx, o.coordinatorId ? userById.get(String(o.coordinatorId)) : null),
      auditor: toUserRef(ctx, o.auditorId ? userById.get(String(o.auditorId)) : null),
    };
  });
}

export const toOrganizationDto = async (ctx: AppContext, o: OrganizationDoc) => (await toOrganizationDtos(ctx, [o]))[0];

const asCandidate = (u: UserDoc) => ({
  id: String(u._id),
  role: u.role as Role,
  auditEntityId: idOrNull(u.auditEntityId),
  status: u.status as 'active' | 'inactive',
});

/** Users that may be designated auditor of the organization. */
export async function assignableAuditors(org: OrganizationDoc): Promise<UserDoc[]> {
  if (!org.auditEntityId) return [];
  const users = (await User.find({ auditEntityId: org.auditEntityId, role: { $in: ['AUDITOR', 'COORDINATOR'] } }).sort({ createdAt: 1 }).lean()) as UserDoc[];
  return users.filter((u) => isEligibleAuditor(asCandidate(u), assignmentOf(org)));
}

/**
 * Applies an assignment change (shared rules in `planAssignmentChange`): validates the candidates,
 * moves open campaigns to a new auditor, keeps the history and records it in the audit log.
 */
export async function changeAssignment(req: Request, org: OrganizationDoc, next: Partial<OrganizationAssignment>): Promise<OrganizationDoc> {
  const current = assignmentOf(org);
  const openCampaigns = current.auditEntityId
    ? await Campaign.countDocuments({ organizationId: org._id, auditEntityId: current.auditEntityId, status: { $nin: CLOSED_CAMPAIGN_STATUSES } })
    : 0;
  const plan = planAssignmentChange(current, next, openCampaigns);
  if (!plan.ok) throw plan.error === 'ORG_HAS_OPEN_CAMPAIGNS' ? conflict(plan.error, { openCampaigns }) : unprocessable(plan.error);
  const { assignment } = plan;

  if (assignment.auditEntityId && assignment.auditEntityId !== current.auditEntityId) {
    const entity = await AuditEntity.findById(assignment.auditEntityId).lean();
    if (!entity || entity.status !== 'active') throw unprocessable('INVALID_AUDIT_ENTITY');
  }
  if (assignment.coordinatorId && assignment.coordinatorId !== current.coordinatorId) {
    const u = await User.findById(assignment.coordinatorId).lean();
    if (!u || !isEligibleCoordinator(asCandidate(u as UserDoc), assignment.auditEntityId!)) throw unprocessable('INVALID_COORDINATOR');
  }
  if (assignment.auditorId && assignment.auditorId !== current.auditorId) {
    const u = await User.findById(assignment.auditorId).lean();
    if (!u || !isEligibleAuditor(asCandidate(u as UserDoc), assignment)) throw unprocessable('INVALID_AUDITOR');
  }

  const by = req.user?.id ?? null;
  const updated = await Organization.findByIdAndUpdate(
    org._id,
    { $set: assignment, $push: { assignmentHistory: { ...assignment, at: new Date(), by } } },
    { new: true },
  ).lean();
  if (!updated) throw notFound();

  let transferred = 0;
  if (plan.transferCampaignsTo) {
    const res = await Campaign.updateMany(
      { organizationId: org._id, auditEntityId: assignment.auditEntityId, status: { $nin: CLOSED_CAMPAIGN_STATUSES } },
      { $set: { 'm1Config.leadAuditorId': plan.transferCampaignsTo } },
    );
    transferred = res.modifiedCount;
  }
  await audit(req, {
    action: 'organization.assignment',
    resourceType: 'organization',
    resourceId: String(org._id),
    organizationId: String(org._id),
    auditEntityId: assignment.auditEntityId ?? current.auditEntityId,
    meta: { from: current, to: assignment, transferredCampaigns: transferred },
  });
  return updated as OrganizationDoc;
}
