import { describe, expect, it } from 'vitest';
import {
  businessDaysBefore,
  campaignWindowWarnings,
  computeCampaignWindow,
  isBusinessDay,
  isValidTimeZone,
  parseLocalDate,
  previousBusinessDay,
} from '../src/business-days';
import { applyHolidayOverrides, isSupportedCountry, officialHolidays } from '../src/holidays';

const holidays = (country: string, ...years: number[]) => new Set(years.flatMap((y) => officialHolidays(country, y)));
const CO = holidays('CO', 2026, 2027);
const ES = holidays('ES', 2026, 2027);

describe('official holidays', () => {
  it('includes Colombian moved holidays (Ley Emiliani) and Spanish national holidays', () => {
    expect(officialHolidays('CO', 2026)).toContain('2026-11-16'); // Independencia de Cartagena (lunes)
    expect(officialHolidays('CO', 2027)).toEqual(expect.arrayContaining(['2027-03-22', '2027-03-25', '2027-03-26']));
    expect(officialHolidays('ES', 2026)).toEqual(expect.arrayContaining(['2026-01-06', '2026-12-08', '2026-12-25']));
  });

  it('returns an empty list for unknown countries', () => {
    expect(officialHolidays('XX', 2026)).toEqual([]);
    expect(isSupportedCountry('XX')).toBe(false);
    expect(isSupportedCountry('CO')).toBe(true);
  });

  it('applies manual overrides', () => {
    expect(applyHolidayOverrides(['2026-01-01', '2026-01-06'], { add: ['2026-05-15', '2026-01-01'], remove: ['2026-01-06'] })).toEqual([
      '2026-01-01',
      '2026-05-15',
    ]);
  });
});

describe('business days', () => {
  it('weekends and holidays are not business days', () => {
    expect(isBusinessDay('2026-11-14', CO)).toBe(false); // Saturday
    expect(isBusinessDay('2026-11-15', CO)).toBe(false); // Sunday
    expect(isBusinessDay('2026-11-16', CO)).toBe(false); // CO holiday
    expect(isBusinessDay('2026-11-16', ES)).toBe(true);
    expect(isBusinessDay('2026-11-17', CO)).toBe(true);
  });

  it('previous business day skips weekend + holiday', () => {
    expect(previousBusinessDay('2026-11-17', CO)).toBe('2026-11-13');
  });

  it('rejects invalid counts and dates', () => {
    expect(() => businessDaysBefore('2026-11-17', 0, CO)).toThrow('INVALID_COUNT');
    expect(() => businessDaysBefore('2026-11-17', 1.5, CO)).toThrow('INVALID_COUNT');
    expect(() => parseLocalDate('17/11/2026', 'UTC')).toThrow('INVALID_DATE');
    expect(() => parseLocalDate('2026-02-30', 'UTC')).toThrow('INVALID_DATE');
    expect(() => parseLocalDate('2026-02-10', 'Mars/Olympus')).toThrow('INVALID_TIME_ZONE');
  });

  it('validates time zones', () => {
    expect(isValidTimeZone('America/Bogota')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('computeCampaignWindow', () => {
  it('CO: window crossing a weekend and a Monday holiday', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota', CO);
    expect(w.businessDays).toEqual([
      '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11',
      '2026-11-12', '2026-11-13', '2026-11-17', '2026-11-18', '2026-11-19',
    ]);
    expect(w.openDate).toBe('2026-11-05');
    expect(w.closeDate).toBe('2026-11-19');
    expect(w.opensAt).toBe('2026-11-05T14:00:00.000Z'); // 09:00 Bogotá (UTC-5)
    expect(w.closesAt).toBe('2026-11-20T04:59:59.999Z'); // 23:59:59.999 Bogotá
    expect(w.reminders).toEqual([
      { businessDay: 4, date: '2026-11-10', sendAt: '2026-11-10T14:00:00.000Z' },
      { businessDay: 8, date: '2026-11-17', sendAt: '2026-11-17T14:00:00.000Z' },
    ]);
  });

  it('CO: Holy Week 2027 (Thursday, Friday and the moved Monday)', () => {
    const w = computeCampaignWindow('2027-03-29', 'America/Bogota', CO);
    expect(w.openDate).toBe('2027-03-10');
    expect(w.closeDate).toBe('2027-03-24');
    expect(w.businessDays).not.toContain('2027-03-22');
  });

  it('ES: visit right after the 6/8 December holidays', () => {
    const w = computeCampaignWindow('2026-12-09', 'Europe/Madrid', ES);
    expect(w.openDate).toBe('2026-11-24');
    expect(w.closeDate).toBe('2026-12-07');
    expect(w.opensAt).toBe('2026-11-24T08:00:00.000Z'); // 09:00 CET
    expect(w.closesAt).toBe('2026-12-07T22:59:59.999Z');
    expect(w.reminders.map((r) => r.date)).toEqual(['2026-11-27', '2026-12-03']);
  });

  it('ES: window crossing the year boundary (Christmas, New Year, Epiphany)', () => {
    const w = computeCampaignWindow('2027-01-08', 'Europe/Madrid', ES);
    expect(w.businessDays).toEqual([
      '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-28', '2026-12-29',
      '2026-12-30', '2026-12-31', '2027-01-04', '2027-01-05', '2027-01-07',
    ]);
  });

  it('ES: window crossing the daylight-saving change and Good Friday', () => {
    const w = computeCampaignWindow('2027-04-05', 'Europe/Madrid', ES);
    expect(w.openDate).toBe('2027-03-19');
    expect(w.closeDate).toBe('2027-04-02');
    expect(w.opensAt).toBe('2027-03-19T08:00:00.000Z'); // CET
    expect(w.closesAt).toBe('2027-04-02T21:59:59.999Z'); // CEST
    expect(w.businessDays).not.toContain('2027-03-26');
  });

  it('ignores reminder days outside the window', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota', CO, {
      openBusinessDays: 10,
      reminderBusinessDays: [0, 4, 11],
      sendHour: 9,
    });
    expect(w.reminders.map((r) => r.businessDay)).toEqual([4]);
  });

  it('rejects an invalid time zone', () => {
    expect(() => computeCampaignWindow('2026-11-20', 'Nowhere/City', CO)).toThrow('INVALID_TIME_ZONE');
  });

  it('warns when the window is in the past', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota', CO);
    expect(campaignWindowWarnings(w, new Date('2026-11-01T00:00:00Z'))).toEqual([]);
    expect(campaignWindowWarnings(w, new Date('2026-11-10T00:00:00Z'))).toEqual(['OPENS_IN_PAST']);
    expect(campaignWindowWarnings(w, new Date('2026-12-01T00:00:00Z'))).toEqual(['OPENS_IN_PAST', 'CLOSES_IN_PAST']);
  });
});
