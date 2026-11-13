import { describe, expect, it } from 'vitest';
import seedQuestionnaire from '../../../seed/data/questionnaire-m1-v1.json';
import seedTable from '../../../seed/data/sampling-table-v1.json';
import { deriveM1Campaign } from '../src/campaign';
import { allowedSampleModes, allowedTransitions, canTransition, isCampaignEditable } from '../src/campaign-state';
import { CAMPAIGN_STATUSES, isSuperadmin, ROLES } from '../src/enums';
import { officialHolidays } from '../src/holidays';
import { ACTIONS, can } from '../src/permissions';
import type { Question } from '../src/questionnaire';
import { retentionCutoffs, DEFAULT_RETENTION } from '../src/retention';
import type { SamplingBracket } from '../src/sampling';

describe('campaign state machine', () => {
  it('follows the main flow', () => {
    expect(canTransition('borrador', 'muestra_cargada')).toBe(true);
    expect(canTransition('muestra_cargada', 'envios_activos')).toBe(true);
    expect(canTransition('envios_activos', 'en_curso')).toBe(true);
    expect(canTransition('en_curso', 'finalizada')).toBe(true);
    expect(canTransition('finalizada', 'informe_generado')).toBe(true);
    expect(canTransition('borrador', 'envios_activos')).toBe(false);
    expect(canTransition('muestra_cargada', 'borrador')).toBe(false);
  });

  it('suspends and cancels from any active state only', () => {
    for (const s of ['borrador', 'muestra_cargada', 'envios_activos', 'en_curso'] as const) {
      expect(canTransition(s, 'suspendida')).toBe(true);
      expect(canTransition(s, 'cancelada')).toBe(true);
    }
    for (const s of ['finalizada', 'informe_generado', 'cancelada'] as const) {
      expect(canTransition(s, 'suspendida')).toBe(false);
      expect(canTransition(s, 'cancelada')).toBe(false);
    }
  });

  it('resumes a suspended campaign only to its previous state', () => {
    expect(allowedTransitions('suspendida', 'en_curso')).toEqual(['en_curso', 'cancelada']);
    expect(canTransition('suspendida', 'borrador', 'en_curso')).toBe(false);
    expect(allowedTransitions('suspendida', null)).toEqual(['cancelada']);
    expect(allowedTransitions('suspendida', 'finalizada')).toEqual(['cancelada']);
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
  it('ORG_ADMIN never sees samples or responses', () => {
    for (const a of ['sample.view', 'sample.manage', 'responses.viewIndividual', 'respondent.viewStatus', 'campaign.view'] as const) {
      expect(can('ORG_ADMIN', a)).toBe(false);
    }
    expect(can('ORG_ADMIN', 'auditor.manage')).toBe(true);
    expect(can('ORG_ADMIN', 'progress.viewAggregate')).toBe(true);
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
    visitDate: '2026-11-20',
    timeZone: 'America/Bogota',
    holidays: new Set(officialHolidays('CO', 2026)),
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
    expect(d.window?.openDate).toBe('2026-11-05');
    expect(d.windowError).toBeNull();
    expect(d.windowWarnings).toEqual(['OPENS_IN_PAST']);
    expect(d.questions.find((q) => q.code === 'P8')?.state).toBe('active');
    expect(d.questions.find((q) => q.code === 'P9')?.state).toBe('inactive');
  });

  it('reports a window error without failing', () => {
    const d = deriveM1Campaign({ ...input, visitDate: '2026-13-01' });
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
