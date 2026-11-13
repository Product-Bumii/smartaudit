/**
 * Business days and campaign window (section 5.4).
 * Business day = Monday to Friday (holidays are not taken into account — decision 54), in the organization's
 * IANA time zone. Local dates are handled as `YYYY-MM-DD` strings; instants are returned as ISO-8601 UTC strings.
 */
import { DateTime } from 'luxon';

export interface WindowRules {
  /** Number of business days the window lasts (opens N business days before the visit). */
  openBusinessDays: number;
  /** 1-based business days of the window on which reminders are sent. */
  reminderBusinessDays: readonly number[];
  /** Local hour at which invitations and reminders are sent. */
  sendHour: number;
}

export const DEFAULT_WINDOW_RULES: WindowRules = {
  openBusinessDays: 10,
  reminderBusinessDays: [4, 8],
  sendHour: 9,
};

export interface CampaignWindow {
  timeZone: string;
  /** Business days of the window, ascending (day 1 = open date). */
  businessDays: string[];
  openDate: string;
  closeDate: string;
  /** Opening instant: open date at `sendHour` local time (moment invitations go out). */
  opensAt: string;
  /** Closing instant: 23:59:59.999 local time of the business day before the visit. */
  closesAt: string;
  reminders: { businessDay: number; date: string; sendAt: string }[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a local `YYYY-MM-DD` date in the given zone. Throws on invalid input. */
export function parseLocalDate(date: string, timeZone: string): DateTime {
  if (!ISO_DATE.test(date)) throw new Error('INVALID_DATE');
  const dt = DateTime.fromISO(date, { zone: timeZone });
  if (!dt.isValid) {
    throw new Error(dt.invalidReason === 'unsupported zone' ? 'INVALID_TIME_ZONE' : 'INVALID_DATE');
  }
  return dt;
}

export function isValidTimeZone(timeZone: string): boolean {
  return DateTime.now().setZone(timeZone).isValid;
}

/** Monday to Friday. */
export function isBusinessDay(date: string): boolean {
  return parseLocalDate(date, 'UTC').weekday <= 5;
}

const toDate = (dt: DateTime): string => dt.toISODate() as string;

/** Returns the `count` business days strictly before `date`, in ascending order. */
export function businessDaysBefore(date: string, count: number): string[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('INVALID_COUNT');
  const result: string[] = [];
  let cursor = parseLocalDate(date, 'UTC');
  while (result.length < count) {
    cursor = cursor.minus({ days: 1 });
    const d = toDate(cursor);
    if (isBusinessDay(d)) result.unshift(d);
  }
  return result;
}

export function previousBusinessDay(date: string): string {
  return businessDaysBefore(date, 1)[0];
}

/** Computes the participation window for a campaign whose visit is on `visitDate` (local date). */
export function computeCampaignWindow(
  visitDate: string,
  timeZone: string,
  rules: WindowRules = DEFAULT_WINDOW_RULES,
): CampaignWindow {
  parseLocalDate(visitDate, timeZone);
  const businessDays = businessDaysBefore(visitDate, rules.openBusinessDays);
  const at = (date: string, hour: number, minute = 0, second = 0, millisecond = 0) =>
    parseLocalDate(date, timeZone).set({ hour, minute, second, millisecond }).toUTC().toISO() as string;

  const openDate = businessDays[0];
  const closeDate = businessDays[businessDays.length - 1];
  const reminders = rules.reminderBusinessDays
    .filter((n) => n >= 1 && n <= businessDays.length)
    .map((n) => ({ businessDay: n, date: businessDays[n - 1], sendAt: at(businessDays[n - 1], rules.sendHour) }));

  return {
    timeZone,
    businessDays,
    openDate,
    closeDate,
    opensAt: at(openDate, rules.sendHour),
    closesAt: at(closeDate, 23, 59, 59, 999),
    reminders,
  };
}

export type WindowWarning = 'OPENS_IN_PAST' | 'CLOSES_IN_PAST';

/** Warnings shown to the auditor when the window is already (partly) in the past. */
export function campaignWindowWarnings(window: CampaignWindow, now: Date): WindowWarning[] {
  const warnings: WindowWarning[] = [];
  if (new Date(window.opensAt).getTime() < now.getTime()) warnings.push('OPENS_IN_PAST');
  if (new Date(window.closesAt).getTime() < now.getTime()) warnings.push('CLOSES_IN_PAST');
  return warnings;
}
