import { renderTemplate } from '@smartaudit/mail';
import type { Language, Role, UserDto } from '@smartaudit/shared';
import type { Types } from 'mongoose';
import type { AppContext } from '../context';
import { conflict } from '../lib/errors';
import { getSettings, User, type UserDoc } from '../models';

const ROLE_LABELS: Record<Language, Record<Role, string>> = {
  es: { SUPERADMIN_BUMII: 'superadministración (Bumii)', SUPERADMIN_FUNDACION: 'superadministración (Fundación)', COORDINATOR: 'coordinación de auditorías', AUDITOR: 'auditoría' },
  en: { SUPERADMIN_BUMII: 'superadmin (Bumii)', SUPERADMIN_FUNDACION: 'superadmin (Fundación)', COORDINATOR: 'audit coordinator', AUDITOR: 'auditor' },
  ca: { SUPERADMIN_BUMII: 'superadministració (Bumii)', SUPERADMIN_FUNDACION: 'superadministració (Fundació)', COORDINATOR: "coordinació d'auditories", AUDITOR: 'auditoria' },
  pt: { SUPERADMIN_BUMII: 'superadministração (Bumii)', SUPERADMIN_FUNDACION: 'superadministração (Fundação)', COORDINATOR: 'coordenação de auditorias', AUDITOR: 'auditoria' },
  fr: { SUPERADMIN_BUMII: 'superadministration (Bumii)', SUPERADMIN_FUNDACION: 'superadministration (Fondation)', COORDINATOR: 'coordination des audits', AUDITOR: 'audit' },
};

export function toUserDto(ctx: AppContext, u: UserDoc): UserDto {
  return {
    id: String(u._id),
    email: ctx.crypto.decrypt(u.emailEncrypted),
    role: u.role as Role,
    auditEntityId: u.auditEntityId ? String(u.auditEntityId) : null,
    status: u.status as UserDto['status'],
    preferredLanguage: u.preferredLanguage as Language,
  };
}

export interface CreateUserInput {
  email: string;
  role: Role;
  auditEntityId: Types.ObjectId | string | null;
  auditEntityName?: string | null;
  preferredLanguage?: Language;
  createdBy?: string | null;
  notify?: boolean;
}

/** Creates an internal user with encrypted email. One account per (email, audit entity). */
export async function createUser(ctx: AppContext, input: CreateUserInput) {
  const emailHash = ctx.crypto.hash(input.email);
  const exists = await User.exists({ emailHash, auditEntityId: input.auditEntityId ?? null });
  if (exists) throw conflict('USER_ALREADY_EXISTS');
  const lang = input.preferredLanguage ?? 'es';
  const user = await User.create({
    emailEncrypted: ctx.crypto.encrypt(input.email),
    emailHash,
    role: input.role,
    auditEntityId: input.auditEntityId ?? null,
    preferredLanguage: lang,
    createdBy: input.createdBy ?? null,
  });
  if (input.notify !== false) {
    const settings = await getSettings();
    const mail = renderTemplate(
      'account_created',
      lang,
      { role: ROLE_LABELS[lang][input.role], organization: input.auditEntityName ?? 'SmartAudit efr', url: `${ctx.config.appUrl}/login` },
      settings.mailTemplates ?? {},
    );
    await ctx.mail
      .send({ to: input.email, ...mail, from: { name: settings.mailFromName, address: settings.mailFromAddress } })
      .catch((err: Error) => ctx.logger.warn({ err: err.message, userId: String(user._id) }, 'account email failed'));
  }
  return user;
}

export const toUserRef = (ctx: AppContext, u: UserDoc | null | undefined) =>
  u ? { id: String(u._id), email: ctx.crypto.decrypt(u.emailEncrypted), role: u.role as Role, status: u.status as UserDto['status'] } : null;
