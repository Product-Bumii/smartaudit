/**
 * Wraps a provider and records every payload sent to it. Used by the tests that inspect the calls
 * (section 6, Fase 2: «ningún identificador enviado al proveedor de IA»).
 */
import type { Language } from '@smartaudit/shared';
import type { LlmProvider, QuestionPayload } from './index';

export interface RecordedCall {
  method: 'phraseQuestion' | 'classifyAnswer' | 'phraseClarification' | 'summarize' | 'anonymizeComment';
  payload: unknown;
}

export class RecordingLlmProvider implements LlmProvider {
  readonly calls: RecordedCall[] = [];
  constructor(private readonly inner: LlmProvider) {}

  get name() {
    return this.inner.name;
  }

  phraseQuestion(q: QuestionPayload) {
    this.calls.push({ method: 'phraseQuestion', payload: q });
    return this.inner.phraseQuestion(q);
  }
  classifyAnswer(q: QuestionPayload, answer: string) {
    this.calls.push({ method: 'classifyAnswer', payload: { q, answer } });
    return this.inner.classifyAnswer(q, answer);
  }
  phraseClarification(q: QuestionPayload, answer: string) {
    this.calls.push({ method: 'phraseClarification', payload: { q, answer } });
    return this.inner.phraseClarification(q, answer);
  }
  summarize(input: { tables: unknown; comments: string[] }) {
    this.calls.push({ method: 'summarize', payload: input });
    return this.inner.summarize(input);
  }
  anonymizeComment(comment: string, language: Language) {
    this.calls.push({ method: 'anonymizeComment', payload: { comment, language } });
    return this.inner.anonymizeComment(comment, language);
  }

  /** Everything sent, as one string (for identifier checks). */
  sentText(): string {
    return JSON.stringify(this.calls.map((c) => c.payload));
  }
}
