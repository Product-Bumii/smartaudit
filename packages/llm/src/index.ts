/**
 * LLM provider interface (section 5.5). The AI is bounded: it only phrases questions, asks at most
 * one clarification and classifies answers. Order, conditions and calculations are deterministic code.
 *
 * Adapters: `mock` (deterministic, development and tests). The real adapter is chosen with the
 * `LLM_PROVIDER` env var once the provider is decided (CLAUDE.md §8, pending decision 1).
 * Prompts are versioned in ./prompts.
 */
import { z } from 'zod';
import type { Language, QuestionType } from '@smartaudit/shared';

/** What the AI may see: question text, options and the participant answer. Never identifiers. */
export interface QuestionPayload {
  questionCode: string;
  type: QuestionType;
  text: string;
  help?: string | null;
  options: { code: string; label: string }[];
  language: Language;
}

export const classificationSchema = z.object({
  optionCodes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  status: z.enum(['classified', 'ambiguous', 'abstained', 'off_topic']),
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
  classifyAnswer(q: QuestionPayload, answer: string): Promise<Classification & LlmCallMeta>;
  phraseClarification(q: QuestionPayload, answer: string): Promise<{ text: string } & LlmCallMeta>;
  summarize(input: { tables: unknown; comments: string[] }): Promise<{ text: string } & LlmCallMeta>;
  anonymizeComment(comment: string, language: Language): Promise<{ text: string } & LlmCallMeta>;
}

import { MockLlmProvider } from './mock';
export { MockLlmProvider, matchOptions, normalize } from './mock';
export { RecordingLlmProvider, type RecordedCall } from './recording';
export { defaultClarification } from './clarification';
export { PROMPT_VERSION } from './prompts/m1-v1';

/** Parses and validates a raw model output; `null` if it does not match the schema. */
export function parseClassification(raw: unknown): Classification | null {
  const r = classificationSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export const LLM_PROVIDERS = ['mock'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

/**
 * Provider chosen by the `LLM_PROVIDER` env var (default `mock`).
 * TODO(Fase 2): real adapter once the provider is decided (no retention or training, EU processing).
 */
export function createLlmProvider(name: string = 'mock'): LlmProvider {
  if (name === 'mock') return new MockLlmProvider();
  throw new Error(`Unknown LLM provider: ${name}`);
}
