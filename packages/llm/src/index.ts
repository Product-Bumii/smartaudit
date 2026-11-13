/**
 * LLM provider interface (section 5.5). The AI is bounded: it only phrases questions, asks at most
 * one clarification and classifies answers. Order, conditions and calculations are deterministic code.
 *
 * Phase 1 only declares the contract. TODO(Fase 2): mock deterministic adapter, real adapter chosen by
 * env var (no retention/training, EU processing preferred) and versioned prompts in ./prompts.
 */
import { z } from 'zod';
import type { Language } from '@smartaudit/shared';

/** What the AI may see: question text, options and the participant answer. Never identifiers. */
export interface QuestionPayload {
  questionCode: string;
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
