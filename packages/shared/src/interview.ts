/**
 * Interview engine (section 5.5). Deterministic: which question comes next, how a participant input is
 * turned into a coded answer, when to follow up (at most `maxClarifications` times, 2 in the conversational
 * questionnaire, and why) and when to send it to human review.
 * The AI only phrases and classifies free text; it never decides any of this.
 */
import { ABSTENTION_CODE, type AnswerStatus, type Language } from './enums';
import { evaluateActivation, type ActivationContext, type Question } from './questionnaire';

/** Answer statuses that close a question (the engine moves on). */
export const FINAL_ANSWER_STATUSES: readonly AnswerStatus[] = ['classified', 'abstained', 'pending_review'];

export interface EngineAnswer {
  questionCode: string;
  optionCodes: readonly string[];
  status: AnswerStatus;
}

export const isFinalAnswer = (a: EngineAnswer | undefined): boolean => !!a && FINAL_ANSWER_STATUSES.includes(a.status);

/**
 * Option codes known per question, for activation rules. Abstentions count as answered with `ABSTENCION`.
 * An answer waiting for human review is unknown, so the questions that depend on it are asked anyway
 * (they are worded «en caso de…» and can be declined) — decision 70.
 */
export function knownAnswers(answers: readonly EngineAnswer[]): Record<string, string[] | undefined> {
  const known: Record<string, string[] | undefined> = {};
  for (const a of answers) {
    if (a.status === 'classified') known[a.questionCode] = [...a.optionCodes];
    else if (a.status === 'abstained') known[a.questionCode] = [ABSTENTION_CODE];
  }
  return known;
}

/**
 * Next question to ask: the first one (by `order`) without a final answer whose activation is not false.
 * `null` = the interview is complete.
 */
export function nextQuestion(
  questions: readonly Question[],
  campaign: ActivationContext['campaign'],
  answers: readonly EngineAnswer[],
): Question | null {
  const byCode = new Map(answers.map((a) => [a.questionCode, a]));
  const ctx: ActivationContext = { campaign, answers: knownAnswers(answers) };
  for (const q of [...questions].sort((a, b) => a.order - b.order)) {
    if (isFinalAnswer(byCode.get(q.code))) continue;
    if (evaluateActivation(q.activation, ctx) === false) continue;
    return q;
  }
  return null;
}

/** Questions that will be asked at most (active + conditional), for the progress bar. */
export function plannedQuestionCount(
  questions: readonly Question[],
  campaign: ActivationContext['campaign'],
  answers: readonly EngineAnswer[],
): number {
  const ctx: ActivationContext = { campaign, answers: knownAnswers(answers) };
  return questions.filter((q) => evaluateActivation(q.activation, ctx) !== false).length;
}

// ---------- Participant input → coded answer

export type ParticipantInput =
  | { kind: 'options'; optionCodes: string[]; freeText?: string | null }
  | { kind: 'abstain' }
  | { kind: 'text'; text: string };

/** Classification returned by the AI, already validated against the schema. */
export interface TextClassification {
  optionCodes: string[];
  confidence: number;
  /** `question`: the participant asks what something means instead of answering (decision 91). */
  status: 'classified' | 'ambiguous' | 'abstained' | 'off_topic' | 'question';
  supportingQuote: string;
}

/**
 * Why the AI follows up (decision 91):
 * - `question`: explain with the approved explanation and ask again;
 * - `confirm`: propose the likely interpretation and ask the participant to confirm it;
 * - `ambiguous`: pick up what the participant said and ask more concretely;
 * - `off_topic`: thank and bring the conversation back to the question.
 */
export const FOLLOW_UP_REASONS = ['question', 'confirm', 'ambiguous', 'off_topic'] as const;
export type FollowUpReason = (typeof FOLLOW_UP_REASONS)[number];

/** Below the review threshold but at least this confident: the AI proposes its interpretation to confirm. */
export const CONFIRMATION_MIN_CONFIDENCE = 0.5;

export interface CodedAnswer {
  optionCodes: string[];
  status: AnswerStatus;
  confidence: number | null;
  freeText: string | null;
  supportingQuote: string | null;
  viaButton: boolean;
}

export type InputError = 'INVALID_OPTIONS' | 'ABSTAIN_NOT_ALLOWED' | 'FREE_TEXT_REQUIRED' | 'EMPTY_ANSWER' | 'TEXT_ANSWER_REQUIRED';

export type AnswerOutcome =
  | { action: 'record'; answer: CodedAnswer }
  | { action: 'clarify'; reason: FollowUpReason; proposedCodes?: string[] }
  | { action: 'reject'; error: InputError };

/** Text mode (decision 90): closed questions are answered in own words; option buttons are not accepted. */
export const answerModeOf = (q: Question) => q.answerMode ?? 'buttons';

const MAX_FREE_TEXT = 2000;
const clean = (t: string | null | undefined): string | null => {
  const v = (t ?? '').trim().slice(0, MAX_FREE_TEXT);
  return v ? v : null;
};

/** Validates option codes for the question type (single/yes_no: exactly one; multi: one or more). */
export function validateOptionSelection(q: Question, optionCodes: readonly string[], freeText?: string | null): InputError | null {
  const codes = [...new Set(optionCodes)];
  if (q.type === 'free_text' || codes.length === 0) return 'INVALID_OPTIONS';
  if (q.type !== 'multi' && codes.length !== 1) return 'INVALID_OPTIONS';
  const options = codes.map((c) => q.options.find((o) => o.code === c));
  if (options.some((o) => !o)) return 'INVALID_OPTIONS';
  if (options.some((o) => o!.freeText?.required) && !clean(freeText)) return 'FREE_TEXT_REQUIRED';
  return null;
}

/** Buttons and «Prefiero no responder»: coded directly with confidence 1. */
export function resolveDirectAnswer(q: Question, input: Exclude<ParticipantInput, { kind: 'text' }>): AnswerOutcome {
  if (input.kind === 'abstain') {
    if (!q.allowAbstain) return { action: 'reject', error: 'ABSTAIN_NOT_ALLOWED' };
    return {
      action: 'record',
      answer: { optionCodes: [ABSTENTION_CODE], status: 'abstained', confidence: 1, freeText: null, supportingQuote: null, viaButton: true },
    };
  }
  if (answerModeOf(q) === 'text') return { action: 'reject', error: 'TEXT_ANSWER_REQUIRED' };
  const error = validateOptionSelection(q, input.optionCodes, input.freeText);
  if (error) return { action: 'reject', error };
  return {
    action: 'record',
    answer: {
      optionCodes: [...new Set(input.optionCodes)],
      status: 'classified',
      confidence: 1,
      freeText: clean(input.freeText),
      supportingQuote: null,
      viaButton: true,
    },
  };
}

/** Free-text questions (P10) are stored as written; closed questions need the AI classification. */
export const needsClassification = (q: Question): boolean => q.type !== 'free_text';

/**
 * Free text written by the participant.
 * @param classification AI output validated with the schema, or `null` when it was invalid twice.
 * @param clarificationsUsed clarifications already asked for this question.
 * @param threshold minimum confidence (settings, 0.8 by default).
 */
export function resolveTextAnswer(
  q: Question,
  text: string,
  classification: TextClassification | null,
  clarificationsUsed: number,
  threshold: number,
): AnswerOutcome {
  const written = clean(text);
  if (!written) return { action: 'reject', error: 'EMPTY_ANSWER' };
  if (!needsClassification(q)) {
    return { action: 'record', answer: { optionCodes: [], status: 'classified', confidence: 1, freeText: written, supportingQuote: null, viaButton: false } };
  }
  const review = (codes: string[] = [], c: TextClassification | null = classification): AnswerOutcome => ({
    action: 'record',
    answer: {
      optionCodes: codes,
      status: 'pending_review',
      confidence: c?.confidence ?? null,
      freeText: written,
      supportingQuote: c?.supportingQuote || null,
      viaButton: false,
    },
  });
  if (!classification) return review();
  const canClarify = clarificationsUsed < q.maxClarifications;
  const followUp = (reason: FollowUpReason): AnswerOutcome => (canClarify ? { action: 'clarify', reason } : review());

  if (classification.status === 'abstained') {
    if (q.allowAbstain) {
      return {
        action: 'record',
        answer: { optionCodes: [ABSTENTION_CODE], status: 'abstained', confidence: classification.confidence, freeText: written, supportingQuote: classification.supportingQuote || null, viaButton: false },
      };
    }
    return followUp('ambiguous');
  }
  if (classification.status === 'question') return followUp('question');
  if (classification.status === 'classified') {
    const codes = [...new Set(classification.optionCodes)];
    // In own words the written text is also the complement of «Otros, ¿cuál?».
    const valid = validateOptionSelection(q, codes, written) === null;
    if (valid && classification.confidence >= threshold) {
      return {
        action: 'record',
        answer: {
          optionCodes: codes,
          status: 'classified',
          confidence: classification.confidence,
          freeText: written,
          supportingQuote: classification.supportingQuote || null,
          viaButton: false,
        },
      };
    }
    // Low confidence: the AI proposes its interpretation while follow-ups remain (decision 91); otherwise review
    // (section 5.5, step 6). Invalid codes are treated as ambiguous.
    if (valid) {
      if (!canClarify) return review(codes);
      return classification.confidence >= CONFIRMATION_MIN_CONFIDENCE ? { action: 'clarify', reason: 'confirm', proposedCodes: codes } : { action: 'clarify', reason: 'ambiguous' };
    }
  }
  return followUp(classification.status === 'off_topic' ? 'off_topic' : 'ambiguous');
}

// ---------- What the AI may see

/** Localized text with Spanish fallback. */
export const localized = (t: Partial<Record<Language, string>> | null | undefined, lang: Language): string =>
  t?.[lang] ?? t?.es ?? '';

const REDACTED = '[…]';
const PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, // emails
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // links (may carry invitation tokens)
  /\b[A-Za-z0-9_-]{20,}\b/g, // long tokens / ids
  /\b[A-HJKMNP-Z2-9]{4}[\s-]?[A-HJKMNP-Z2-9]{4}\b/g, // access codes (8 chars of the code alphabet, as printed)
  /(?:\+?\d[\d\s.-]{6,}\d)/g, // phone numbers, document numbers
];

/**
 * Removes identifiers a participant might type (emails, links, codes, phone or document numbers) before the
 * text is sent to the AI provider. Section 5.5: only question, options and answer are sent.
 */
export function redactIdentifiers(text: string): string {
  return PATTERNS.reduce((t, re) => t.replace(re, REDACTED), text);
}

const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignor(a|e|ez|ar|en|es)\b/i,
  /\binstruc(c|t)i/i,
  /\bprompt\b/i,
  /\b(marca|marque|marcar|selecciona|seleccione|elige|elija|escoge|select|choose|mark|pick|cochez|choisissez|escolha)\b[^.]{0,30}\b(opci[oó]n|option|opção|opcao|respuesta|answer|réponse|resposta|c[oó]digo|code)\b/i,
  /\b(responde|responda|answer|réponds|répondez)\s+(siempre\s+|always\s+|toujours\s+|sempre\s+)?(con|with|avec|com)\b/i,
  /\b(clasifica|classify|classifie|classifique)\b/i,
  /\b(json|optionCodes|confidence|supportingQuote)\b/i,
  /\b(eres|you are|tu es|você é) (un|una|an|a|um|uma) (modelo|model|ia|ai|asistente|assistant)\b/i,
];

/**
 * True when a free-text answer reads like instructions to the AI («ignora…», «marca la opción…»). Such
 * answers are never sent for classification: they are treated as off topic (clarification, then review).
 */
export function looksLikeInstructions(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((re) => re.test(text));
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Option labels (4+ letters, so «sí»/«no» do not count) mentioned in a text. */
const mentionedLabels = (text: string, labels: readonly string[]): string[] => {
  const t = ` ${fold(text).replace(/[^a-z0-9]+/g, ' ')} `;
  return labels.filter((l) => {
    const f = fold(l).replace(/[^a-z0-9]+/g, ' ').trim();
    return f.length >= 4 && t.includes(` ${f} `);
  });
};

/**
 * Guard for the AI phrasing of a question: it must stay a single question of similar length, without links,
 * emails, numbers or answer options that are not in the official text. Otherwise the official text is used.
 */
export function safePhrasing(official: string, phrased: string | null | undefined, optionLabels: readonly string[] = []): string {
  const p = (phrased ?? '').trim();
  if (!p) return official;
  const questionMarks = (s: string) => (s.match(/\?/g) ?? []).length;
  const numbers = (s: string) => s.match(/\d+/g) ?? [];
  const officialNumbers = new Set(numbers(official));
  const officialLabels = new Set(mentionedLabels(official, optionLabels));
  // A cut-off output (e.g. «¿Sabe quién ocupa el puesto de M») must never reach the participant.
  const complete = p.length >= official.length * 0.4 && (!official.trim().endsWith('?') || p.endsWith('?'));
  const ok =
    complete &&
    p.length <= Math.max(official.length * 2, official.length + 200) &&
    questionMarks(p) <= Math.max(1, questionMarks(official)) &&
    !/@|https?:\/\/|www\./i.test(p) &&
    numbers(p).every((n) => officialNumbers.has(n)) &&
    mentionedLabels(p, optionLabels).every((l) => officialLabels.has(l));
  return ok ? p : official;
}

/**
 * Guard for the AI follow-up: complete, at most 800 characters, no links or emails, no figures that are not in
 * the approved texts (`sources`: question, answer hint, explanation, help), and it names either all the options
 * (or at least those the approved `answerHint` names) or none: naming only some would suggest an answer. The only
 * exception is a confirmation, which may name the interpretation being proposed (`proposedLabels`). Otherwise the
 * neutral default is used.
 */
export function safeClarification(
  fallback: string,
  phrased: string | null | undefined,
  optionLabels: readonly string[] = [],
  opts: { proposedLabels?: readonly string[]; sources?: readonly string[]; answerHint?: string | null } = {},
): string {
  const p = (phrased ?? '').trim();
  const named = mentionedLabels(p, optionLabels);
  const nameable = optionLabels.filter((l) => fold(l).replace(/[^a-z0-9]+/g, ' ').trim().length >= 4).length;
  const proposed = new Set(mentionedLabels((opts.proposedLabels ?? []).join(' · '), optionLabels));
  // The approved answer hint presents every option in natural words (e.g. «…o que no lo sabe»): naming at least
  // the labels it names is presenting them all.
  const hinted = mentionedLabels(opts.answerHint ?? '', optionLabels);
  const neutral =
    named.length === 0 ||
    named.length === nameable ||
    (hinted.length > 0 && hinted.every((l) => named.includes(l))) ||
    (proposed.size > 0 && named.every((l) => proposed.has(l)));
  const allowedNumbers = new Set([fallback, ...(opts.sources ?? [])].join(' ').match(/\d+/g) ?? []);
  const figures = (p.match(/\d+/g) ?? []).every((n) => allowedNumbers.has(n));
  const complete = p.length >= 15 && /[?.!)»"”]$/.test(p);
  return p && complete && p.length <= 800 && !/@|https?:\/\/|www\./i.test(p) && neutral && figures ? p : fallback;
}
