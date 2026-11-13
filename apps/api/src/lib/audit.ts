import type { Request } from 'express';
import { AuditLog } from '../models';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  organizationId?: string | null;
  /** Non-personal metadata only. */
  meta?: Record<string, unknown>;
}

/** Records an administrative action, configuration change, export or access to individual data. */
export async function audit(req: Request, entry: AuditEntry): Promise<void> {
  await AuditLog.create({
    actorId: req.user?.id ?? null,
    actorRole: req.user?.role ?? null,
    organizationId: entry.organizationId ?? req.user?.organizationId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    meta: entry.meta ?? {},
    ip: req.ip ?? null,
    at: new Date(),
  });
}
