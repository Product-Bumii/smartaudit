import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { can, isSuperadmin, type Action, type Language, type Role } from '@smartaudit/shared';
import type { AppContext } from '../context';
import { forbidden, notFound, unauthorized } from '../lib/errors';
import { AuditEntity, User } from '../models';

export const SESSION_COOKIE = 'sa_session';
export const SELECT_COOKIE = 'sa_select';
/** Re-issue the session when it is older than this (sliding 8 h session). */
const RENEW_AFTER_SECONDS = 15 * 60;

export interface AuthUser {
  id: string;
  role: Role;
  /** Audit entity of coordinators and auditors; `null` for superadmins. */
  auditEntityId: string | null;
  auditEntityName: string | null;
  emailEncrypted: string;
  preferredLanguage: Language;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const cookieOptions = (ctx: AppContext, maxAgeMs: number) => ({
  httpOnly: true,
  secure: ctx.config.cookieSecure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeMs,
});

export function issueSession(ctx: AppContext, res: Response, userId: string): void {
  const token = jwt.sign({ purpose: 'session' }, ctx.config.jwtSecret, {
    subject: userId,
    expiresIn: `${ctx.config.sessionHours}h`,
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(ctx, ctx.config.sessionHours * 3600_000));
}

export function clearSession(ctx: AppContext, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(ctx, 0), maxAge: undefined });
}

/** Short-lived proof that a magic link was used and which accounts it may enter. */
export function issueSelection(ctx: AppContext, res: Response, userIds: string[]): void {
  const token = jwt.sign({ purpose: 'select', userIds }, ctx.config.jwtSecret, { expiresIn: '10m' });
  res.cookie(SELECT_COOKIE, token, cookieOptions(ctx, 10 * 60_000));
}

export function readSelection(ctx: AppContext, req: Request): string[] | null {
  const raw = req.cookies?.[SELECT_COOKIE];
  if (!raw) return null;
  try {
    const p = jwt.verify(raw, ctx.config.jwtSecret) as { purpose?: string; userIds?: string[] };
    return p.purpose === 'select' && Array.isArray(p.userIds) ? p.userIds : null;
  } catch {
    return null;
  }
}

export function clearSelection(ctx: AppContext, res: Response): void {
  res.clearCookie(SELECT_COOKIE, { ...cookieOptions(ctx, 0), maxAge: undefined });
}

/** Loads an active user (and its active audit entity) as an AuthUser, or null. */
export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await User.findById(userId).lean();
  if (!user || user.status !== 'active') return null;
  let auditEntityName: string | null = null;
  if (user.auditEntityId) {
    const entity = await AuditEntity.findById(user.auditEntityId).lean();
    if (!entity || entity.status !== 'active') return null;
    auditEntityName = entity.name;
  }
  return {
    id: String(user._id),
    role: user.role as Role,
    auditEntityId: user.auditEntityId ? String(user.auditEntityId) : null,
    auditEntityName,
    emailEncrypted: user.emailEncrypted,
    preferredLanguage: user.preferredLanguage as Language,
  };
}

/** Reads the session cookie if present; never fails (use `requireAuth` to enforce). */
export function authenticate(ctx: AppContext): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) return next();
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(raw, ctx.config.jwtSecret) as jwt.JwtPayload;
    } catch {
      clearSession(ctx, res);
      return next();
    }
    if (payload.purpose !== 'session' || !payload.sub) return next();
    const user = await loadAuthUser(payload.sub);
    if (!user) {
      clearSession(ctx, res);
      return next();
    }
    req.user = user;
    if (payload.iat && Date.now() / 1000 - payload.iat > RENEW_AFTER_SECONDS) issueSession(ctx, res, user.id);
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

/** Role-level permission check from the shared matrix. */
export const requireAction =
  (action: Action): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, action)) return next(forbidden());
    next();
  };

/**
 * Audit entity isolation: superadmins may access any audit entity; coordinators and auditors only their own.
 * Responds 404 (not 403) for other entities so their existence is not disclosed.
 */
export function assertEntityAccess(user: AuthUser, auditEntityId: string): void {
  if (isSuperadmin(user.role)) return;
  if (user.auditEntityId !== auditEntityId) throw notFound();
}

export const requireEntityParam: RequestHandler = (req, _res, next) => {
  try {
    assertEntityAccess(req.user as AuthUser, String(req.params.entityId));
    next();
  } catch (e) {
    next(e);
  }
};
