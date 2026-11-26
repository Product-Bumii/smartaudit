/**
 * Google Gemini adapter (REST `generateContent`, no SDK). Decided by the user on 20/11/2026 (decision 83).
 * - Only the payload built by the service is sent: question text, options and the (already redacted) answer.
 * - The participant's text goes in a delimited DATA block (prompts in ./prompts); classification uses a JSON
 *   response schema, and the service still validates it with Zod (one retry, then human review).
 * - temperature 0, bounded output and a timeout. Errors never include the API key or the prompt.
 */
import type { Language } from '@smartaudit/shared';
import type { Classification, ClassifyContext, ConversationTurn, FollowUpRequest, LlmCallMeta, LlmProvider, QuestionPayload } from './index';
import { questionWithHint } from './clarification';
import { CLASSIFY_ANSWER, FOLLOW_UP, FOLLOW_UP_TASKS, PHRASE_QUESTION, PROMPT_VERSION } from './prompts/m1-v2';

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

/** The conversation about the current question, one line per message. */
const threadText = (thread: readonly ConversationTurn[]) =>
  thread.map((t) => `${t.role === 'assistant' ? 'INTERVIEWER' : 'PARTICIPANT'}: ${t.text.replace(/\s+/g, ' ')}`).join('\n') || '(none)';
const labelsOf = (q: QuestionPayload, codes: readonly string[] = []) => codes.map((c) => q.options.find((o) => o.code === c)?.label ?? c);

/** JSON schema of the classification (Gemini `responseSchema`, OpenAPI subset). */
const CLASSIFICATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    optionCodes: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER' },
    status: { type: 'STRING', enum: ['classified', 'ambiguous', 'abstained', 'off_topic', 'question'] },
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
            // Gemini 2.5 «thinks» by default and those tokens count against maxOutputTokens, which truncated the
            // JSON. Phrasing and classifying need no reasoning: off for Flash models (Pro cannot disable it).
            ...(/pro/i.test(this.options.model) ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
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
    const text = await this.generate(fill(PHRASE_QUESTION, { language: LANGUAGE_NAMES[q.language], question: q.text }), { maxOutputTokens: 1024 });
    return { text, ...this.meta };
  }

  async classifyAnswer(q: QuestionPayload, answer: string, context?: ClassifyContext): Promise<Classification & LlmCallMeta> {
    const prompt = fill(CLASSIFY_ANSWER, {
      question: q.text,
      type: q.type === 'multi' ? 'multiple choice (one or more codes)' : 'single choice (exactly one code)',
      options: q.options.map((o) => `${o.code}: ${o.label}`).join('; '),
      proposed: (context?.proposedCodes ?? []).join(', ') || '(none)',
      thread: threadText(context?.thread ?? []),
      answer,
    });
    const raw = await this.generate(prompt, { json: true, maxOutputTokens: 1024 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GeminiError('Gemini returned invalid JSON');
    }
    // Gemini sometimes returns one object per part of the message (e.g. an answer plus a question): the answer wins.
    if (Array.isArray(parsed)) {
      const items = parsed as Partial<Classification>[];
      parsed = items.find((x) => x?.status === 'classified') ?? items.find((x) => x?.status !== 'off_topic') ?? items[0];
    }
    // Validated with Zod by the caller (parseClassification); an invalid shape counts as a failed attempt.
    return { ...(parsed as Classification), ...this.meta };
  }

  async phraseClarification(q: QuestionPayload, request: FollowUpRequest) {
    const proposed = labelsOf(q, request.proposedCodes).join(' / ');
    const prompt = fill(FOLLOW_UP, {
      language: LANGUAGE_NAMES[q.language],
      task: fill(FOLLOW_UP_TASKS[request.reason], { proposed }),
      question: q.text,
      options: q.options.map((o) => o.label).join('; '),
      hint: questionWithHint(q).slice(q.text.length).trim() || '(none)',
      explanation: q.explanation?.trim() || q.help?.trim() || '(none)',
      thread: threadText(request.thread),
      answer: request.answer,
    });
    const text = await this.generate(prompt, { maxOutputTokens: 1024 });
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
