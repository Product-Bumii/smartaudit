/**
 * LLM provider interface (section 5.5). The AI is bounded: it phrases questions (buttons questionnaires),
 * classifies answers and writes the follow-ups the engine asks for (at most 2 per question in the
 * conversational questionnaire, decision 91). Order, conditions, limits and calculations are deterministic code.
 *
 * Adapters: `mock` (deterministic, development and tests) and `gemini` (Google Gemini, decision 83),
 * chosen with the `LLM_PROVIDER` env var.
 * Prompts are versioned in ./prompts.
 */
import { z } from 'zod';
import type { FollowUpReason, Language, QuestionType } from '@smartaudit/shared';

/** What the AI may see: question text, options and the participant answer. Never identifiers. */
export interface QuestionPayload {
  questionCode: string;
  type: QuestionType;
  text: string;
  help?: string | null;
  /** How the options are said after the question (conversational questionnaire). */
  answerHint?: string | null;
  /** Approved explanation: the only information the AI may give (decision 91). */
  explanation?: string | null;
  options: { code: string; label: string }[];
  language: Language;
}

/** Messages already exchanged about the current question (participant texts without identifiers). */
export interface ConversationTurn {
  role: 'assistant' | 'participant';
  text: string;
}

export interface ClassifyContext {
  thread: ConversationTurn[];
  /** Interpretation proposed in the last follow-up, waiting for the participant to confirm it. */
  proposedCodes?: string[];
}

export interface FollowUpRequest {
  reason: FollowUpReason;
  /** Last participant message, without identifiers. */
  answer: string;
  thread: ConversationTurn[];
  /** `confirm`: the interpretation to propose. */
  proposedCodes?: string[];
}

export const classificationSchema = z.object({
  optionCodes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  status: z.enum(['classified', 'ambiguous', 'abstained', 'off_topic', 'question']),
  supportingQuote: z.string().max(500),
});
export type Classification = z.infer<typeof classificationSchema>;

export interface LlmCallMeta {
  model: string;
  promptVersion: string;
}

export interface LlmProvider {
  readonly name: string;
  phraseQuestion(q: QuestionPayload): Promise<{ text: string } & LlmCallMeta>;
  classifyAnswer(q: QuestionPayload, answer: string, context?: ClassifyContext): Promise<Classification & LlmCallMeta>;
  phraseClarification(q: QuestionPayload, request: FollowUpRequest): Promise<{ text: string } & LlmCallMeta>;
  summarize(input: { tables: unknown; comments: string[] }): Promise<{ text: string } & LlmCallMeta>;
  anonymizeComment(comment: string, language: Language): Promise<{ text: string } & LlmCallMeta>;
}

import { GeminiLlmProvider, type GeminiOptions } from './gemini';
import { MockLlmProvider } from './mock';
export { GeminiError, GeminiLlmProvider, type GeminiOptions } from './gemini';
export { MockLlmProvider, matchOptions, normalize } from './mock';
export { RecordingLlmProvider, type RecordedCall } from './recording';
export { defaultClarification, questionWithHint } from './clarification';
export { PROMPT_VERSION } from './prompts/m1-v2';

/** Parses and validates a raw model output; `null` if it does not match the schema. */
export function parseClassification(raw: unknown): Classification | null {
  const r = classificationSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const LLM_PROVIDERS = ['mock', 'gemini'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export interface LlmProviderOptions {
  gemini?: GeminiOptions;
}

/** Provider chosen by the `LLM_PROVIDER` env var (default `mock`). */
export function createLlmProvider(name: string = 'mock', options: LlmProviderOptions = {}): LlmProvider {
  if (name === 'mock') return new MockLlmProvider();
  if (name === 'gemini') {
    if (!options.gemini) throw new Error('Gemini options are required');
    return new GeminiLlmProvider(options.gemini);
  }
  throw new Error(`Unknown LLM provider: ${name}`);
}
