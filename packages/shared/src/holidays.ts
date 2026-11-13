/**
 * Official holidays (from `date-holidays`) plus manual overrides stored in `holidayCalendars`.
 */
import Holidays from 'date-holidays';

export interface HolidayOverrides {
  /** Extra non-working dates (e.g. regional or company-wide holidays). */
  add: string[];
  /** Official dates that must be treated as working days. */
  remove: string[];
}

/** National public holidays for a country and year as sorted `YYYY-MM-DD` strings. */
export function officialHolidays(country: string, year: number): string[] {
  const hd = new Holidays(country);
  const dates = hd
    .getHolidays(year)
    .filter((h) => h.type === 'public').map((h) => h.date.slice(0, 10));
  return [...new Set(dates)].sort();
}

export function isSupportedCountry(country: string): boolean {
  return Object.keys(new Holidays().getCountries()).includes(country);
}

/** Effective holiday list after applying manual overrides. */
export function applyHolidayOverrides(official: readonly string[], overrides: HolidayOverrides): string[] {
  const removed = new Set(overrides.remove);
  const merged = new Set(official.filter((d) => !removed.has(d)));
  overrides.add.forEach((d) => merged.add(d));
  return [...merged].sort();
}
