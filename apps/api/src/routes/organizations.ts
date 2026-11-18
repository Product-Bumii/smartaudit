import { Router } from 'express';
import {
  assignedOrganizationListQuerySchema,
  auditorAssignmentSchema,
  canAssignAuditor,
  organizationListQuerySchema,
  searchPattern,
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

/** Organization names sort and compare ignoring case and accents. */
const COLLATION = { locale: 'es', strength: 1 } as const;

/** One page of organizations matching `filter` and the free-text query. */
async function pageOfOrganizations(
  filter: Record<string, unknown>,
  q: { q?: string; page: number; pageSize: number; sort: string; dir?: 'asc' | 'desc' },
): Promise<{ orgs: OrganizationDoc[]; total: number }> {
  const pattern = searchPattern(q.q);
  const where = pattern ? { ...filter, name: { $regex: pattern, $options: 'i' } } : filter;
  const dir = (q.dir ?? (q.sort === 'createdAt' ? 'desc' : 'asc')) === 'asc' ? 1 : -1;
  const [orgs, total] = await Promise.all([
    Organization.find(where)
      .collation(COLLATION)
      .sort({ [q.sort]: dir, ...(q.sort === 'name' ? {} : { name: 1 }), _id: 1 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .lean(),
    Organization.countDocuments(where),
  ]);
  return { orgs: orgs as OrganizationDoc[], total };
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
  r.get('/', requireAction('organization.manage'), async (req, res) => {
    const q = organizationListQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (q.auditEntityId) filter.auditEntityId = q.auditEntityId === 'none' ? null : q.auditEntityId;
    if (q.status) filter.status = q.status;
    const { orgs, total } = await pageOfOrganizations(filter, q);
    res.json({ items: await toOrganizationDtos(ctx, orgs), total, page: q.page, pageSize: q.pageSize });
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
    const q = assignedOrganizationListQuerySchema.parse(req.query);
    const or: Record<string, unknown>[] = [{ auditorId: user.id }];
    if (user.role === 'COORDINATOR') or.push({ coordinatorId: user.id });
    const { orgs, total } = await pageOfOrganizations({ auditEntityId: user.auditEntityId, $or: or }, q);
    const dtos = await toOrganizationDtos(ctx, orgs);
    res.json({
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: dtos.map((o, i) => ({
        ...o,
        coordinates: user.role === 'COORDINATOR' && String(orgs[i].coordinatorId) === user.id,
        audits: String(orgs[i].auditorId) === user.id,
      })),
    });
  });
  return r;
}
