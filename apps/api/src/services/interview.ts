/**
 * Interview service (section 5.5): glues the deterministic engine of `packages/shared` with the AI provider.
 * - The next question, the coding rules, the clarification limit and the review threshold are shared code.
 * - The AI only phrases (checked by `safePhrasing`), classifies free text (validated with the schema, one
 *   retry) and phrases the single clarification (checked by `safeClarification`).
 * - Only question text, options and the answer (with identifiers removed) are sent to the provider.
 */
import {
  ABSTENTION_CODE,
  localized,
  looksLikeInstructions,
  needsClassification,
  nextQuestion,
  plannedQuestionCount,
  redactIdentifiers,
  resolveDirectAnswer,
  resolveTextAnswer,
  safeClarification,
  safePhrasing,
  type ActivationContext,
  type AnswerOutcome,
  type EngineAnswer,
  type InterviewAnswerInput,
  type InterviewMessageView,
  type InterviewQuestionView,
  type InterviewState,
  type InterviewStateDto,
  type Language,
  type Question,
  type TextClassification,
} from '@smartaudit/shared';
import { defaultClarification, parseClassification, PROMPT_VERSION, type QuestionPayload } from '@smartaudit/llm';
import type { HydratedDocument } from 'mongoose';
import type { AppContext } from '../context';
import { conflict, unprocessable } from '../lib/errors';
import { Interview, Respondent, getSettings, type CampaignDoc } from '../models';
import { closeIfMaximumReached } from './campaigns';

type InterviewDoc = HydratedDocument<InstanceType<typeof Interview>>;
interface AnswerRecord {
  questionCode: string;
  originalText?: string | null;
  optionCodes: string[];
  freeText?: string | null;
  status: string;
  confidence?: number | null;
  supportingQuote?: string | null;
  clarificationsUsed: number;
  viaButton: boolean;
  model?: string | null;
  promptVersion?: string | null;
}
interface MessageRecord {
  role: 'assistant' | 'participant';
  kind: InterviewMessageView['kind'];
  text: string;
  questionCode: string | null;
  at: Date;
}

/** Typed views of the Mongoose arrays (they stay the live arrays, so pushes are persisted). */
const answersOf = (i: InterviewDoc) => i.answers as unknown as AnswerRecord[];
const messagesOf = (i: InterviewDoc) => i.messages as unknown as MessageRecord[];

const questionsOf = (c: CampaignDoc) => (c.questionnaireSnapshot?.questions ?? []) as Question[];
const activationOf = (c: CampaignDoc): ActivationContext['campaign'] => ({
  auditType: c.m1Config!.auditType as ActivationContext['campaign']['auditType'],
  excellence: c.m1Config!.excellence,
  norm: c.m1Config!.norm,
});

/** What the provider may see: question text, type and options. Never identifiers. */
export const questionPayload = (q: Question, language: Language): QuestionPayload => ({
  questionCode: q.code,
  type: q.type,
  text: localized(q.text, language),
  help: q.help ? localized(q.help, language) : null,
  options: q.options.map((o) => ({ code: o.code, label: localized(o.label, language) })),
  language,
});

export const questionView = (q: Question, language: Language, text: string): InterviewQuestionView => ({
  code: q.code,
  type: q.type,
  text,
  help: q.help ? localized(q.help, language) : null,
  options: q.options.map((o) => ({
    code: o.code,
    label: localized(o.label, language),
    freeText: o.freeText ? { label: localized(o.freeText.label, language), required: o.freeText.required } : null,
  })),
  allowAbstain: q.allowAbstain,
  mandatory: q.mandatory,
});

const engineAnswers = (i: InterviewDoc) =>
  answersOf(i).map((a) => ({ questionCode: a.questionCode, optionCodes: a.optionCodes, status: a.status as EngineAnswer['status'] }));

const lastAssistant = (i: InterviewDoc) => [...messagesOf(i)].reverse().find((m) => m.role === 'assistant');

/** Makes sure the next question has been asked (phrased once); returns it, or `null` when complete. */
async function askNext(ctx: AppContext, i: InterviewDoc, c: CampaignDoc): Promise<Question | null> {
  const next = nextQuestion(questionsOf(c), activationOf(c), engineAnswers(i));
  if (!next) return null;
  const last = lastAssistant(i);
  if (last && last.questionCode === next.code && (last.kind === 'question' || last.kind === 'clarification')) return next;
  const language = i.language as Language;
  const official = localized(next.text, language);
  let text = official;
  try {
    const payload = questionPayload(next, language);
    text = safePhrasing(official, (await ctx.llm.phraseQuestion(payload)).text, payload.options.map((o) => o.label));
  } catch (err) {
    ctx.logger.warn({ err: (err as Error).message, question: next.code }, 'phrasing failed, official text used');
  }
  messagesOf(i).push({ role: 'assistant', kind: 'question', text, questionCode: next.code, at: ctx.now() });
  return next;
}

export function toStateDto(i: InterviewDoc, c: CampaignDoc, next: Question | null): InterviewStateDto {
  const language = i.language as Language;
  const last = lastAssistant(i);
  const final = new Set(answersOf(i).filter((a) => ['classified', 'abstained', 'pending_review'].includes(a.status)).map((a) => a.questionCode));
  return {
    state: i.state as InterviewState,
    language,
    messages: messagesOf(i).map((m) => ({ role: m.role, kind: m.kind, text: m.text, questionCode: m.questionCode ?? null, at: new Date(m.at).toISOString() })),
    question: next ? questionView(next, language, last?.questionCode === next.code ? last.text : localized(next.text, language)) : null,
    clarifying: !!next && last?.kind === 'clarification' && last.questionCode === next.code,
    progress: { answered: final.size, planned: plannedQuestionCount(questionsOf(c), activationOf(c), engineAnswers(i)) },
  };
}

/** Creates the interview (or resumes it) and asks the first pending question. */
export async function startInterview(
  ctx: AppContext,
  c: CampaignDoc,
  respondentId: string,
  language: Language,
): Promise<InterviewStateDto> {
  let i = (await Interview.findOne({ respondentId })) as InterviewDoc | null;
  if (!i) {
    i = (await Interview.create({
      campaignId: c._id,
      organizationId: c.organizationId,
      respondentId,
      module: 'M1',
      language,
      state: 'in_progress',
      startedAt: ctx.now(),
      llmModel: ctx.llm.name,
      promptVersion: PROMPT_VERSION,
    })) as InterviewDoc;
    await Respondent.updateOne({ _id: respondentId, status: { $in: ['pending', 'invited'] } }, { $set: { status: 'started', startedAt: ctx.now() } });
  }
  return resumeInterview(ctx, i, c);
}

export async function resumeInterview(ctx: AppContext, i: InterviewDoc, c: CampaignDoc): Promise<InterviewStateDto> {
  const next = i.state === 'completed' ? null : await askNext(ctx, i, c);
  if (i.isModified()) await i.save();
  return toStateDto(i, c, next);
}

/** Classification by the AI: validated with the schema, retried once, `null` if still invalid. */
async function classify(ctx: AppContext, payload: QuestionPayload, text: string): Promise<{ c: TextClassification | null; model: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await ctx.llm.classifyAnswer(payload, text);
      const parsed = parseClassification(raw);
      if (parsed) return { c: parsed, model: raw.model };
    } catch (err) {
      ctx.logger.warn({ err: (err as Error).message, question: payload.questionCode, attempt }, 'classification failed');
    }
  }
  return { c: null, model: null };
}

const OFF_TOPIC: TextClassification = { optionCodes: [], confidence: 0, status: 'off_topic', supportingQuote: '' };

/** Processes one participant input for the current question and returns the new state. */
export async function answerInterview(
  ctx: AppContext,
  i: InterviewDoc,
  c: CampaignDoc,
  input: InterviewAnswerInput,
): Promise<InterviewStateDto> {
  if (i.state === 'completed') throw conflict('INTERVIEW_COMPLETED');
  const current = nextQuestion(questionsOf(c), activationOf(c), engineAnswers(i));
  if (!current) throw conflict('INTERVIEW_COMPLETED');
  if (input.questionCode !== current.code) throw conflict('QUESTION_MISMATCH');
  const language = i.language as Language;
  const payload = questionPayload(current, language);
  const previous = answersOf(i).find((a) => a.questionCode === current.code);
  const clarificationsUsed = previous?.clarificationsUsed ?? 0;

  let outcome: AnswerOutcome;
  let classification: TextClassification | null = null;
  let model: string | null = null;
  if (input.kind === 'text') {
    if (!needsClassification(current)) {
      outcome = resolveTextAnswer(current, input.text, null, clarificationsUsed, 1);
    } else {
      if (looksLikeInstructions(input.text)) classification = OFF_TOPIC;
      else ({ c: classification, model } = await classify(ctx, payload, redactIdentifiers(input.text)));
      const { confidenceThreshold } = await getSettings();
      outcome = resolveTextAnswer(current, input.text, classification, clarificationsUsed, confidenceThreshold);
    }
  } else {
    outcome = resolveDirectAnswer(current, input.kind === 'abstain' ? { kind: 'abstain' } : { kind: 'options', optionCodes: input.optionCodes, freeText: input.freeText });
  }
  if (outcome.action === 'reject') throw unprocessable(outcome.error);

  // The participant's message, as shown in the conversation.
  const labels = input.kind === 'options' ? input.optionCodes.map((code) => payload.options.find((o) => o.code === code)?.label ?? code) : [];
  const shown =
    input.kind === 'text' ? input.text.trim() : input.kind === 'abstain' ? '' : [...labels, ...(input.freeText?.trim() ? [input.freeText.trim()] : [])].join(' · ');
  messagesOf(i).push({ role: 'participant', kind: input.kind, text: shown, questionCode: current.code, at: ctx.now() });

  const record = (a: Partial<AnswerRecord> & Pick<AnswerRecord, 'status'>) => {
    const value: AnswerRecord = {
      questionCode: current.code,
      originalText: input.kind === 'text' ? input.text.trim() : null,
      optionCodes: [],
      freeText: null,
      confidence: null,
      supportingQuote: null,
      viaButton: input.kind !== 'text',
      model: input.kind === 'text' && needsClassification(current) ? model ?? ctx.llm.name : null,
      promptVersion: input.kind === 'text' && needsClassification(current) ? PROMPT_VERSION : null,
      clarificationsUsed,
      ...a,
    };
    const idx = answersOf(i).findIndex((x) => x.questionCode === current.code);
    if (idx >= 0) answersOf(i).splice(idx, 1, value);
    else answersOf(i).push(value);
  };

  if (outcome.action === 'clarify') {
    record({ status: classification!.status === 'off_topic' ? 'off_topic' : 'ambiguous', confidence: classification!.confidence, clarificationsUsed: clarificationsUsed + 1 });
    const fallback = defaultClarification(payload);
    let text = fallback;
    try {
      const phrased = (await ctx.llm.phraseClarification(payload, redactIdentifiers(input.kind === 'text' ? input.text : ''))).text;
      text = safeClarification(fallback, phrased, payload.options.map((o) => o.label));
    } catch (err) {
      ctx.logger.warn({ err: (err as Error).message, question: current.code }, 'clarification failed, default used');
    }
    messagesOf(i).push({ role: 'assistant', kind: 'clarification', text, questionCode: current.code, at: ctx.now() });
  } else {
    record({ ...outcome.answer, optionCodes: outcome.answer.optionCodes.length ? outcome.answer.optionCodes : outcome.answer.status === 'abstained' ? [ABSTENTION_CODE] : [] });
  }

  const next = await askNext(ctx, i, c);
  let completed = false;
  if (!next) {
    i.state = 'completed';
    i.completedAt = ctx.now();
    completed = true;
  }
  await i.save();
  if (completed) {
    await Respondent.updateOne({ _id: i.respondentId }, { $set: { status: 'completed', completedAt: ctx.now() } });
    await closeIfMaximumReached(ctx, String(c._id));
  }
  return toStateDto(i, c, next);
}

export const findInterview = async (respondentId: string) => (await Interview.findOne({ respondentId })) as InterviewDoc | null;
