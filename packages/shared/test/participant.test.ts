import { describe, expect, it } from 'vitest';
import { participantAvailability } from '../src/participant';

const opensAt = new Date('2026-11-24T14:00:00Z');
const closesAt = new Date('2026-12-08T04:59:59.999Z');
const inside = new Date('2026-11-30T12:00:00Z');
const base = { campaignStatus: 'en_curso' as const, respondentStatus: 'invited' as const, opensAt, closesAt, now: inside };

describe('participantAvailability', () => {
  it('is open for a launched campaign inside the window', () => {
    expect(participantAvailability(base)).toBe('open');
    expect(participantAvailability({ ...base, campaignStatus: 'envios_activos', respondentStatus: 'started' })).toBe('open');
  });

  it('is completed once the interview is done, whatever the campaign state', () => {
    expect(participantAvailability({ ...base, respondentStatus: 'completed' })).toBe('completed');
    expect(participantAvailability({ ...base, respondentStatus: 'completed', campaignStatus: 'cancelada' })).toBe('completed');
  });

  it.each(['suspendida', 'cancelada'] as const)('is unavailable when the campaign is %s', (campaignStatus) => {
    expect(participantAvailability({ ...base, campaignStatus })).toBe('unavailable');
  });

  it.each(['finalizada', 'informe_generado'] as const)('is closed when the campaign is %s', (campaignStatus) => {
    expect(participantAvailability({ ...base, campaignStatus })).toBe('closed');
  });

  it('is closed after the window', () => {
    expect(participantAvailability({ ...base, now: new Date('2026-12-08T05:00:00Z') })).toBe('closed');
  });

  it('is not open yet before the window, before launch or without a window', () => {
    expect(participantAvailability({ ...base, now: new Date('2026-11-24T13:59:59Z') })).toBe('not_open_yet');
    expect(participantAvailability({ ...base, campaignStatus: 'muestra_cargada', respondentStatus: 'pending' })).toBe('not_open_yet');
    expect(participantAvailability({ ...base, campaignStatus: 'borrador', respondentStatus: 'pending' })).toBe('not_open_yet');
    expect(participantAvailability({ ...base, opensAt: null, closesAt: null })).toBe('not_open_yet');
  });
});
