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

describe('business days (Monday to Friday, no holidays)', () => {
  it('weekends are not business days; weekdays always are', () => {
    expect(isBusinessDay('2026-11-14')).toBe(false); // Saturday
    expect(isBusinessDay('2026-11-15')).toBe(false); // Sunday
    expect(isBusinessDay('2026-11-16')).toBe(true); // Monday (even if it is a public holiday somewhere)
    expect(isBusinessDay('2026-12-25')).toBe(true); // Friday
  });

  it('previous business day skips the weekend', () => {
    expect(previousBusinessDay('2026-11-16')).toBe('2026-11-13');
    expect(previousBusinessDay('2026-11-17')).toBe('2026-11-16');
  });

  it('rejects invalid counts and dates', () => {
    expect(() => businessDaysBefore('2026-11-17', 0)).toThrow('INVALID_COUNT');
    expect(() => businessDaysBefore('2026-11-17', 1.5)).toThrow('INVALID_COUNT');
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
  it('Bogotá: 10 business days before the visit, crossing a weekend', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota');
    expect(w.businessDays).toEqual([
      '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
      '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ]);
    expect(w.openDate).toBe('2026-11-06');
    expect(w.closeDate).toBe('2026-11-19');
    expect(w.opensAt).toBe('2026-11-06T14:00:00.000Z'); // 09:00 Bogotá (UTC-5)
    expect(w.closesAt).toBe('2026-11-20T04:59:59.999Z'); // 23:59:59.999 Bogotá
    expect(w.reminders).toEqual([
      { businessDay: 4, date: '2026-11-11', sendAt: '2026-11-11T14:00:00.000Z' },
      { businessDay: 8, date: '2026-11-17', sendAt: '2026-11-17T14:00:00.000Z' },
    ]);
  });

  it('Madrid: visit on a Wednesday, window closes the day before', () => {
    const w = computeCampaignWindow('2026-12-09', 'Europe/Madrid');
    expect(w.openDate).toBe('2026-11-25');
    expect(w.closeDate).toBe('2026-12-08');
    expect(w.opensAt).toBe('2026-11-25T08:00:00.000Z'); // 09:00 CET
    expect(w.closesAt).toBe('2026-12-08T22:59:59.999Z');
    expect(w.reminders.map((r) => r.date)).toEqual(['2026-11-30', '2026-12-04']);
  });

  it('Madrid: window crossing the year boundary', () => {
    const w = computeCampaignWindow('2027-01-08', 'Europe/Madrid');
    expect(w.businessDays).toEqual([
      '2026-12-25', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07',
    ]);
  });

  it('Madrid: window crossing the daylight-saving change', () => {
    const w = computeCampaignWindow('2027-04-05', 'Europe/Madrid');
    expect(w.openDate).toBe('2027-03-22');
    expect(w.closeDate).toBe('2027-04-02');
    expect(w.opensAt).toBe('2027-03-22T08:00:00.000Z'); // CET
    expect(w.closesAt).toBe('2027-04-02T21:59:59.999Z'); // CEST
  });

  it('ignores reminder days outside the window', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota', {
      openBusinessDays: 10,
      reminderBusinessDays: [0, 4, 11],
      sendHour: 9,
    });
    expect(w.reminders.map((r) => r.businessDay)).toEqual([4]);
  });

  it('rejects an invalid time zone', () => {
    expect(() => computeCampaignWindow('2026-11-20', 'Nowhere/City')).toThrow('INVALID_TIME_ZONE');
  });

  it('warns when the window is in the past', () => {
    const w = computeCampaignWindow('2026-11-20', 'America/Bogota');
    expect(campaignWindowWarnings(w, new Date('2026-11-01T00:00:00Z'))).toEqual([]);
    expect(campaignWindowWarnings(w, new Date('2026-11-10T00:00:00Z'))).toEqual(['OPENS_IN_PAST']);
    expect(campaignWindowWarnings(w, new Date('2026-12-01T00:00:00Z'))).toEqual(['OPENS_IN_PAST', 'CLOSES_IN_PAST']);
  });
});
