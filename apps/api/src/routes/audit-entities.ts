import { Router, type Request } from 'express';
import {
  auditEntityCreateSchema,
  auditEntityUpdateSchema,
  objectIdSchema,
  userCreateSchema,
  userStatusSchema,
  type AuditEntityDto,
  type Role,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';
import { requireAction, requireEntityParam } from '../middleware/auth';
import { AuditEntity, Organization, User, type AuditEntityDoc, type UserDoc } from '../models';
import { createUser, toUserDto } from '../services/users';

const toAuditEntityDto = (e: AuditEntityDoc): AuditEntityDto => ({
  id: String(e._id),
  name: e.name,
  country: e.country ?? null,
  status: e.status as AuditEntityDto['status'],
});

async function findEntity(id: string): Promise<AuditEntityDoc> {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const entity = await AuditEntity.findById(parsed.data).lean();
  if (!entity) throw notFound();
  return entity as AuditEntityDoc;
}

/** Audit entities (certification bodies), their coordinators (superadmins) and auditors (superadmins + coordinator). */
export function auditEntitiesRouter(ctx: AppContext): Router {
  const r = Router();

  r.get('/', requireAction('auditEntity.manage'), async (_req, res) => {
    const entities = (await AuditEntity.find().sort({ name: 1 }).lean()) as AuditEntityDoc[];
    const [users, orgs] = await Promise.all([
      User.aggregate<{ _id: { e: unknown; r: string }; n: number }>([
        { $match: { auditEntityId: { $ne: null }, status: 'active' } },
        { $group: { _id: { e: '$auditEntityId', r: '$role' }, n: { $sum: 1 } } },
      ]),
      Organization.aggregate<{ _id: unknown; n: number }>([{ $match: { auditEntityId: { $ne: null } } }, { $group: { _id: '$auditEntityId', n: { $sum: 1 } } }]),
    ]);
    const count = (id: string, role: Role) => users.find((u) => String(u._id.e) === id && u._id.r === role)?.n ?? 0;
    res.json({
      items: entities.map((e) => ({
        ...toAuditEntityDto(e),
        coordinators: count(String(e._id), 'COORDINATOR'),
        auditors: count(String(e._id), 'AUDITOR'),
        organizations: orgs.find((o) => String(o._id) === String(e._id))?.n ?? 0,
      })),
    });
  });

  r.post('/', requireAction('auditEntity.manage'), async (req, res) => {
    const { coordinatorEmail, ...input } = auditEntityCreateSchema.parse(req.body);
    const entity = await AuditEntity.create({ ...input, createdBy: req.user!.id });
    await audit(req, { action: 'auditEntity.create', resourceType: 'auditEntity', resourceId: String(entity._id), auditEntityId: String(entity._id) });
    let coordinator = null;
    if (coordinatorEmail) {
      coordinator = await createUser(ctx, {
        email: coordinatorEmail,
        role: 'COORDINATOR',
        auditEntityId: entity._id,
        auditEntityName: entity.name,
        createdBy: req.user!.id,
      });
      await audit(req, { action: 'user.create', resourceType: 'user', resourceId: String(coordinator._id), auditEntityId: String(entity._id), meta: { role: 'COORDINATOR' } });
    }
    res.status(201).json({ auditEntity: toAuditEntityDto(entity.toObject() as AuditEntityDoc), coordinator: coordinator ? toUserDto(ctx, coordinator.toObject()) : null });
  });

  r.get('/:entityId', requireAction('auditEntity.manage'), async (req, res) => {
    res.json({ auditEntity: toAuditEntityDto(await findEntity(String(req.params.entityId))) });
  });

  r.patch('/:entityId', requireAction('auditEntity.manage'), async (req, res) => {
    const input = auditEntityUpdateSchema.parse(req.body);
    const entity = await findEntity(String(req.params.entityId));
    const updated = await AuditEntity.findByIdAndUpdate(entity._id, { $set: input }, { new: true }).lean();
    await audit(req, { action: 'auditEntity.update', resourceType: 'auditEntity', resourceId: String(entity._id), auditEntityId: String(entity._id), meta: { fields: Object.keys(input) } });
    res.json({ auditEntity: toAuditEntityDto(updated as AuditEntityDoc) });
  });

  // ---------- Users of the entity: COORDINATOR (superadmins) and AUDITOR (superadmins + its coordinators)
  const userRoutes = (path: 'coordinators' | 'auditors', role: Role, action: 'coordinator.manage' | 'auditor.manage') => {
    const guard = [requireAction(action), requireEntityParam];

    r.get(`/:entityId/${path}`, ...guard, async (req, res) => {
      const entity = await findEntity(String(req.params.entityId));
      const users = await User.find({ auditEntityId: entity._id, role }).sort({ createdAt: 1 }).lean();
      res.json({ items: users.map((u) => toUserDto(ctx, u as UserDoc)) });
    });

    r.post(`/:entityId/${path}`, ...guard, async (req, res) => {
      const entity = await findEntity(String(req.params.entityId));
      const input = userCreateSchema.parse(req.body);
      const user = await createUser(ctx, {
        email: input.email,
        role,
        auditEntityId: entity._id,
        auditEntityName: entity.name,
        preferredLanguage: input.preferredLanguage,
        createdBy: req.user!.id,
      });
      await audit(req, { action: 'user.create', resourceType: 'user', resourceId: String(user._id), auditEntityId: String(entity._id), meta: { role } });
      res.status(201).json({ user: toUserDto(ctx, user.toObject()) });
    });

    r.patch(`/:entityId/${path}/:userId`, ...guard, async (req: Request, res) => {
      const entity = await findEntity(String(req.params.entityId));
      const { status } = userStatusSchema.parse(req.body);
      const userId = objectIdSchema.safeParse(req.params.userId);
      if (!userId.success) throw notFound();
      const user = await User.findOneAndUpdate({ _id: userId.data, auditEntityId: entity._id, role }, { $set: { status } }, { new: true }).lean();
      if (!user) throw notFound();
      await audit(req, { action: 'user.status', resourceType: 'user', resourceId: String(user._id), auditEntityId: String(entity._id), meta: { role, status } });
      res.json({ user: toUserDto(ctx, user as UserDoc) });
    });
  };

  userRoutes('coordinators', 'COORDINATOR', 'coordinator.manage');
  userRoutes('auditors', 'AUDITOR', 'auditor.manage');

  return r;
}
