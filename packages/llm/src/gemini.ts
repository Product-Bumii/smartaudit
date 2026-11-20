/**
 * Google Gemini adapter (REST `generateContent`, no SDK). Decided by the user on 20/11/2026 (decision 83).
 * - Only the payload built by the service is sent: question text, options and the (already redacted) answer.
 * - The participant's text goes in a delimited DATA block (prompts in ./prompts); classification uses a JSON
 *   response schema, and the service still validates it with Zod (one retry, then human review).
 * - temperature 0, bounded output and a timeout. Errors never include the API key or the prompt.
 */
import type { Language } from '@smartaudit/shared';
import type { Classification, LlmCallMeta, LlmProvider, QuestionPayload } from './index';
import { CLASSIFY_ANSWER, CLARIFICATION, PHRASE_QUESTION, PROMPT_VERSION } from './prompts/m1-v1';

export interface GeminiOptions {
  apiKey: string;
  /** e.g. `gemini-2.5-flash` (env `GEMINI_MODEL`). */
  model: string;
  /** Default: the public Gemini API. A Vertex AI / regional endpoint can be configured instead. */
  baseUrl?: string;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

const LANGUAGE_NAMES: Record<Language, string> = { es: 'Spanish (Spain)', en: 'English', ca: 'Catalan', pt: 'European Portuguese (pt-PT)', fr: 'French' };

const fill = (template: string, vars: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');

/** JSON schema of the classification (Gemini `responseSchema`, OpenAPI subset). */
const CLASSIFICATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    optionCodes: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER' },
    status: { type: 'STRING', enum: ['classified', 'ambiguous', 'abstained', 'off_topic'] },
    supportingQuote: { type: 'STRING' },
  },
  required: ['optionCodes', 'confidence', 'status', 'supportingQuote'],
};

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly meta: LlmCallMeta;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiOptions) {
    if (!options.apiKey) throw new GeminiError('GEMINI_API_KEY is missing');
    this.meta = { model: options.model, promptVersion: PROMPT_VERSION };
    this.baseUrl = (options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** One `generateContent` call; returns the text of the first candidate. */
  private async generate(prompt: string, opts: { json?: boolean; maxOutputTokens: number }): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/models/${encodeURIComponent(this.options.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.options.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            candidateCount: 1,
            maxOutputTokens: opts.maxOutputTokens,
            ...(opts.json ? { responseMimeType: 'application/json', responseSchema: CLASSIFICATION_SCHEMA } : {}),
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new GeminiError(`Gemini request failed: ${(err as Error).name}`);
    }
    if (!res.ok) throw new GeminiError(`Gemini HTTP ${res.status}`, res.status);
    const body = (await res.json()) as GenerateResponse;
    if (body.promptFeedback?.blockReason) throw new GeminiError(`Gemini blocked the prompt: ${body.promptFeedback.blockReason}`);
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
    if (!text) throw new GeminiError(`Gemini returned no text (${body.candidates?.[0]?.finishReason ?? 'no candidate'})`);
    return text;
  }

  async phraseQuestion(q: QuestionPayload) {
    const text = await this.generate(fill(PHRASE_QUESTION, { language: LANGUAGE_NAMES[q.language], question: q.text }), { maxOutputTokens: 300 });
    return { text, ...this.meta };
  }

  async classifyAnswer(q: QuestionPayload, answer: string): Promise<Classification & LlmCallMeta> {
    const prompt = fill(CLASSIFY_ANSWER, {
      question: q.text,
      type: q.type === 'multi' ? 'multiple choice (one or more codes)' : 'single choice (exactly one code)',
      options: q.options.map((o) => `${o.code}: ${o.label}`).join('; '),
      answer,
    });
    const raw = await this.generate(prompt, { json: true, maxOutputTokens: 400 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GeminiError('Gemini returned invalid JSON');
    }
    // Validated with Zod by the caller (parseClassification); an invalid shape counts as a failed attempt.
    return { ...(parsed as Classification), ...this.meta };
  }

  async phraseClarification(q: QuestionPayload, answer: string) {
    const text = await this.generate(fill(CLARIFICATION, { language: LANGUAGE_NAMES[q.language], question: q.text, answer }), { maxOutputTokens: 300 });
    return { text, ...this.meta };
  }

  // TODO(Fase 3): synthesis (7.3) from computed tables and anonymized comments.
  async summarize(_input: { tables: unknown; comments: string[] }): Promise<{ text: string } & LlmCallMeta> {
    throw new GeminiError('summarize is built in Phase 3');
  }

  // TODO(Fase 3): comment anonymization.
  async anonymizeComment(_comment: string, _language: Language): Promise<{ text: string } & LlmCallMeta> {
    throw new GeminiError('anonymizeComment is built in Phase 3');
  }
}
