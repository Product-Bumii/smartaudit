/**
 * Results of an M1 audit (section 5.6, cambios 4 · bloque 1). Deterministic and never done by the AI.
 *
 * - Only COMPLETED interviews count (the unit of the audit and of billing).
 * - Each answer counts with its effective value: the auditor's review when there is one, otherwise the AI coding.
 * - Percentages are calculated over the VALID answers (without abstentions, «sin respuesta válida», answers still
 *   pending review or options the question excludes from its base) and always shown with n.
 * - A conditional question (P7.1) only counts when its activation holds with the effective answers: if the
 *   auditor recodes P7 as «Nunca», the P7.1 answer of that person leaves the base.
 * - Multiple choice (P2): percentage of people that mention each option (the sum may exceed 100 %); the texts of
 *   options that ask for one («Otros, ¿cuál?») are listed.
 * - Percentages with one decimal, rounded half up; they are not forced to add up to 100 (decision 95).
 */
import { ABSTENTION_CODE, type AgeBand, type AnswerStatus, type QuestionType, type ReviewDecision, type Sex } from './enums';
import { evaluateActivation, type ActivationContext, type Question } from './questionnaire';

export interface ResultAnswer {
  questionCode: string;
  optionCodes: readonly string[];
  status: AnswerStatus;
  freeText?: string | null;
  review?: { decision?: ReviewDecision | null; optionCodes?: readonly string[] | null } | null;
}

export interface ResultInterview {
  demographics: { sex: Sex; ageBand: AgeBand };
  answers: readonly ResultAnswer[];
}

export type EffectiveAnswer =
  | { kind: 'codes'; codes: string[]; reviewed: boolean }
  | { kind: 'abstention'; reviewed: boolean }
  | { kind: 'no_valid_answer' }
  | { kind: 'pending' }
  | { kind: 'open' };

/** The value an answer counts with: the auditor's decision first, then the AI coding. */
export function effectiveAnswer(a: ResultAnswer): EffectiveAnswer {
  const decision = a.review?.decision ?? (a.review?.optionCodes?.length ? 'codes' : null);
  if (decision === 'codes') return { kind: 'codes', codes: [...new Set(a.review!.optionCodes ?? [])], reviewed: true };
  if (decision === 'abstention') return { kind: 'abstention', reviewed: true };
  if (decision === 'no_valid_answer') return { kind: 'no_valid_answer' };
  if (a.status === 'abstained') return { kind: 'abstention', reviewed: false };
  if (a.status === 'pending_review') return { kind: 'pending' };
  if (a.status === 'classified') return { kind: 'codes', codes: [...new Set(a.optionCodes)], reviewed: false };
  return { kind: 'open' };
}

/** An answer that still needs the auditor: pending review without a decision. */
export const needsReview = (a: ResultAnswer): boolean => effectiveAnswer(a).kind === 'pending';

/** One decimal, half up; `null` without base. */
export const percentOf = (count: number, base: number): number | null => (base > 0 ? Math.round((count * 1000) / base) / 10 : null);

export interface OptionResult {
  code: string;
  count: number;
  /** Over the valid answers (`null` when there are none). Excluded options have no percentage. */
  percent: number | null;
  excludedFromBase: boolean;
}

export interface QuestionResult {
  code: string;
  type: QuestionType;
  /** Completed interviews with an answer to this question. */
  answered: number;
  /** Valid answers: the base of the percentages (n). */
  valid: number;
  abstentions: number;
  noValidAnswer: number;
  /** Still waiting for the auditor. */
  pendingReview: number;
  /** Answers whose condition does not hold with the effective answers (e.g. P7.1 after P7 recoded as «Nunca»). */
  outsideCondition: number;
  /** Closed questions: one row per option. */
  options: OptionResult[];
  /** Texts of the options that ask for one («Otros, ¿cuál?»), by option code. */
  optionTexts: Record<string, string[]>;
  /** Open questions: comments written (listed apart, without demographics). */
  comments: number;
}

export interface DemographicsResult {
  completed: number;
  bySex: Record<Sex, number>;
  byAge: Record<AgeBand, number>;
  /** `sexByAge[sex][ageBand]`. */
  sexByAge: Record<Sex, Record<AgeBand, number>>;
}

export interface CampaignResults {
  /** Completed interviews. */
  completed: number;
  /** Section 7.1: number of interviews per modality and their distribution. */
  section71: { modality: 'ai_written_interview'; interviews: number; demographics: DemographicsResult };
  questions: QuestionResult[];
  /** Answers still waiting for the auditor, in total. */
  pendingReview: number;
}

const SEXES: readonly Sex[] = ['Mujer', 'Hombre', 'Otro', 'No indica'];
const AGES: readonly AgeBand[] = ['<30', '30-40', '41-50', '51-60', '>60'];
const zeros = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function demographicsOf(interviews: readonly ResultInterview[]): DemographicsResult {
  const bySex = zeros(SEXES);
  const byAge = zeros(AGES);
  const sexByAge = Object.fromEntries(SEXES.map((s) => [s, zeros(AGES)])) as Record<Sex, Record<AgeBand, number>>;
  for (const { demographics: d } of interviews) {
    bySex[d.sex]++;
    byAge[d.ageBand]++;
    sexByAge[d.sex][d.ageBand]++;
  }
  return { completed: interviews.length, bySex, byAge, sexByAge };
}

/** Option codes known per question with the effective answers (for the conditions of P7.1 & co.). */
function knownEffective(answers: readonly ResultAnswer[]): Record<string, string[] | undefined> {
  const known: Record<string, string[] | undefined> = {};
  for (const a of answers) {
    const e = effectiveAnswer(a);
    if (e.kind === 'codes') known[a.questionCode] = e.codes;
    else if (e.kind === 'abstention') known[a.questionCode] = [ABSTENTION_CODE];
  }
  return known;
}

export function computeResults(
  questions: readonly Question[],
  campaign: ActivationContext['campaign'],
  interviews: readonly ResultInterview[],
): CampaignResults {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const rows = ordered.map((q): QuestionResult => ({
    code: q.code,
    type: q.type,
    answered: 0,
    valid: 0,
    abstentions: 0,
    noValidAnswer: 0,
    pendingReview: 0,
    outsideCondition: 0,
    options: q.options.map((o) => ({ code: o.code, count: 0, percent: null, excludedFromBase: (q.results?.excludeFromBase ?? []).includes(o.code) })),
    optionTexts: Object.fromEntries(q.options.filter((o) => o.freeText?.required).map((o) => [o.code, [] as string[]])),
    comments: 0,
  }));
  const byCode = new Map(ordered.map((q, i) => [q.code, { q, row: rows[i] }]));

  for (const interview of interviews) {
    const ctx: ActivationContext = { campaign, answers: knownEffective(interview.answers) };
    for (const a of interview.answers) {
      const entry = byCode.get(a.questionCode);
      if (!entry) continue;
      const { q, row } = entry;
      const e = effectiveAnswer(a);
      if (e.kind === 'open') continue;
      row.answered++;
      if (evaluateActivation(q.activation, ctx) === false) {
        row.outsideCondition++;
        continue;
      }
      if (e.kind === 'abstention') row.abstentions++;
      else if (e.kind === 'no_valid_answer') row.noValidAnswer++;
      else if (e.kind === 'pending') row.pendingReview++;
      else if (q.type === 'free_text') {
        if ((a.freeText ?? '').trim()) row.comments++;
      } else {
        const counted = row.options.filter((o) => e.codes.includes(o.code));
        for (const o of counted) o.count++;
        // A valid answer is one with at least one option of the base.
        if (counted.some((o) => !o.excludedFromBase)) row.valid++;
        const text = (a.freeText ?? '').trim();
        for (const o of counted) if (text && row.optionTexts[o.code]) row.optionTexts[o.code].push(text);
      }
    }
  }
  for (const row of rows) for (const o of row.options) o.percent = o.excludedFromBase ? null : percentOf(o.count, row.valid);

  const demographics = demographicsOf(interviews);
  return {
    completed: interviews.length,
    section71: { modality: 'ai_written_interview', interviews: interviews.length, demographics },
    questions: rows,
    pendingReview: rows.reduce((n, r) => n + r.pendingReview, 0),
  };
}

// ---------- Auditor review (cambios 4 · bloque 2)

export type ReviewInputError = 'INVALID_OPTIONS' | 'NOT_REVIEWABLE';

/**
 * Checks the auditor's decision on an answer. Only closed questions are reviewed; `codes` follows the type of the
 * question (exactly one option, or one or more for multiple choice). The auditor does not have to write the
 * complement of «Otros»: the participant's own words are kept.
 */
export function reviewInputError(q: Question, decision: ReviewDecision, optionCodes: readonly string[] = []): ReviewInputError | null {
  if (q.type === 'free_text') return 'NOT_REVIEWABLE';
  if (decision !== 'codes') return optionCodes.length ? 'INVALID_OPTIONS' : null;
  const codes = [...new Set(optionCodes)];
  if (codes.length === 0 || (q.type !== 'multi' && codes.length !== 1)) return 'INVALID_OPTIONS';
  return codes.every((c) => q.options.some((o) => o.code === c)) ? null : 'INVALID_OPTIONS';
}
