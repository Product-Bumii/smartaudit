import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { renderTemplate } from '@smartaudit/mail';
import {
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  selectAccountSchema,
  userPreferencesSchema,
  type AccountChoice,
  type Language,
  type Role,
  type SessionUser,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { audit } from '../lib/audit';
import { randomToken, sha256 } from '../lib/crypto';
import { unauthorized } from '../lib/errors';
import {
  clearSelection,
  clearSession,
  issueSelection,
  issueSession,
  loadAuthUser,
  readSelection,
  requireAuth,
  type AuthUser,
} from '../middleware/auth';
import { AuditEntity, getSettings, MagicLinkToken, User } from '../models';

export function toSessionUser(ctx: AppContext, u: AuthUser): SessionUser {
  return {
    id: u.id,
    role: u.role,
    auditEntityId: u.auditEntityId,
    auditEntityName: u.auditEntityName,
    email: ctx.crypto.decrypt(u.emailEncrypted),
    preferredLanguage: u.preferredLanguage,
  };
}

const RATE_WINDOW_MS = 15 * 60_000;

export function authRouter(ctx: AppContext): Router {
  const r = Router();
  const limiterError = { error: { code: 'RATE_LIMITED', message: 'RATE_LIMITED' } };

  const perIp = rateLimit({ windowMs: RATE_WINDOW_MS, limit: ctx.rateLimits.magicLinkPerIp, standardHeaders: 'draft-8', legacyHeaders: false, message: limiterError });
  const perEmail = rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: ctx.rateLimits.magicLinkPerEmail,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: limiterError,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `email:${ctx.crypto.hash(email)}`;
    },
  });
  const verifyLimiter = rateLimit({ windowMs: RATE_WINDOW_MS, limit: ctx.rateLimits.verifyPerIp, standardHeaders: 'draft-8', legacyHeaders: false, message: limiterError });

  /**
   * Always answers 202 (does not reveal whether the email has an account).
   * Test environments only (DEV_SHOW_MAGIC_LINK): the link is also returned as `devLink`.
   */
  r.post('/magic-link', perIp, perEmail, async (req, res) => {
    const { email, language } = magicLinkRequestSchema.parse(req.body);
    const users = await User.find({ emailHash: ctx.crypto.hash(email), status: 'active' }).lean();
    const entityIds = users.filter((u) => u.auditEntityId).map((u) => u.auditEntityId);
    const activeEntities = new Set(
      (await AuditEntity.find({ _id: { $in: entityIds }, status: 'active' }, { _id: 1 }).lean()).map((e) => String(e._id)),
    );
    const eligible = users.filter((u) => !u.auditEntityId || activeEntities.has(String(u.auditEntityId)));
    let devLink: string | undefined;
    if (eligible.length > 0) {
      const token = randomToken(32);
      await MagicLinkToken.create({
        tokenHash: sha256(token),
        userIds: eligible.map((u) => u._id),
        expiresAt: new Date(ctx.now().getTime() + ctx.config.magicLinkMinutes * 60_000),
      });
      const lang = (language ?? eligible[0].preferredLanguage) as Language;
      const settings = await getSettings();
      const url = `${ctx.config.appUrl}/auth/verify?token=${token}`;
      if (ctx.config.devShowMagicLink) devLink = url;
      const mail = renderTemplate(
        'magic_link',
        lang,
        { url, minutes: String(ctx.config.magicLinkMinutes) },
        settings.mailTemplates ?? {},
      );
      await ctx.mail
        .send({ to: email, ...mail, from: { name: settings.mailFromName, address: settings.mailFromAddress } })
        .catch((err: Error) => {
          // Without email integration the on-screen link still works in test environments.
          if (!ctx.config.devShowMagicLink) throw err;
          ctx.logger.warn({ err: err.message }, 'magic link email failed (dev link shown on screen)');
        });
    }
    res.status(202).json(devLink ? { ok: true, devLink } : { ok: true });
  });

  /** Consumes a magic link (single use). One account → session; several (one per audit entity) → account selection. */
  r.post('/verify', verifyLimiter, async (req, res) => {
    const { token } = magicLinkVerifySchema.parse(req.body);
    const record = await MagicLinkToken.findOneAndUpdate(
      { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: ctx.now() } },
      { $set: { usedAt: ctx.now() } },
      { new: true },
    ).lean();
    if (!record) throw unauthorized('INVALID_OR_EXPIRED_LINK');

    const accounts = (await Promise.all(record.userIds.map((id) => loadAuthUser(String(id))))).filter(
      (u): u is AuthUser => u !== null,
    );
    if (accounts.length === 0) throw unauthorized('INVALID_OR_EXPIRED_LINK');
    if (accounts.length === 1) {
      const user = accounts[0];
      issueSession(ctx, res, user.id);
      await User.updateOne({ _id: user.id }, { $set: { lastLoginAt: ctx.now() } });
      req.user = user;
      await audit(req, { action: 'auth.login', resourceType: 'user', resourceId: user.id });
      res.json({ status: 'authenticated', user: toSessionUser(ctx, user) });
      return;
    }
    issueSelection(ctx, res, accounts.map((a) => a.id));
    const choices: AccountChoice[] = accounts.map((a) => ({
      userId: a.id,
      role: a.role as Role,
      auditEntityId: a.auditEntityId,
      auditEntityName: a.auditEntityName,
    }));
    res.json({ status: 'select_account', accounts: choices });
  });

  /** Lists the accounts the pending selection allows (page reload during selection). */
  r.get('/accounts', verifyLimiter, async (req, res) => {
    const allowed = readSelection(ctx, req);
    if (!allowed) throw unauthorized('SELECTION_EXPIRED');
    const accounts = (await Promise.all(allowed.map((id) => loadAuthUser(id)))).filter((u): u is AuthUser => u !== null);
    res.json({
      accounts: accounts.map((a) => ({ userId: a.id, role: a.role, auditEntityId: a.auditEntityId, auditEntityName: a.auditEntityName })),
    });
  });

  r.post('/select', verifyLimiter, async (req, res) => {
    const { userId } = selectAccountSchema.parse(req.body);
    const allowed = readSelection(ctx, req);
    if (!allowed || !allowed.includes(userId)) throw unauthorized('SELECTION_EXPIRED');
    const user = await loadAuthUser(userId);
    if (!user) throw unauthorized('SELECTION_EXPIRED');
    clearSelection(ctx, res);
    issueSession(ctx, res, user.id);
    await User.updateOne({ _id: user.id }, { $set: { lastLoginAt: ctx.now() } });
    req.user = user;
    await audit(req, { action: 'auth.login', resourceType: 'user', resourceId: user.id, meta: { viaSelection: true } });
    res.json({ status: 'authenticated', user: toSessionUser(ctx, user) });
  });

  r.get('/me', requireAuth, (req, res) => {
    res.json({ user: toSessionUser(ctx, req.user as AuthUser) });
  });

  r.patch('/me', requireAuth, async (req, res) => {
    const { preferredLanguage } = userPreferencesSchema.parse(req.body);
    await User.updateOne({ _id: req.user!.id }, { $set: { preferredLanguage } });
    res.json({ user: { ...toSessionUser(ctx, req.user as AuthUser), preferredLanguage } });
  });

  r.post('/logout', (_req, res) => {
    clearSession(ctx, res);
    clearSelection(ctx, res);
    res.json({ ok: true });
  });

  return r;
}
