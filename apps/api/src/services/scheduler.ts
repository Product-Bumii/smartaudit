/**
 * Campaign scheduler (section 5.4), run by the worker every minute (and on demand in local mode).
 * Idempotent: every send is recorded per person, so a tick can be repeated safely.
 * - `envios_activos` → `en_curso` when the window opens; `en_curso` → `finalizada` when it closes.
 * - Invitations when the window opens; reminders on business days 4 and 8 to whoever has not completed.
 * - Respects the daily sending cap (`settings.mailDailyLimit`) and retries failures with growing waits.
 * Logs never contain emails, tokens or codes.
 */
import { renderTemplate, type TemplateKey, type TemplateOverrides } from '@smartaudit/mail';
import {
  canTransition,
  isAvailableLanguage,
  scheduleDecision,
  sendKind,
  shouldRemind,
  type CampaignStatus,
  type Language,
  type RespondentStatus,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { Campaign, getSettings, Organization, ParticipantContact, Respondent, type CampaignDoc } from '../models';

const MAX_ATTEMPTS = 5;
const DATE_LOCALE: Record<Language, string> = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES', pt: 'pt-PT', fr: 'fr-FR' };

export interface SchedulerResult {
  transitions: { campaignId: string; to: CampaignStatus }[];
  sent: number;
  failed: number;
  capped: boolean;
}

/** Applies an automatic transition if still allowed (another tick or a person may have changed it). */
async function transition(ctx: AppContext, c: CampaignDoc, to: CampaignStatus, reason: string): Promise<boolean> {
  const from = c.status as CampaignStatus;
  if (!canTransition(from, to)) return false;
  const r = await Campaign.updateOne(
    { _id: c._id, status: from },
    { $set: { status: to }, $push: { statusHistory: { from, to, at: ctx.now(), by: null, reason } } },
  );
  return r.modifiedCount === 1;
}

async function sentInLastDay(now: Date): Promise<number> {
  const since = new Date(now.getTime() - 24 * 3600_000);
  const [r] = await ParticipantContact.aggregate<{ n: number }>([
    { $match: { 'sends.at': { $gte: since } } },
    { $unwind: '$sends' },
    { $match: { 'sends.at': { $gte: since } } },
    { $count: 'n' },
  ]);
  return r?.n ?? 0;
}

/** Waits 2^n minutes after the n-th failure; gives up after MAX_ATTEMPTS. */
const mayRetry = (failures: { kind?: string | null; at?: Date | null }[], kind: string, now: Date): boolean => {
  const mine = failures.filter((f) => f.kind === kind);
  if (mine.length === 0) return true;
  if (mine.length >= MAX_ATTEMPTS) return false;
  const last = Math.max(...mine.map((f) => new Date(f.at!).getTime()));
  return now.getTime() - last >= 2 ** mine.length * 60_000;
};

export async function runScheduler(ctx: AppContext): Promise<SchedulerResult> {
  const now = ctx.now();
  const result: SchedulerResult = { transitions: [], sent: 0, failed: 0, capped: false };
  const settings = await getSettings();
  let budget = Math.max(0, settings.mailDailyLimit - (await sentInLastDay(now)));
  const overrides = (settings.mailTemplates ?? {}) as TemplateOverrides;

  const campaigns = await Campaign.find({ module: 'M1', status: { $in: ['envios_activos', 'en_curso'] } }).lean<CampaignDoc[]>();
  for (const c of campaigns) {
    const w = c.window;
    const decision = scheduleDecision({
      status: c.status as CampaignStatus,
      opensAt: w?.opensAt ?? null,
      closesAt: w?.closesAt ?? null,
      reminders: ((w?.reminders ?? []) as { businessDay: number; sendAt: string | Date }[]).map((r) => ({ businessDay: r.businessDay, sendAt: new Date(r.sendAt) })),
      now,
    });
    if (decision.transition && (await transition(ctx, c, decision.transition, 'scheduled'))) {
      result.transitions.push({ campaignId: String(c._id), to: decision.transition });
    }
    const kinds = [...(decision.sendInvitations ? [undefined] : []), ...decision.dueReminders].map((d) => ({ kind: sendKind(d), template: (d === undefined ? 'invitation' : 'reminder') as TemplateKey }));
    if (kinds.length === 0) continue;

    const org = await Organization.findById(c.organizationId, { name: 1, defaultLanguage: 1 }).lean();
    const language: Language = org && isAvailableLanguage(org.defaultLanguage) ? (org.defaultLanguage as Language) : 'es';
    const closes = new Intl.DateTimeFormat(DATE_LOCALE[language], { dateStyle: 'long', timeZone: w!.timeZone as string }).format(new Date(w!.closesAt!));
    const contacts = await ParticipantContact.find({ campaignId: c._id, noEmail: false, revokedAt: null }).lean();
    const statuses = new Map(
      (await Respondent.find({ campaignId: c._id }, { status: 1 }).lean()).map((r) => [String(r._id), r.status as RespondentStatus]),
    );

    for (const { kind, template } of kinds) {
      for (const contact of contacts) {
        const status = statuses.get(String(contact.respondentId));
        if (!status || (template === 'reminder' && !shouldRemind(status))) continue;
        if (contact.sends.some((s) => s.kind === kind)) continue;
        if (!mayRetry(contact.failures ?? [], kind, now)) continue;
        if (budget <= 0) {
          result.capped = true;
          break;
        }
        try {
          const to = ctx.crypto.decrypt(contact.emailEncrypted!);
          const token = ctx.crypto.decrypt(contact.invitationTokenEncrypted!);
          const mail = renderTemplate(template, language, { url: `${ctx.config.appUrl}/i/${token}`, organization: org?.name ?? '', closes }, overrides);
          const sent = await ctx.mail.send({ to, ...mail });
          await ParticipantContact.updateOne({ _id: contact._id }, { $push: { sends: { kind, at: now, messageId: sent.messageId ?? null } } });
          if (template === 'invitation') await Respondent.updateOne({ _id: contact.respondentId, status: 'pending' }, { $set: { status: 'invited' } });
          budget--;
          result.sent++;
        } catch (err) {
          await ParticipantContact.updateOne({ _id: contact._id }, { $push: { failures: { kind, at: now } } });
          result.failed++;
          ctx.logger.warn({ err: (err as Error).message, campaignId: String(c._id), kind }, 'participant email failed');
        }
      }
    }
  }
  if (result.transitions.length || result.sent || result.failed) ctx.logger.info({ ...result, transitions: result.transitions.length }, 'scheduler tick');
  return result;
}
