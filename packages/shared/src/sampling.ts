/**
 * Minimum number of COMPLETED interviews by scope size (section 5.3).
 * Pure and deterministic: the table itself lives in the database (`samplingTables`).
 */

export interface SamplingBracket {
  /** Inclusive lower bound of people in scope. */
  min: number;
  /** Inclusive upper bound; `null` = open-ended (last bracket only). */
  max: number | null;
  /** Minimum completed interviews required. In a ranged bracket, the lowest value allowed. */
  required: number;
  /** When present, the auditor chooses a figure in [required, rangeMax]. */
  rangeMax?: number | null;
}

export type SamplingTableIssue =
  | { code: 'EMPTY' }
  | { code: 'FIRST_MIN_NOT_ONE'; index: number }
  | { code: 'NOT_CONTIGUOUS'; index: number }
  | { code: 'MAX_LT_MIN'; index: number }
  | { code: 'OPEN_ENDED_NOT_LAST'; index: number }
  | { code: 'LAST_NOT_OPEN_ENDED'; index: number }
  | { code: 'INVALID_REQUIRED'; index: number }
  | { code: 'INVALID_RANGE'; index: number };

const isPositiveInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1;

/** Structural validation of a sampling table before it is published. */
export function validateSamplingTable(brackets: readonly SamplingBracket[]): SamplingTableIssue[] {
  const issues: SamplingTableIssue[] = [];
  if (brackets.length === 0) return [{ code: 'EMPTY' }];
  brackets.forEach((b, index) => {
    const isLast = index === brackets.length - 1;
    if (index === 0 && b.min !== 1) issues.push({ code: 'FIRST_MIN_NOT_ONE', index });
    if (index > 0) {
      const prevMax = brackets[index - 1].max;
      if (prevMax !== null && b.min !== prevMax + 1) issues.push({ code: 'NOT_CONTIGUOUS', index });
    }
    if (b.max === null && !isLast) issues.push({ code: 'OPEN_ENDED_NOT_LAST', index });
    if (b.max !== null && isLast) issues.push({ code: 'LAST_NOT_OPEN_ENDED', index });
    if (b.max !== null && b.max < b.min) issues.push({ code: 'MAX_LT_MIN', index });
    if (!isPositiveInt(b.required)) issues.push({ code: 'INVALID_REQUIRED', index });
    if (b.rangeMax != null && (!isPositiveInt(b.rangeMax) || b.rangeMax < b.required)) {
      issues.push({ code: 'INVALID_RANGE', index });
    }
  });
  return issues;
}

export type MinimumResolution =
  | {
      ok: true;
      bracketIndex: number;
      bracket: SamplingBracket;
      /** `null` only when the bracket needs an auditor choice that has not been given. */
      minimum: number | null;
      requiresAuditorChoice: boolean;
      auditorChosen: boolean;
    }
  | { ok: false; error: 'INVALID_SCOPE_SIZE' | 'NO_BRACKET' | 'CHOICE_OUT_OF_RANGE' };

/**
 * Resolves the minimum of completed interviews for a declared scope size.
 * @param auditorChoice figure set by the auditor (only used for ranged brackets, e.g. > 16.000).
 */
export function resolveMinimum(
  brackets: readonly SamplingBracket[],
  scopeSize: number,
  auditorChoice?: number | null,
): MinimumResolution {
  if (!isPositiveInt(scopeSize)) return { ok: false, error: 'INVALID_SCOPE_SIZE' };
  const bracketIndex = brackets.findIndex((b) => scopeSize >= b.min && (b.max === null || scopeSize <= b.max));
  if (bracketIndex === -1) return { ok: false, error: 'NO_BRACKET' };
  const bracket = brackets[bracketIndex];

  if (bracket.rangeMax == null) {
    return {
      ok: true,
      bracketIndex,
      bracket,
      minimum: bracket.required,
      requiresAuditorChoice: false,
      auditorChosen: false,
    };
  }
  if (auditorChoice == null) {
    return { ok: true, bracketIndex, bracket, minimum: null, requiresAuditorChoice: true, auditorChosen: false };
  }
  if (!Number.isInteger(auditorChoice) || auditorChoice < bracket.required || auditorChoice > bracket.rangeMax) {
    return { ok: false, error: 'CHOICE_OUT_OF_RANGE' };
  }
  return { ok: true, bracketIndex, bracket, minimum: auditorChoice, requiresAuditorChoice: true, auditorChosen: true };
}
