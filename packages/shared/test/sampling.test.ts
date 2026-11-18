import { describe, expect, it } from 'vitest';
import table from '../../../seed/data/sampling-table-v1.json';
import { maximumReached, resolveMaximum, resolveMinimum, validateSamplingTable, type SamplingBracket } from '../src/sampling';

const brackets = table.brackets as SamplingBracket[];

describe('resolveMinimum (seed table v1)', () => {
  it.each([
    [1, 14],
    [90, 14],
    [91, 20],
    [150, 20],
    [151, 25],
    [249, 25],
    [250, 26],
    [500, 26],
    [501, 52],
    [1000, 52],
    [1001, 59],
    [2000, 59],
    [2001, 66],
    [4000, 66],
    [4001, 78],
    [8000, 78],
    [8001, 91],
    [16000, 91],
  ])('scope %i → minimum %i', (scope, expected) => {
    const r = resolveMinimum(brackets, scope);
    expect(r.ok && r.minimum).toBe(expected);
    expect(r.ok && r.requiresAuditorChoice).toBe(false);
  });

  it('> 16.000 requires the auditor to choose', () => {
    const r = resolveMinimum(brackets, 16001);
    expect(r).toMatchObject({ ok: true, minimum: null, requiresAuditorChoice: true, auditorChosen: false, bracketIndex: 9 });
  });

  it.each([91, 120, 143])('> 16.000 accepts auditor choice %i', (choice) => {
    expect(resolveMinimum(brackets, 50000, choice)).toMatchObject({ ok: true, minimum: choice, auditorChosen: true });
  });

  it.each([90, 144, 100.5])('> 16.000 rejects auditor choice %s', (choice) => {
    expect(resolveMinimum(brackets, 50000, choice)).toEqual({ ok: false, error: 'CHOICE_OUT_OF_RANGE' });
  });

  it('ignores an auditor choice in a fixed bracket', () => {
    expect(resolveMinimum(brackets, 100, 120)).toMatchObject({ ok: true, minimum: 20, auditorChosen: false });
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects invalid scope size %s', (scope) => {
    expect(resolveMinimum(brackets, scope)).toEqual({ ok: false, error: 'INVALID_SCOPE_SIZE' });
  });

  it('returns NO_BRACKET when the table does not cover the size', () => {
    expect(resolveMinimum([{ min: 1, max: 10, required: 3 }], 11)).toEqual({ ok: false, error: 'NO_BRACKET' });
  });
});

describe('validateSamplingTable', () => {
  it('accepts the seed table', () => {
    expect(validateSamplingTable(brackets)).toEqual([]);
  });

  it('rejects an empty table', () => {
    expect(validateSamplingTable([])).toEqual([{ code: 'EMPTY' }]);
  });

  it('detects every structural problem', () => {
    const issues = validateSamplingTable([
      { min: 2, max: 10, required: 0 },
      { min: 12, max: null, required: 5 },
      { min: 20, max: 15, required: 5, rangeMax: 3 },
      { min: 17, max: 30, required: 5, rangeMax: 1.5 },
    ]);
    expect(issues).toEqual([
      { code: 'FIRST_MIN_NOT_ONE', index: 0 },
      { code: 'INVALID_REQUIRED', index: 0 },
      { code: 'NOT_CONTIGUOUS', index: 1 },
      { code: 'OPEN_ENDED_NOT_LAST', index: 1 },
      { code: 'MAX_LT_MIN', index: 2 },
      { code: 'INVALID_RANGE', index: 2 },
      { code: 'NOT_CONTIGUOUS', index: 3 },
      { code: 'LAST_NOT_OPEN_ENDED', index: 3 },
      { code: 'INVALID_RANGE', index: 3 },
    ]);
  });

  it('accepts a valid ranged last bracket', () => {
    expect(validateSamplingTable([{ min: 1, max: null, required: 5, rangeMax: 10 }])).toEqual([]);
  });
});

describe('resolveMaximum (closes the campaign when reached)', () => {
  const base = { minimum: 20, scopeSize: 120 };
  it('defaults to the minimum', () => {
    expect(resolveMaximum(base)).toEqual({ ok: true, maximum: 20, auditorChosen: false });
    expect(resolveMaximum({ ...base, requested: null, sampleSize: 5 })).toEqual({ ok: true, maximum: 20, auditorChosen: false });
  });
  it('accepts a figure between the minimum and the scope / sample size (boundaries included)', () => {
    expect(resolveMaximum({ ...base, requested: 20 })).toEqual({ ok: true, maximum: 20, auditorChosen: true });
    expect(resolveMaximum({ ...base, requested: 120 })).toEqual({ ok: true, maximum: 120, auditorChosen: true });
    expect(resolveMaximum({ ...base, requested: 30, sampleSize: 30 })).toEqual({ ok: true, maximum: 30, auditorChosen: true });
  });
  it('rejects a figure below the minimum or above the scope or the loaded sample', () => {
    expect(resolveMaximum({ ...base, requested: 19 })).toEqual({ ok: false, error: 'MAXIMUM_BELOW_MINIMUM' });
    expect(resolveMaximum({ ...base, requested: 121 })).toEqual({ ok: false, error: 'MAXIMUM_ABOVE_SCOPE' });
    expect(resolveMaximum({ ...base, requested: 31, sampleSize: 30 })).toEqual({ ok: false, error: 'MAXIMUM_ABOVE_SAMPLE' });
  });
  it('is unknown while the minimum is unknown', () => {
    expect(resolveMaximum({ ...base, minimum: null, requested: 50 })).toBeNull();
  });
  it('maximumReached', () => {
    expect(maximumReached(19, 20)).toBe(false);
    expect(maximumReached(20, 20)).toBe(true);
    expect(maximumReached(21, 20)).toBe(true);
    expect(maximumReached(100, null)).toBe(false);
    expect(maximumReached(100, undefined)).toBe(false);
  });
});
