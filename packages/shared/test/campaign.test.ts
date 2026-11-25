import { describe, expect, it } from 'vitest';
import seedQuestionnaire from '../../../seed/data/questionnaire-m1-v1.json';
import seedTable from '../../../seed/data/sampling-table-v1.json';
import { deriveM1Campaign } from '../src/campaign';
import { allowedSampleModes, allowedTransitions, canTransition, isCampaignEditable, SCHEDULED_STATUSES } from '../src/campaign-state';
import { CAMPAIGN_STATUSES, isSuperadmin, ROLES } from '../src/enums';
import { ACTIONS, can } from '../src/permissions';
import type { Question } from '../src/questionnaire';
import { retentionCutoffs, DEFAULT_RETENTION } from '../src/retention';
import type { SamplingBracket } from '../src/sampling';

describe('campaign state machine', () => {
  it('follows the main flow', () => {
    expect(canTransition('borrador', 'muestra_cargada')).toBe(true);
    expect(canTransition('muestra_cargada', 'en_curso')).toBe(true); // opens by itself on the start date
    expect(canTransition('envios_activos', 'en_curso')).toBe(true); // legacy launched audits
    expect(canTransition('en_curso', 'finalizada')).toBe(true);
    expect(canTransition('finalizada', 'informe_generado')).toBe(true);
    expect(canTransition('muestra_cargada', 'envios_activos')).toBe(false); // no manual launch any more
    expect(canTransition('muestra_cargada', 'borrador')).toBe(false);
  });

  it('there is no manual suspension or cancellation (change group 3)', () => {
    for (const s of CAMPAIGN_STATUSES) {
      expect(canTransition(s, 'suspendida')).toBe(false);
      expect(canTransition(s, 'cancelada')).toBe(false);
    }
    expect(allowedTransitions('suspendida')).toEqual([]);
    expect(SCHEDULED_STATUSES).toEqual(['muestra_cargada', 'envios_activos']);
  });

  it('terminal states have no transitions', () => {
    expect(allowedTransitions('cancelada')).toEqual([]);
    expect(allowedTransitions('informe_generado')).toEqual([]);
  });

  it('editability and sample modes per state', () => {
    const modes = Object.fromEntries(CAMPAIGN_STATUSES.map((s) => [s, allowedSampleModes(s)]));
    expect(modes).toEqual({
      borrador: ['replace'],
      muestra_cargada: ['replace'],
      envios_activos: ['append'],
      en_curso: ['append'],
      finalizada: [],
      informe_generado: [],
      suspendida: [],
      cancelada: [],
    });
    expect(isCampaignEditable('borrador')).toBe(true);
    expect(isCampaignEditable('envios_activos')).toBe(false);
  });
});

describe('permissions matrix', () => {
  it('coordinators manage auditors and assignments, not organizations or configuration', () => {
    for (const a of ['organization.manage', 'auditEntity.manage', 'coordinator.manage', 'assignment.coordinator', 'config.manage'] as const) {
      expect(can('COORDINATOR', a)).toBe(false);
    }
    expect(can('COORDINATOR', 'auditor.manage')).toBe(true);
    expect(can('COORDINATOR', 'assignment.auditor')).toBe(true);
    // Audit actions apply only where they are the lead auditor (campaignAccess = 'manage').
    expect(can('COORDINATOR', 'sample.manage')).toBe(true);
    expect(can('AUDITOR', 'assignment.auditor')).toBe(false);
    expect(can('AUDITOR', 'auditor.manage')).toBe(false);
  });

  it('only SUPERADMIN_BUMII has technical settings', () => {
    expect(can('SUPERADMIN_BUMII', 'settings.technical')).toBe(true);
    expect(can('SUPERADMIN_FUNDACION', 'settings.technical')).toBe(false);
  });

  it('auditors manage samples; superadmins do not load them', () => {
    expect(can('AUDITOR', 'sample.manage')).toBe(true);
    expect(can('SUPERADMIN_BUMII', 'sample.manage')).toBe(false);
    expect(can('AUDITOR', 'config.manage')).toBe(false);
  });

  it('every role answers for every action', () => {
    for (const r of ROLES) for (const a of ACTIONS) expect(typeof can(r, a)).toBe('boolean');
    expect(ROLES.filter(isSuperadmin)).toEqual(['SUPERADMIN_BUMII', 'SUPERADMIN_FUNDACION']);
  });
});

describe('deriveM1Campaign', () => {
  const input = {
    scopeSize: 120,
    interviewStartDate: '2026-11-06',
    timeZone: 'America/Bogota',
    brackets: seedTable.brackets as SamplingBracket[],
    questions: seedQuestionnaire.questions as Question[],
    auditType: 'renovacion' as const,
    excellence: false,
    norm: '1000-1',
    now: new Date('2026-11-12T12:00:00Z'),
  };

  it('computes minimum, window and question states', () => {
    const d = deriveM1Campaign(input);
    expect(d.minimum).toMatchObject({ ok: true, minimum: 20 });
    expect(d.maximum).toEqual({ ok: true, maximum: 20, auditorChosen: false });
    expect(d.window?.openDate).toBe('2026-11-06');
    expect(d.windowError).toBeNull();
    expect(d.windowWarnings).toEqual(['OPENS_IN_PAST']);
    expect(d.questions.find((q) => q.code === 'P8')?.state).toBe('active');
    expect(d.questions.find((q) => q.code === 'P9')?.state).toBe('inactive');
  });

  it('applies the maximum chosen by the auditor (up to the people in scope)', () => {
    expect(deriveM1Campaign({ ...input, maxCompleted: 30 }).maximum).toEqual({ ok: true, maximum: 30, auditorChosen: true });
    expect(deriveM1Campaign({ ...input, maxCompleted: 121 }).maximum).toEqual({ ok: false, error: 'MAXIMUM_ABOVE_SCOPE' });
  });

  it('the Bienestar component activates P11–P15', () => {
    const states = (wellbeing?: boolean) =>
      Object.fromEntries(deriveM1Campaign({ ...input, wellbeing }).questions.filter((q) => /^P1[1-5]$/.test(q.code)).map((q) => [q.code, q.state]));
    expect(states(true)).toEqual({ P11: 'active', P12: 'active', P13: 'active', P14: 'active', P15: 'active' });
    expect(states(false)).toEqual({ P11: 'inactive', P12: 'inactive', P13: 'inactive', P14: 'inactive', P15: 'inactive' });
    expect(states(undefined)).toEqual(states(false));
  });

  it('has no maximum while the minimum is unknown', () => {
    expect(deriveM1Campaign({ ...input, scopeSize: 20_000 }).maximum).toBeNull();
    expect(deriveM1Campaign({ ...input, scopeSize: 0 }).maximum).toBeNull();
  });

  it('reports a window error without failing', () => {
    const d = deriveM1Campaign({ ...input, interviewStartDate: '2026-13-01' });
    expect(d.window).toBeNull();
    expect(d.windowError).toBe('INVALID_DATE');
    expect(d.windowWarnings).toEqual([]);
  });
});

describe('retention', () => {
  const now = new Date('2026-11-12T00:00:00Z');
  it('is disabled by default', () => {
    expect(retentionCutoffs(DEFAULT_RETENTION, now)).toBeNull();
  });
  it('computes cut-offs when enabled', () => {
    expect(
      retentionCutoffs({ enabled: true, deleteContactsAfterDays: 30, anonymizeResponsesAfterYears: 5 }, now),
    ).toEqual({
      contactsClosedBefore: new Date('2026-10-13T00:00:00Z'),
      anonymizeClosedBefore: new Date('2021-11-12T00:00:00Z'),
    });
    expect(
      retentionCutoffs({ enabled: true, deleteContactsAfterDays: null, anonymizeResponsesAfterYears: null }, now),
    ).toEqual({ contactsClosedBefore: null, anonymizeClosedBefore: null });
  });
});
