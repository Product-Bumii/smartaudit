import { describe, expect, it } from 'vitest';
import seedQuestionnaire from '../../../seed/data/questionnaire-m1-v1.json';
import type { Question } from '../src/questionnaire';
import {
  computeResults,
  demographicsOf,
  effectiveAnswer,
  needsReview,
  percentOf,
  reviewInputError,
  type ResultAnswer,
  type ResultInterview,
} from '../src/results';

const questions = seedQuestionnaire.questions as Question[];
const q = (code: string) => questions.find((x) => x.code === code)!;
const renovacion = { auditType: 'renovacion' as const, excellence: true, wellbeing: true, norm: '1000-1' };

const coded = (questionCode: string, optionCodes: string[], freeText: string | null = null): ResultAnswer => ({ questionCode, optionCodes, status: 'classified', freeText });
const abstained = (questionCode: string): ResultAnswer => ({ questionCode, optionCodes: ['ABSTENCION'], status: 'abstained' });
const pending = (questionCode: string, review?: ResultAnswer['review']): ResultAnswer => ({ questionCode, optionCodes: [], status: 'pending_review', review });
const person = (sex: ResultInterview['demographics']['sex'], ageBand: ResultInterview['demographics']['ageBand'], answers: ResultAnswer[]): ResultInterview => ({ demographics: { sex, ageBand }, answers });

describe('effective answer: the auditor first, then the AI', () => {
  it('review decisions win over the AI coding', () => {
    expect(effectiveAnswer(coded('P1', ['SI', 'SI']))).toEqual({ kind: 'codes', codes: ['SI'], reviewed: false });
    expect(effectiveAnswer(abstained('P1'))).toEqual({ kind: 'abstention', reviewed: false });
    expect(effectiveAnswer(pending('P1'))).toEqual({ kind: 'pending' });
    expect(effectiveAnswer(pending('P1', { decision: 'codes', optionCodes: ['NO'] }))).toEqual({ kind: 'codes', codes: ['NO'], reviewed: true });
    expect(effectiveAnswer(pending('P1', { decision: 'abstention' }))).toEqual({ kind: 'abstention', reviewed: true });
    expect(effectiveAnswer(pending('P1', { decision: 'no_valid_answer' }))).toEqual({ kind: 'no_valid_answer' });
    // Reviews recorded before decisions existed: option codes alone mean «codes».
    expect(effectiveAnswer(pending('P1', { optionCodes: ['SI'] }))).toEqual({ kind: 'codes', codes: ['SI'], reviewed: true });
    expect(effectiveAnswer(pending('P1', { decision: 'codes' }))).toEqual({ kind: 'codes', codes: [], reviewed: true });
    expect(effectiveAnswer(pending('P1', { optionCodes: [] }))).toEqual({ kind: 'pending' });
    expect(effectiveAnswer({ questionCode: 'P1', optionCodes: [], status: 'ambiguous' })).toEqual({ kind: 'open' });
    expect(needsReview(pending('P1'))).toBe(true);
    expect(needsReview(pending('P1', { decision: 'abstention' }))).toBe(false);
  });

  it('percentages: one decimal, half up, none without base', () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(2, 3)).toBe(66.7);
    expect(percentOf(1, 8)).toBe(12.5);
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe('computeResults (reference case calculated by hand)', () => {
  // Five completed interviews of a renewal with excellence and Bienestar.
  const interviews: ResultInterview[] = [
    person('Mujer', '30-40', [
      coded('P1', ['SI']),
      coded('P2', ['MAIL', 'REUNIONES']),
      coded('P4', ['POR_ENCIMA']),
      coded('P7', ['SIEMPRE']),
      coded('P7.1', ['SI_TIEMPO']),
      coded('P8', ['GRAN_AVANCE']),
      coded('P10', [], 'Más flexibilidad en verano'),
      coded('P11', ['DE_ACUERDO']),
    ]),
    person('Mujer', '41-50', [
      coded('P1', ['SI']),
      coded('P2', ['MAIL', 'OTROS'], 'Por correo y en el tablón'),
      coded('P4', ['EN_LA_MEDIA']),
      coded('P7', ['ALGUNAS_VECES']),
      coded('P7.1', ['NO']),
      coded('P8', ['NS_NC']),
      abstained('P10'),
      coded('P11', ['DE_ACUERDO']),
    ]),
    person('Hombre', '30-40', [
      coded('P1', ['NO']),
      coded('P2', ['NINGUNO']),
      abstained('P4'),
      coded('P7', ['NUNCA']),
      coded('P8', ['MODERADO']),
      coded('P10', [], '   '),
      coded('P11', ['EN_DESACUERDO']),
      { questionCode: 'P3.1', optionCodes: [], status: 'ambiguous' }, // not final: ignored
    ]),
    person('Hombre', '>60', [
      pending('P1'),
      pending('P2', { decision: 'codes', optionCodes: ['INTRANET'] }),
      pending('P4', { decision: 'no_valid_answer' }),
      // The AI could not code P7 (P7.1 was asked anyway); the auditor recodes it as «Nunca».
      pending('P7', { decision: 'codes', optionCodes: ['NUNCA'] }),
      coded('P7.1', ['SI_ECONOMICA']),
      pending('P8', { decision: 'abstention' }),
      coded('P11', ['NI_DE_ACUERDO_NI_EN_DESACUERDO']),
      coded('P99', ['X']), // unknown question: ignored
    ]),
    person('No indica', '<30', [coded('P1', ['NS_NC']), coded('P7', ['SIEMPRE']), pending('P7.1'), coded('P8', ['NS_NC']), coded('P15', [])]),
  ];
  const r = computeResults(questions, renovacion, interviews);
  const row = (code: string) => r.questions.find((x) => x.code === code)!;
  const pct = (code: string) => Object.fromEntries(row(code).options.map((o) => [o.code, o.percent]));

  it('section 7.1: completed interviews, modality and distribution by sex and age', () => {
    expect(r.completed).toBe(5);
    expect(r.section71.modality).toBe('ai_written_interview');
    expect(r.section71.demographics.bySex).toEqual({ Mujer: 2, Hombre: 2, Otro: 0, 'No indica': 1 });
    expect(r.section71.demographics.byAge).toEqual({ '<30': 1, '30-40': 2, '41-50': 1, '51-60': 0, '>60': 1 });
    expect(r.section71.demographics.sexByAge.Hombre).toEqual({ '<30': 0, '30-40': 1, '41-50': 0, '51-60': 0, '>60': 1 });
  });

  it('single choice: base = valid answers; pending answers are counted apart', () => {
    expect(row('P1')).toMatchObject({ answered: 5, valid: 4, pendingReview: 1, abstentions: 0 });
    expect(pct('P1')).toEqual({ SI: 50, NO: 25, NS_NC: 25 });
    expect(row('P4')).toMatchObject({ answered: 4, valid: 2, abstentions: 1, noValidAnswer: 1 });
    expect(pct('P4')).toEqual({ POR_ENCIMA: 50, EN_LA_MEDIA: 50, POR_DEBAJO: 0, NS_NC: 0 });
    expect(r.pendingReview).toBe(2); // P1 and P7.1 of the fifth person
  });

  it('multiple choice (P2): percentage of people, the sum may exceed 100 %; «Otros» texts are listed', () => {
    expect(row('P2')).toMatchObject({ valid: 4 });
    expect(pct('P2')).toEqual({ INTRANET: 25, MAIL: 50, REUNIONES: 25, BOCA_A_BOCA: 0, OTROS: 25, NINGUNO: 25 });
    expect(row('P2').optionTexts).toEqual({ OTROS: ['Por correo y en el tablón'] });
  });

  it('P7.1 only over those who exceed the working day, with the effective P7', () => {
    // Person 4: P7 recoded «Nunca» → their P7.1 leaves the base. Person 5: P7.1 still pending.
    expect(row('P7.1')).toMatchObject({ answered: 4, valid: 2, outsideCondition: 1, pendingReview: 1 });
    expect(pct('P7.1')).toEqual({ SI_TIEMPO: 50, SI_ECONOMICA: 0, SI_AMBAS: 0, NO: 50 });
  });

  it('P8: «No sabe / No contesta» is counted but left out of the base', () => {
    expect(row('P8')).toMatchObject({ answered: 5, valid: 2, abstentions: 1 });
    expect(row('P8').options.find((o) => o.code === 'NS_NC')).toEqual({ code: 'NS_NC', count: 2, percent: null, excludedFromBase: true });
    expect(pct('P8')).toMatchObject({ GRAN_AVANCE: 50, MODERADO: 50, NULO: 0 });
  });

  it('Bienestar scale and open questions', () => {
    expect(pct('P11')).toEqual({ EN_DESACUERDO: 25, NI_DE_ACUERDO_NI_EN_DESACUERDO: 25, DE_ACUERDO: 50 });
    expect(row('P10')).toMatchObject({ answered: 3, comments: 1, abstentions: 1, valid: 0 });
    expect(row('P10').options).toEqual([]);
    expect(row('P15')).toMatchObject({ answered: 1, comments: 0 });
    expect(row('P3.1')).toMatchObject({ answered: 0 });
    expect(row('P9')).toMatchObject({ answered: 0, valid: 0 });
    expect(pct('P9')).toEqual({ SI: null, NO: null });
  });

  it('no interviews: empty results', () => {
    const empty = computeResults(questions, renovacion, []);
    expect(empty).toMatchObject({ completed: 0, pendingReview: 0 });
    expect(demographicsOf([]).bySex.Mujer).toBe(0);
  });
});

describe('review input', () => {
  it('the auditor decides codes that fit the question, an abstention or «sin respuesta válida»', () => {
    expect(reviewInputError(q('P1'), 'codes', ['SI'])).toBeNull();
    expect(reviewInputError(q('P1'), 'codes', ['SI', 'NO'])).toBe('INVALID_OPTIONS');
    expect(reviewInputError(q('P1'), 'codes', [])).toBe('INVALID_OPTIONS');
    expect(reviewInputError(q('P1'), 'codes', ['SIEMPRE'])).toBe('INVALID_OPTIONS');
    expect(reviewInputError(q('P2'), 'codes', ['MAIL', 'OTROS', 'MAIL'])).toBeNull();
    expect(reviewInputError(q('P1'), 'abstention')).toBeNull();
    expect(reviewInputError(q('P1'), 'no_valid_answer', [])).toBeNull();
    expect(reviewInputError(q('P1'), 'abstention', ['SI'])).toBe('INVALID_OPTIONS');
    expect(reviewInputError(q('P10'), 'abstention')).toBe('NOT_REVIEWABLE');
  });
});
