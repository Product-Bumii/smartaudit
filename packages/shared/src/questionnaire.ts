/**
 * Questionnaire structure and declarative activation rules (section 5.2).
 * Activation is ALWAYS evaluated here, in code, never by the AI.
 */
import { ABSTENTION_CODE, type AuditType, type Language, type QuestionType, type TranslationStatus } from './enums';

export type LocalizedText = Partial<Record<Language, string>>;

/** Campaign fields an activation rule may reference. */
export type CampaignActivationField = 'auditType' | 'excellence' | 'norm';

export type Activation =
  | { kind: 'always' }
  | { kind: 'answer_in'; question: string; values: string[] }
  | { kind: 'campaign_in'; field: CampaignActivationField; values: (string | boolean)[] }
  | { kind: 'all'; of: Activation[] }
  | { kind: 'any'; of: Activation[] }
  | { kind: 'not'; expr: Activation };

export interface QuestionOption {
  code: string;
  label: LocalizedText;
  /** Option that asks for a complementary free text (e.g. «Otros, ¿cuál?»). */
  freeText?: { label: LocalizedText; required: boolean } | null;
}

export interface Question {
  code: string;
  block: string;
  order: number;
  type: QuestionType;
  text: LocalizedText;
  help?: LocalizedText | null;
  options: QuestionOption[];
  activation: Activation;
  mandatory: boolean;
  allowAbstain: boolean;
  maxClarifications: number;
  reportMapping?: string | null;
}

export interface QuestionnaireLanguage {
  lang: Language;
  status: TranslationStatus;
}

export interface ActivationContext {
  campaign: { auditType: AuditType; excellence: boolean; norm: string };
  /** Option codes given per question code. Missing key = not answered yet (unknown). */
  answers?: Readonly<Record<string, readonly string[] | undefined>>;
}

/** Three-valued result: `null` means it depends on answers that are not known yet. */
export type Tristate = boolean | null;

export function evaluateActivation(expr: Activation, ctx: ActivationContext): Tristate {
  switch (expr.kind) {
    case 'always':
      return true;
    case 'answer_in': {
      const given = ctx.answers?.[expr.question];
      if (given === undefined) return null;
      return given.some((code) => expr.values.includes(code));
    }
    case 'campaign_in':
      return expr.values.includes(ctx.campaign[expr.field]);
    case 'all': {
      const results = expr.of.map((e) => evaluateActivation(e, ctx));
      if (results.includes(false)) return false;
      return results.includes(null) ? null : true;
    }
    case 'any': {
      const results = expr.of.map((e) => evaluateActivation(e, ctx));
      if (results.includes(true)) return true;
      return results.includes(null) ? null : false;
    }
    case 'not': {
      const r = evaluateActivation(expr.expr, ctx);
      return r === null ? null : !r;
    }
  }
}

export type QuestionActivationState = 'active' | 'conditional' | 'inactive';

/**
 * State of each question for a campaign: `active` (will be asked), `inactive` (never asked)
 * or `conditional` (depends on the participant's previous answers). Sorted by `order`.
 */
export function classifyQuestions(
  questions: readonly Question[],
  ctx: ActivationContext,
): { code: string; order: number; mandatory: boolean; state: QuestionActivationState }[] {
  return [...questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      const r = evaluateActivation(q.activation, ctx);
      const state: QuestionActivationState = r === true ? 'active' : r === false ? 'inactive' : 'conditional';
      return { code: q.code, order: q.order, mandatory: q.mandatory, state };
    });
}

/** Languages offered to participants: enabled in the campaign AND approved in the questionnaire. */
export function offeredLanguages(
  questionnaireLanguages: readonly QuestionnaireLanguage[],
  campaignLanguages: readonly Language[],
): Language[] {
  return questionnaireLanguages
    .filter((l) => l.status === 'approved' && campaignLanguages.includes(l.lang))
    .map((l) => l.lang);
}

export type QuestionnaireIssue =
  | { code: 'NO_QUESTIONS' }
  | { code: 'DUPLICATE_QUESTION_CODE'; question: string }
  | { code: 'DUPLICATE_ORDER'; question: string }
  | { code: 'DUPLICATE_OPTION_CODE'; question: string; option: string }
  | { code: 'RESERVED_OPTION_CODE'; question: string; option: string }
  | { code: 'OPTIONS_REQUIRED'; question: string }
  | { code: 'OPTIONS_NOT_ALLOWED'; question: string }
  | { code: 'UNKNOWN_ACTIVATION_REFERENCE'; question: string; reference: string }
  | { code: 'FORWARD_ACTIVATION_REFERENCE'; question: string; reference: string }
  | { code: 'MISSING_TRANSLATION'; question: string; lang: Language; field: string };

function referencedQuestions(expr: Activation): string[] {
  switch (expr.kind) {
    case 'answer_in':
      return [expr.question];
    case 'all':
    case 'any':
      return expr.of.flatMap(referencedQuestions);
    case 'not':
      return referencedQuestions(expr.expr);
    default:
      return [];
  }
}

/** Texts missing for a language (used before approving a translation). */
export function missingTranslations(questions: readonly Question[], lang: Language): QuestionnaireIssue[] {
  const issues: QuestionnaireIssue[] = [];
  const missing = (t: LocalizedText | null | undefined) => !t?.[lang]?.trim();
  for (const q of questions) {
    if (missing(q.text)) issues.push({ code: 'MISSING_TRANSLATION', question: q.code, lang, field: 'text' });
    if (q.help && missing(q.help)) {
      issues.push({ code: 'MISSING_TRANSLATION', question: q.code, lang, field: 'help' });
    }
    for (const o of q.options) {
      if (missing(o.label)) {
        issues.push({ code: 'MISSING_TRANSLATION', question: q.code, lang, field: `option:${o.code}` });
      }
      if (o.freeText && missing(o.freeText.label)) {
        issues.push({ code: 'MISSING_TRANSLATION', question: q.code, lang, field: `option:${o.code}:freeText` });
      }
    }
  }
  return issues;
}

/** Structural validation done before publishing a questionnaire version. */
export function validateQuestionnaire(questions: readonly Question[]): QuestionnaireIssue[] {
  if (questions.length === 0) return [{ code: 'NO_QUESTIONS' }];
  const issues: QuestionnaireIssue[] = [];
  const byCode = new Map<string, Question>();
  const orders = new Set<number>();
  for (const q of questions) {
    if (byCode.has(q.code)) issues.push({ code: 'DUPLICATE_QUESTION_CODE', question: q.code });
    byCode.set(q.code, q);
    if (orders.has(q.order)) issues.push({ code: 'DUPLICATE_ORDER', question: q.code });
    orders.add(q.order);

    const optionCodes = new Set<string>();
    for (const o of q.options) {
      if (o.code === ABSTENTION_CODE) issues.push({ code: 'RESERVED_OPTION_CODE', question: q.code, option: o.code });
      if (optionCodes.has(o.code)) issues.push({ code: 'DUPLICATE_OPTION_CODE', question: q.code, option: o.code });
      optionCodes.add(o.code);
    }
    if (q.type === 'free_text' && q.options.length > 0) issues.push({ code: 'OPTIONS_NOT_ALLOWED', question: q.code });
    if (q.type !== 'free_text' && q.options.length === 0) issues.push({ code: 'OPTIONS_REQUIRED', question: q.code });
  }
  for (const q of questions) {
    for (const ref of referencedQuestions(q.activation)) {
      const target = byCode.get(ref);
      if (!target) issues.push({ code: 'UNKNOWN_ACTIVATION_REFERENCE', question: q.code, reference: ref });
      else if (target.order >= q.order) {
        issues.push({ code: 'FORWARD_ACTIVATION_REFERENCE', question: q.code, reference: ref });
      }
    }
  }
  return issues;
}
