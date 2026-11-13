import { describe, expect, it } from 'vitest';
import seed from '../../../seed/data/questionnaire-m1-v1.json';
import {
  classifyQuestions,
  evaluateActivation,
  missingTranslations,
  offeredLanguages,
  validateQuestionnaire,
  type Activation,
  type ActivationContext,
  type Question,
  type QuestionnaireLanguage,
} from '../src/questionnaire';
import { questionSchema } from '../src/schemas';

const questions = seed.questions as Question[];
const base: ActivationContext['campaign'] = { auditType: 'inicial', excellence: false, norm: '1000-1' };
const stateOf = (ctx: ActivationContext, code: string) => classifyQuestions(questions, ctx).find((q) => q.code === code)?.state;

describe('seed questionnaire M1 v1', () => {
  it('is structurally valid and matches the Zod schema', () => {
    expect(validateQuestionnaire(questions)).toEqual([]);
    questions.forEach((q) => expect(questionSchema.safeParse(q).success).toBe(true));
  });

  it.each(['es', 'en', 'ca', 'pt', 'fr'] as const)('has complete %s texts', (lang) => {
    expect(missingTranslations(questions, lang)).toEqual([]);
  });

  it('P8 is only active in renewal audits', () => {
    expect(stateOf({ campaign: base }, 'P8')).toBe('inactive');
    expect(stateOf({ campaign: { ...base, auditType: 'mantenimiento' } }, 'P8')).toBe('inactive');
    expect(stateOf({ campaign: { ...base, auditType: 'renovacion' } }, 'P8')).toBe('active');
  });

  it('P9 is only active when applying for / keeping excellence', () => {
    expect(stateOf({ campaign: base }, 'P9')).toBe('inactive');
    expect(stateOf({ campaign: { ...base, excellence: true } }, 'P9')).toBe('active');
  });

  it('P7.1 depends on P7', () => {
    expect(stateOf({ campaign: base }, 'P7.1')).toBe('conditional');
    expect(stateOf({ campaign: base, answers: { P7: ['NUNCA'] } }, 'P7.1')).toBe('inactive');
    expect(stateOf({ campaign: base, answers: { P7: ['ABSTENCION'] } }, 'P7.1')).toBe('inactive');
    expect(stateOf({ campaign: base, answers: { P7: ['ALGUNAS_VECES'] } }, 'P7.1')).toBe('active');
    expect(stateOf({ campaign: base, answers: { P7: ['SIEMPRE'] } }, 'P7.1')).toBe('active');
  });

  it('classification is sorted by order', () => {
    const codes = classifyQuestions([...questions].reverse(), { campaign: base }).map((q) => q.code);
    expect(codes[0]).toBe('P1');
    expect(codes[codes.length - 1]).toBe('P10');
  });
});

describe('evaluateActivation (three-valued logic)', () => {
  const unknown: Activation = { kind: 'answer_in', question: 'X', values: ['A'] };
  const yes: Activation = { kind: 'always' };
  const no: Activation = { kind: 'not', expr: { kind: 'always' } };
  const ctx: ActivationContext = { campaign: base };

  it.each<[string, Activation, boolean | null]>([
    ['all true', { kind: 'all', of: [yes, yes] }, true],
    ['all with false', { kind: 'all', of: [unknown, no] }, false],
    ['all with unknown', { kind: 'all', of: [yes, unknown] }, null],
    ['any true', { kind: 'any', of: [unknown, yes] }, true],
    ['any unknown', { kind: 'any', of: [no, unknown] }, null],
    ['any false', { kind: 'any', of: [no, no] }, false],
    ['not unknown', { kind: 'not', expr: unknown }, null],
    ['norm', { kind: 'campaign_in', field: 'norm', values: ['1000-2'] }, false],
  ])('%s', (_name, expr, expected) => {
    expect(evaluateActivation(expr, ctx)).toBe(expected);
  });
});

describe('offeredLanguages', () => {
  const langs: QuestionnaireLanguage[] = [
    { lang: 'es', status: 'approved' },
    { lang: 'en', status: 'pending_approval' },
    { lang: 'ca', status: 'approved' },
  ];
  it('offers only approved AND enabled languages', () => {
    expect(offeredLanguages(langs, ['es', 'en'])).toEqual(['es']);
    expect(offeredLanguages(langs, ['es', 'en', 'ca'])).toEqual(['es', 'ca']);
  });
});

describe('validateQuestionnaire', () => {
  const q = (over: Partial<Question>): Question => ({
    code: 'Q1',
    block: 'b',
    order: 1,
    type: 'single',
    text: { es: 'x' },
    options: [{ code: 'A', label: { es: 'a' } }],
    activation: { kind: 'always' },
    mandatory: true,
    allowAbstain: true,
    maxClarifications: 1,
    ...over,
  });

  it('rejects empty questionnaires', () => {
    expect(validateQuestionnaire([])).toEqual([{ code: 'NO_QUESTIONS' }]);
  });

  it('detects duplicates, reserved codes and option rules', () => {
    const issues = validateQuestionnaire([
      q({}),
      q({ options: [{ code: 'ABSTENCION', label: {} }, { code: 'B', label: {} }, { code: 'B', label: {} }] }),
      q({ code: 'Q3', order: 3, type: 'free_text' }),
      q({ code: 'Q4', order: 4, options: [] }),
    ]);
    expect(issues).toEqual([
      { code: 'DUPLICATE_QUESTION_CODE', question: 'Q1' },
      { code: 'DUPLICATE_ORDER', question: 'Q1' },
      { code: 'RESERVED_OPTION_CODE', question: 'Q1', option: 'ABSTENCION' },
      { code: 'DUPLICATE_OPTION_CODE', question: 'Q1', option: 'B' },
      { code: 'OPTIONS_NOT_ALLOWED', question: 'Q3' },
      { code: 'OPTIONS_REQUIRED', question: 'Q4' },
    ]);
  });

  it('detects unknown and forward activation references (also nested)', () => {
    const issues = validateQuestionnaire([
      q({ activation: { kind: 'all', of: [{ kind: 'answer_in', question: 'Q2', values: ['A'] }] } }),
      q({ code: 'Q2', order: 2, activation: { kind: 'not', expr: { kind: 'answer_in', question: 'ZZ', values: ['A'] } } }),
      q({ code: 'Q3', order: 3, activation: { kind: 'any', of: [{ kind: 'answer_in', question: 'Q1', values: ['A'] }] } }),
    ]);
    expect(issues).toEqual([
      { code: 'FORWARD_ACTIVATION_REFERENCE', question: 'Q1', reference: 'Q2' },
      { code: 'UNKNOWN_ACTIVATION_REFERENCE', question: 'Q2', reference: 'ZZ' },
    ]);
  });

  it('reports missing translations for text, help, options and free texts', () => {
    const issues = missingTranslations(
      [
        q({
          text: { es: 'x' },
          help: { es: 'h' },
          options: [{ code: 'A', label: { es: 'a' }, freeText: { label: { es: '¿cuál?' }, required: true } }],
        }),
        q({ code: 'Q2', text: { es: 'x', en: '  ' }, help: null, options: [{ code: 'A', label: { en: 'a' } }] }),
      ],
      'en',
    );
    expect(issues.map((i) => (i.code === 'MISSING_TRANSLATION' ? `${i.question}:${i.field}` : ''))).toEqual([
      'Q1:text',
      'Q1:help',
      'Q1:option:A',
      'Q1:option:A:freeText',
      'Q2:text',
    ]);
  });
});
