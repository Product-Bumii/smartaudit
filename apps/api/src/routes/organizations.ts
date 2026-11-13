import { Router, type Request } from 'express';
import {
  objectIdSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  userCreateSchema,
  userStatusSchema,
  type OrganizationDto,
  type Role,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { requireAction, requireOrgParam } from '../middleware/auth';
import { Organization, User, type OrganizationDoc, type UserDoc } from '../models';
import { createUser, toUserDto } from '../services/users';

export const toOrganizationDto = (o: OrganizationDoc): OrganizationDto => ({
  id: String(o._id),
  name: o.name,
  country: o.country,
  timeZone: o.timeZone,
  defaultLanguage: o.defaultLanguage as OrganizationDto['defaultLanguage'],
  status: o.status as OrganizationDto['status'],
});

async function findOrg(id: string) {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const org = await Organization.findById(parsed.data).lean();
  if (!org) throw notFound();
  return org;
}

export function organizationsRouter(ctx: AppContext): Router {
  const r = Router();

  // ---------- Organizations (superadmins)
  r.get('/', requireAction('organization.manage'), async (_req, res) => {
    const orgs = await Organization.find().sort({ name: 1 }).lean();
    res.json({ items: orgs.map(toOrganizationDto) });
  });

  r.post('/', requireAction('organization.manage'), async (req, res) => {
    const input = organizationCreateSchema.parse(req.body);
    const org = await Organization.create({ ...input, adminEmail: undefined, createdBy: req.user!.id });
    await audit(req, { action: 'organization.create', resourceType: 'organization', resourceId: String(org._id), organizationId: String(org._id) });
    let admin = null;
    if (input.adminEmail) {
      admin = await createUser(ctx, {
        email: input.adminEmail,
        role: 'ORG_ADMIN',
        organizationId: org._id,
        organizationName: org.name,
        preferredLanguage: input.defaultLanguage,
        createdBy: req.user!.id,
      });
      await audit(req, { action: 'user.create', resourceType: 'user', resourceId: String(admin._id), organizationId: String(org._id), meta: { role: 'ORG_ADMIN' } });
    }
    res.status(201).json({ organization: toOrganizationDto(org.toObject()), admin: admin ? toUserDto(ctx, admin.toObject()) : null });
  });

  r.get('/:orgId', requireAction('organization.manage'), async (req, res) => {
    res.json({ organization: toOrganizationDto(await findOrg(String(req.params.orgId))) });
  });

  r.patch('/:orgId', requireAction('organization.manage'), async (req, res) => {
    const input = organizationUpdateSchema.parse(req.body);
    const org = await findOrg(String(req.params.orgId));
    const updated = await Organization.findByIdAndUpdate(org._id, { $set: input }, { new: true }).lean();
    await audit(req, { action: 'organization.update', resourceType: 'organization', resourceId: String(org._id), organizationId: String(org._id), meta: { fields: Object.keys(input) } });
    res.json({ organization: toOrganizationDto(updated!) });
  });

  // ---------- Org users: ORG_ADMIN (managed by superadmins) and AUDITOR (superadmins + ORG_ADMIN)
  const userRoutes = (path: 'admins' | 'auditors', role: Role, action: 'orgAdmin.manage' | 'auditor.manage') => {
    const guard = [requireAction(action), requireOrgParam];

    r.get(`/:orgId/${path}`, ...guard, async (req, res) => {
      const org = await findOrg(String(req.params.orgId));
      const users = await User.find({ organizationId: org._id, role }).sort({ createdAt: 1 }).lean();
      res.json({ items: users.map((u) => toUserDto(ctx, u as UserDoc)) });
    });

    r.post(`/:orgId/${path}`, ...guard, async (req, res) => {
      const org = await findOrg(String(req.params.orgId));
      const input = userCreateSchema.parse(req.body);
      const user = await createUser(ctx, {
        email: input.email,
        role,
        organizationId: org._id,
        organizationName: org.name,
        preferredLanguage: input.preferredLanguage ?? (org.defaultLanguage as 'es'),
        createdBy: req.user!.id,
      });
      await audit(req, { action: 'user.create', resourceType: 'user', resourceId: String(user._id), organizationId: String(org._id), meta: { role } });
      res.status(201).json({ user: toUserDto(ctx, user.toObject()) });
    });

    r.patch(`/:orgId/${path}/:userId`, ...guard, async (req: Request, res) => {
      const org = await findOrg(String(req.params.orgId));
      const { status } = userStatusSchema.parse(req.body);
      const userId = objectIdSchema.safeParse(req.params.userId);
      if (!userId.success) throw notFound();
      const user = await User.findOneAndUpdate(
        { _id: userId.data, organizationId: org._id, role },
        { $set: { status } },
        { new: true },
      ).lean();
      if (!user) throw notFound();
      await audit(req, { action: 'user.status', resourceType: 'user', resourceId: String(user._id), organizationId: String(org._id), meta: { role, status } });
      res.json({ user: toUserDto(ctx, user as UserDoc) });
    });
  };

  userRoutes('admins', 'ORG_ADMIN', 'orgAdmin.manage');
  userRoutes('auditors', 'AUDITOR', 'auditor.manage');

  return r;
}
