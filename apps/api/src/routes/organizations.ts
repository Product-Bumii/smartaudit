import { Router } from 'express';
import {
  auditorAssignmentSchema,
  canAssignAuditor,
  objectIdSchema,
  organizationAssignmentSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  type AccessUser,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { requireAction, type AuthUser } from '../middleware/auth';
import { Organization, type OrganizationDoc } from '../models';
import { assignableAuditors, assignmentOf, changeAssignment, toOrganizationDto, toOrganizationDtos } from '../services/organizations';
import { toUserDto } from '../services/users';

async function findOrg(id: string): Promise<OrganizationDoc> {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const org = await Organization.findById(parsed.data).lean();
  if (!org) throw notFound();
  return org as OrganizationDoc;
}

export const accessUser = (u: AuthUser): AccessUser => ({ id: u.id, role: u.role, auditEntityId: u.auditEntityId });

/** Organization the user may change the auditor of (superadmins, or its coordinator); 404 otherwise. */
async function findOrgForAuditorAssignment(user: AuthUser, id: string): Promise<OrganizationDoc> {
  const org = await findOrg(id);
  if (!canAssignAuditor(accessUser(user), assignmentOf(org))) throw notFound();
  return org;
}

export function organizationsRouter(ctx: AppContext): Router {
  const r = Router();

  // ---------- Organizations (superadmins)
  r.get('/', requireAction('organization.manage'), async (_req, res) => {
    const orgs = (await Organization.find().sort({ name: 1 }).lean()) as OrganizationDoc[];
    res.json({ items: await toOrganizationDtos(ctx, orgs) });
  });

  r.post('/', requireAction('organization.manage'), async (req, res) => {
    const { auditEntityId, coordinatorId, ...input } = organizationCreateSchema.parse(req.body);
    const created = await Organization.create({ ...input, createdBy: req.user!.id });
    await audit(req, { action: 'organization.create', resourceType: 'organization', resourceId: String(created._id), organizationId: String(created._id) });
    let org = created.toObject() as OrganizationDoc;
    if (auditEntityId || coordinatorId) {
      try {
        org = await changeAssignment(req, org, { auditEntityId: auditEntityId ?? null, coordinatorId: coordinatorId ?? null });
      } catch (e) {
        await created.deleteOne();
        throw e;
      }
    }
    res.status(201).json({ organization: await toOrganizationDto(ctx, org) });
  });

  r.get('/:orgId', requireAction('organization.manage'), async (req, res) => {
    res.json({ organization: await toOrganizationDto(ctx, await findOrg(String(req.params.orgId))) });
  });

  r.patch('/:orgId', requireAction('organization.manage'), async (req, res) => {
    const input = organizationUpdateSchema.parse(req.body);
    const org = await findOrg(String(req.params.orgId));
    const updated = await Organization.findByIdAndUpdate(org._id, { $set: input }, { new: true }).lean();
    await audit(req, { action: 'organization.update', resourceType: 'organization', resourceId: String(org._id), organizationId: String(org._id), meta: { fields: Object.keys(input) } });
    res.json({ organization: await toOrganizationDto(ctx, updated as OrganizationDoc) });
  });

  /** Superadmins: audit entity and coordinator. */
  r.put('/:orgId/assignment', requireAction('assignment.coordinator'), async (req, res) => {
    const input = organizationAssignmentSchema.parse(req.body);
    const org = await findOrg(String(req.params.orgId));
    res.json({ organization: await toOrganizationDto(ctx, await changeAssignment(req, org, input)) });
  });

  /** Coordinator of the organization (or superadmins): responsible auditor. */
  r.get('/:orgId/assignable-auditors', requireAction('assignment.auditor'), async (req, res) => {
    const org = await findOrgForAuditorAssignment(req.user as AuthUser, String(req.params.orgId));
    res.json({ items: (await assignableAuditors(org)).map((u) => toUserDto(ctx, u)) });
  });

  r.put('/:orgId/auditor', requireAction('assignment.auditor'), async (req, res) => {
    const { auditorId } = auditorAssignmentSchema.parse(req.body);
    const org = await findOrgForAuditorAssignment(req.user as AuthUser, String(req.params.orgId));
    res.json({ organization: await toOrganizationDto(ctx, await changeAssignment(req, org, { auditorId })) });
  });

  return r;
}

/** Coordinators and auditors: the organizations assigned to them. */
export function assignedOrganizationsRouter(ctx: AppContext): Router {
  const r = Router();
  r.get('/', requireAction('organization.viewAssigned'), async (req, res) => {
    const user = req.user as AuthUser;
    const or: Record<string, unknown>[] = [{ auditorId: user.id }];
    if (user.role === 'COORDINATOR') or.push({ coordinatorId: user.id });
    const orgs = (await Organization.find({ auditEntityId: user.auditEntityId, $or: or }).sort({ name: 1 }).lean()) as OrganizationDoc[];
    const dtos = await toOrganizationDtos(ctx, orgs);
    res.json({
      items: dtos.map((o, i) => ({
        ...o,
        coordinates: user.role === 'COORDINATOR' && String(orgs[i].coordinatorId) === user.id,
        audits: String(orgs[i].auditorId) === user.id,
      })),
    });
  });
  return r;
}
