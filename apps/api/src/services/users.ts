import { renderTemplate } from '@smartaudit/mail';
import type { Language, Role, UserDto } from '@smartaudit/shared';
import type { Types } from 'mongoose';
import type { AppContext } from '../context';
import { conflict } from '../lib/errors';
import { getSettings, User, type UserDoc } from '../models';

const ROLE_LABELS: Record<Language, Record<Role, string>> = {
  es: { SUPERADMIN_BUMII: 'superadministración (Bumii)', SUPERADMIN_FUNDACION: 'superadministración (Fundación)', ORG_ADMIN: 'administración de la organización', AUDITOR: 'auditoría' },
  en: { SUPERADMIN_BUMII: 'superadmin (Bumii)', SUPERADMIN_FUNDACION: 'superadmin (Fundación)', ORG_ADMIN: 'organization admin', AUDITOR: 'auditor' },
  ca: { SUPERADMIN_BUMII: 'superadministració (Bumii)', SUPERADMIN_FUNDACION: 'superadministració (Fundació)', ORG_ADMIN: "administració de l'organització", AUDITOR: 'auditoria' },
  pt: { SUPERADMIN_BUMII: 'superadministração (Bumii)', SUPERADMIN_FUNDACION: 'superadministração (Fundação)', ORG_ADMIN: 'administração da organização', AUDITOR: 'auditoria' },
  fr: { SUPERADMIN_BUMII: 'superadministration (Bumii)', SUPERADMIN_FUNDACION: 'superadministration (Fondation)', ORG_ADMIN: "administration de l'organisation", AUDITOR: 'audit' },
};

export function toUserDto(ctx: AppContext, u: UserDoc): UserDto {
  return {
    id: String(u._id),
    email: ctx.crypto.decrypt(u.emailEncrypted),
    role: u.role as Role,
    organizationId: u.organizationId ? String(u.organizationId) : null,
    status: u.status as UserDto['status'],
    preferredLanguage: u.preferredLanguage as Language,
  };
}

export interface CreateUserInput {
  email: string;
  role: Role;
  organizationId: Types.ObjectId | string | null;
  organizationName?: string | null;
  preferredLanguage?: Language;
  createdBy?: string | null;
  notify?: boolean;
}

/** Creates an internal user with encrypted email. One account per (email, organization). */
export async function createUser(ctx: AppContext, input: CreateUserInput) {
  const emailHash = ctx.crypto.hash(input.email);
  const exists = await User.exists({ emailHash, organizationId: input.organizationId ?? null });
  if (exists) throw conflict('USER_ALREADY_EXISTS');
  const lang = input.preferredLanguage ?? 'es';
  const user = await User.create({
    emailEncrypted: ctx.crypto.encrypt(input.email),
    emailHash,
    role: input.role,
    organizationId: input.organizationId ?? null,
    preferredLanguage: lang,
    createdBy: input.createdBy ?? null,
  });
  if (input.notify !== false) {
    const settings = await getSettings();
    const mail = renderTemplate(
      'account_created',
      lang,
      { role: ROLE_LABELS[lang][input.role], organization: input.organizationName ?? 'SmartAudit efr', url: `${ctx.config.appUrl}/login` },
      settings.mailTemplates ?? {},
    );
    await ctx.mail
      .send({ to: input.email, ...mail, from: { name: settings.mailFromName, address: settings.mailFromAddress } })
      .catch((err: Error) => ctx.logger.warn({ err: err.message, userId: String(user._id) }, 'account email failed'));
  }
  return user;
}
