/**
 * Scheduled behaviour of a launched campaign (section 5.4), evaluated by the worker on every tick:
 * automatic status changes, invitations and reminders. Pure and idempotent: the worker records what it sent.
 */
import { isBusinessDay, parseLocalDate } from './business-days';
import { SCHEDULED_STATUSES } from './campaign-state';
import type { CampaignStatus, RespondentStatus } from './enums';

export interface ScheduleInput {
  status: CampaignStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  reminders: readonly { businessDay: number; sendAt: Date }[];
  now: Date;
}

export interface ScheduleDecision {
  /** Automatic transition: `en_curso` when the window opens (from the scheduled states), `finalizada` when it closes. */
  transition: 'en_curso' | 'finalizada' | null;
  /** Invitations may go out (window open). */
  sendInvitations: boolean;
  /** Reminders (business day numbers) whose time has come and the window is still open. */
  dueReminders: number[];
}

const NOTHING: ScheduleDecision = { transition: null, sendInvitations: false, dueReminders: [] };

export function scheduleDecision(i: ScheduleInput): ScheduleDecision {
  const scheduled = SCHEDULED_STATUSES.includes(i.status);
  if ((!scheduled && i.status !== 'en_curso') || !i.opensAt || !i.closesAt) return NOTHING;
  const now = i.now.getTime();
  const opened = now >= i.opensAt.getTime();
  const closed = now > i.closesAt.getTime();
  if (!opened) return NOTHING;
  // Scheduled → `en_curso` first; a later tick closes it if the window is already over.
  const transition = scheduled ? 'en_curso' : closed ? 'finalizada' : null;
  if (closed) return { transition, sendInvitations: false, dueReminders: [] };
  return {
    transition,
    sendInvitations: true,
    dueReminders: i.reminders.filter((r) => now >= r.sendAt.getTime()).map((r) => r.businessDay),
  };
}

/** Reminders only go to people who have not completed (section 5.4). */
export const shouldRemind = (status: RespondentStatus): boolean => status !== 'completed';

/** Kind of a recorded send, so each invitation/reminder goes out once per person. */
export const sendKind = (reminderBusinessDay?: number): string =>
  reminderBusinessDay === undefined ? 'invitation' : `reminder-${reminderBusinessDay}`;

// ---------- Window extension (section 5.4: «el auditor puede ampliar la ventana; queda registrado»)

export type ExtensionResult =
  | { ok: true; closeDate: string; closesAt: string; addedBusinessDays: string[] }
  | { ok: false; error: 'INVALID_DATE' | 'EXTENSION_NOT_LATER' };

/** New closing date (local); it must be later than the current one. Closes at 23:59:59.999 local time. */
export function extendWindow(current: { closeDate: string; timeZone: string }, newCloseDate: string): ExtensionResult {
  let date;
  try {
    date = parseLocalDate(newCloseDate, current.timeZone);
  } catch {
    return { ok: false, error: 'INVALID_DATE' };
  }
  if (newCloseDate <= current.closeDate) return { ok: false, error: 'EXTENSION_NOT_LATER' };
  // Business days added to the window (after the current close, up to the new one).
  const addedBusinessDays: string[] = [];
  for (let d = parseLocalDate(current.closeDate, 'UTC').plus({ days: 1 }); d.toISODate()! <= newCloseDate; d = d.plus({ days: 1 })) {
    if (isBusinessDay(d.toISODate()!)) addedBusinessDays.push(d.toISODate()!);
  }
  return {
    ok: true,
    closeDate: newCloseDate,
    addedBusinessDays,
    closesAt: date.set({ hour: 23, minute: 59, second: 59, millisecond: 999 }).toUTC().toISO() as string,
  };
}

// ---------- Progress and minimum alerts (section 5.4 «política de mínimo»)

export interface ProgressInput {
  sampleSize: number;
  counts: Partial<Record<RespondentStatus, number>>;
  minimum: number | null;
  maximum: number | null;
  opensAt: Date | null;
  closesAt: Date | null;
  now: Date;
}

export type ProgressAlert = 'SAMPLE_BELOW_MINIMUM' | 'PROJECTION_BELOW_MINIMUM';

export interface Progress {
  sampleSize: number;
  invited: number;
  started: number;
  completed: number;
  minimum: number | null;
  maximum: number | null;
  /** Completed interviews over the minimum, in % (may exceed 100). `null` while the minimum is unknown. */
  percentOfMinimum: number | null;
  /** Completed interviews expected at the close at the current pace (from half the window on). */
  projection: number | null;
  alerts: ProgressAlert[];
}

export function campaignProgress(i: ProgressInput): Progress {
  const c = (s: RespondentStatus) => i.counts[s] ?? 0;
  const completed = c('completed');
  const started = c('started');
  const invited = c('invited') + started + completed;
  const alerts: ProgressAlert[] = [];
  if (i.minimum !== null && i.sampleSize < i.minimum) alerts.push('SAMPLE_BELOW_MINIMUM');

  let projection: number | null = null;
  if (i.opensAt && i.closesAt) {
    const total = i.closesAt.getTime() - i.opensAt.getTime();
    const elapsed = Math.min(i.now.getTime(), i.closesAt.getTime()) - i.opensAt.getTime();
    const fraction = total > 0 ? elapsed / total : 0;
    if (fraction >= 0.5) {
      projection = Math.round(completed / fraction);
      if (i.minimum !== null && fraction < 1 && projection < i.minimum) alerts.push('PROJECTION_BELOW_MINIMUM');
    }
  }
  return {
    sampleSize: i.sampleSize,
    invited,
    started,
    completed,
    minimum: i.minimum,
    maximum: i.maximum,
    percentOfMinimum: i.minimum ? Math.round((completed / i.minimum) * 100) : null,
    projection,
    alerts,
  };
}
