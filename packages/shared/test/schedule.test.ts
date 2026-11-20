import { describe, expect, it } from 'vitest';
import { campaignProgress, extendWindow, scheduleDecision, sendKind, shouldRemind } from '../src/schedule';

const opensAt = new Date('2026-11-25T08:00:00Z');
const closesAt = new Date('2026-12-08T22:59:59.999Z');
const reminders = [
  { businessDay: 4, sendAt: new Date('2026-11-30T08:00:00Z') },
  { businessDay: 8, sendAt: new Date('2026-12-04T08:00:00Z') },
];
const at = (iso: string) => new Date(iso);

describe('scheduleDecision', () => {
  it('does nothing before launch, after closing states or without window', () => {
    for (const status of ['borrador', 'muestra_cargada', 'finalizada', 'suspendida', 'cancelada'] as const) {
      expect(scheduleDecision({ status, opensAt, closesAt, reminders, now: at('2026-12-01T10:00:00Z') })).toEqual({ transition: null, sendInvitations: false, dueReminders: [] });
    }
    expect(scheduleDecision({ status: 'en_curso', opensAt: null, closesAt, reminders, now: at('2026-12-01T10:00:00Z') }).sendInvitations).toBe(false);
    expect(scheduleDecision({ status: 'en_curso', opensAt, closesAt: null, reminders, now: at('2026-12-01T10:00:00Z') }).sendInvitations).toBe(false);
  });

  it('launched before the window: waits', () => {
    expect(scheduleDecision({ status: 'envios_activos', opensAt, closesAt, reminders, now: at('2026-11-25T07:59:00Z') })).toEqual({ transition: null, sendInvitations: false, dueReminders: [] });
  });

  it('window opens: en_curso and invitations', () => {
    expect(scheduleDecision({ status: 'envios_activos', opensAt, closesAt, reminders, now: opensAt })).toEqual({ transition: 'en_curso', sendInvitations: true, dueReminders: [] });
  });

  it('reminders on business days 4 and 8', () => {
    expect(scheduleDecision({ status: 'en_curso', opensAt, closesAt, reminders, now: at('2026-11-30T08:00:00Z') }).dueReminders).toEqual([4]);
    expect(scheduleDecision({ status: 'en_curso', opensAt, closesAt, reminders, now: at('2026-12-05T08:00:00Z') })).toEqual({ transition: null, sendInvitations: true, dueReminders: [4, 8] });
  });

  it('window closed: finalizada, nothing else sent; a never-opened launch goes to en_curso first', () => {
    expect(scheduleDecision({ status: 'en_curso', opensAt, closesAt, reminders, now: at('2026-12-09T00:00:00Z') })).toEqual({ transition: 'finalizada', sendInvitations: false, dueReminders: [] });
    expect(scheduleDecision({ status: 'envios_activos', opensAt, closesAt, reminders, now: at('2026-12-09T00:00:00Z') }).transition).toBe('en_curso');
  });

  it('send kinds and who is reminded', () => {
    expect(sendKind()).toBe('invitation');
    expect(sendKind(4)).toBe('reminder-4');
    expect(shouldRemind('invited')).toBe(true);
    expect(shouldRemind('started')).toBe(true);
    expect(shouldRemind('completed')).toBe(false);
  });
});

describe('extendWindow', () => {
  const current = { closeDate: '2026-12-08', timeZone: 'Europe/Madrid' };
  it('extends to a later date, closing at 23:59 local', () => {
    expect(extendWindow(current, '2026-12-11')).toEqual({ ok: true, closeDate: '2026-12-11', closesAt: '2026-12-11T22:59:59.999Z' });
  });
  it('rejects earlier or equal dates and invalid ones', () => {
    expect(extendWindow(current, '2026-12-08')).toEqual({ ok: false, error: 'EXTENSION_NOT_LATER' });
    expect(extendWindow(current, '2026-12-01')).toEqual({ ok: false, error: 'EXTENSION_NOT_LATER' });
    expect(extendWindow(current, '2026-13-01')).toEqual({ ok: false, error: 'INVALID_DATE' });
  });
});

describe('campaignProgress', () => {
  const base = { sampleSize: 30, minimum: 20, maximum: 25, opensAt, closesAt };

  it('counts invited (anyone reached), started and completed and the % of the minimum', () => {
    const p = campaignProgress({ ...base, counts: { invited: 10, started: 5, completed: 15 }, now: at('2026-11-26T10:00:00Z') });
    expect(p).toEqual({ sampleSize: 30, invited: 30, started: 5, completed: 15, minimum: 20, maximum: 25, percentOfMinimum: 75, projection: null, alerts: [] });
  });

  it('alerts when the sample is below the minimum', () => {
    expect(campaignProgress({ ...base, sampleSize: 12, counts: {}, now: opensAt }).alerts).toEqual(['SAMPLE_BELOW_MINIMUM']);
  });

  it('from half the window, projects the pace and alerts if it does not reach the minimum', () => {
    const half = new Date(Math.ceil((opensAt.getTime() + closesAt.getTime()) / 2) + 1);
    const slow = campaignProgress({ ...base, counts: { completed: 6 }, now: half });
    expect(slow.projection).toBe(12);
    expect(slow.alerts).toEqual(['PROJECTION_BELOW_MINIMUM']);
    expect(campaignProgress({ ...base, counts: { completed: 12 }, now: half }).alerts).toEqual([]);
    // After the close there is no projection alert any more (the result is final).
    const closed = campaignProgress({ ...base, counts: { completed: 6 }, now: at('2026-12-20T00:00:00Z') });
    expect(closed).toMatchObject({ projection: 6, alerts: [] });
  });

  it('without minimum or window', () => {
    expect(campaignProgress({ ...base, minimum: null, counts: { completed: 3 }, now: opensAt })).toMatchObject({ percentOfMinimum: null, alerts: [] });
    expect(campaignProgress({ ...base, opensAt: null, counts: {}, now: opensAt }).projection).toBeNull();
    expect(campaignProgress({ ...base, closesAt: opensAt, counts: {}, now: opensAt }).projection).toBeNull(); // zero-length window
  });
});
