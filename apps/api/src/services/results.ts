/**
 * Results, review queue and individual answers of an M1 audit (cambios 4 · bloques 1 y 2).
 * - Calculations are the deterministic `computeResults` of packages/shared, over COMPLETED interviews.
 * - Individual answers are linked to demographics only: no email, no file row, no dates, not in the order of
 *   the interviews. Open answers (P10, P14, P15) are only shown apart, without demographics (decision 96).
 * - Every access to individual data and every review decision is recorded in `auditLogs` by the routes.
 */
import { createHash } from 'node:crypto';
import {
  computeResults,
  effectiveAnswer,
  needsReview,
  smallGroups,
  type ActivationContext,
  type AnswerReviewInput,
  type CampaignResultsDto,
  type CommentsDto,
  type Demographics,
  type Question,
  type ResponseRow,
  type ResponsesDto,
  type ResultAnswer,
  type ResultInterview,
  type ReviewItemDto,
  type ReviewDecision,
  type ReviewListDto,
} from '@smartaudit/shared';
import { Interview, Respondent, type CampaignDoc } from '../models';

const questionsOf = (c: CampaignDoc) => (c.questionnaireSnapshot?.questions ?? []) as Question[];
const activationOf = (c: CampaignDoc): ActivationContext['campaign'] => ({
  auditType: c.m1Config!.auditType as ActivationContext['campaign']['auditType'],
  excellence: c.m1Config!.excellence,
  wellbeing: c.m1Config!.wellbeing ?? false,
  norm: c.m1Config!.norm,
});
const optionsOf = (q: Question) => q.options.map((o) => ({ code: o.code, label: o.label }));

interface StoredAnswer extends ResultAnswer {
  originalText?: string | null;
  confidence?: number | null;
  supportingQuote?: string | null;
  followUpReason?: string | null;
  clarificationsUsed?: number;
  review?: { decision?: ReviewDecision | null; optionCodes?: string[]; note?: string | null; reviewedAt?: Date | null } | null;
}
interface StoredInterview {
  _id: unknown;
  respondentId: unknown;
  language: string;
  messages: { role: 'assistant' | 'participant'; kind: string; text: string; questionCode?: string | null }[];
  answers: StoredAnswer[];
}

/** Stable order that is not the order of the interviews (nor of the sample file). */
const shuffleKey = (campaignId: string, value: string) => createHash('sha256').update(`${campaignId}:${value}`).digest('hex');

async function completedInterviews(c: CampaignDoc) {
  const interviews = (await Interview.find({ campaignId: c._id, state: 'completed' }).lean()) as unknown as StoredInterview[];
  const respondents = await Respondent.find({ _id: { $in: interviews.map((i) => i.respondentId) } }, { demographics: 1 }).lean();
  const demographics = new Map(respondents.map((r) => [String(r._id), r.demographics]));
  return interviews
    .filter((i) => demographics.has(String(i.respondentId)))
    .map((i) => ({ interview: i, demographics: demographics.get(String(i.respondentId))! }));
}

export async function campaignResults(c: CampaignDoc): Promise<CampaignResultsDto> {
  const questions = questionsOf(c);
  const data = await completedInterviews(c);
  const input: ResultInterview[] = data.map(({ interview, demographics }) => ({
    demographics: { sex: demographics.sex as ResultInterview['demographics']['sex'], ageBand: demographics.ageBand as ResultInterview['demographics']['ageBand'] },
    answers: interview.answers,
  }));
  const results = computeResults(questions, activationOf(c), input);
  const byCode = new Map(questions.map((q) => [q.code, q]));
  return {
    ...results,
    questionnaireVersion: (c.questionnaireSnapshot?.version as number | undefined) ?? null,
    questions: results.questions.map((r) => {
      const q = byCode.get(r.code)!;
      return { ...r, text: q.text, options: r.options.map((o) => ({ ...o, label: q.options.find((x) => x.code === o.code)!.label })) };
    }),
  };
}

// ---------- Review queue

export async function reviewQueue(c: CampaignDoc, state: 'pending' | 'reviewed' | 'all'): Promise<ReviewListDto> {
  const byCode = new Map(questionsOf(c).map((q) => [q.code, q]));
  const data = await completedInterviews(c);
  const items: ReviewItemDto[] = [];
  let pending = 0;
  let reviewed = 0;
  for (const { interview } of data) {
    for (const a of interview.answers) {
      const q = byCode.get(a.questionCode);
      if (!q || a.status !== 'pending_review') continue;
      const isPending = needsReview(a);
      if (isPending) pending++;
      else reviewed++;
      if ((state === 'pending' && !isPending) || (state === 'reviewed' && isPending)) continue;
      items.push({
        interviewId: String(interview._id),
        questionCode: q.code,
        questionText: q.text,
        questionType: q.type,
        options: optionsOf(q),
        language: interview.language as ReviewItemDto['language'],
        status: a.status,
        aiCodes: [...a.optionCodes],
        confidence: a.confidence ?? null,
        supportingQuote: a.supportingQuote ?? null,
        originalText: a.originalText ?? null,
        followUpReason: a.followUpReason ?? null,
        clarificationsUsed: a.clarificationsUsed ?? 0,
        thread: interview.messages.filter((m) => m.questionCode === q.code && m.text).map((m) => ({ role: m.role, text: m.text })),
        review:
          a.review && !isPending
            ? { decision: effectiveAnswer(a).kind as 'codes' | 'abstention' | 'no_valid_answer', optionCodes: [...(a.review.optionCodes ?? [])], note: a.review.note ?? null, reviewedAt: new Date(a.review.reviewedAt ?? 0).toISOString() }
            : null,
      });
    }
  }
  const order = new Map([...byCode.keys()].map((code, i) => [code, byCode.get(code)!.order ?? i]));
  items.sort((x, y) => order.get(x.questionCode)! - order.get(y.questionCode)! || shuffleKey(String(c._id), x.interviewId).localeCompare(shuffleKey(String(c._id), y.interviewId)));
  return { items, counts: { pending, reviewed } };
}

export type ReviewOutcome = 'ok' | 'NOT_FOUND' | 'NOT_REVIEWABLE';

/** Records the auditor's decision. Only answers sent to review (pending or already decided) can be reviewed. */
export async function reviewAnswer(c: CampaignDoc, interviewId: string, questionCode: string, input: AnswerReviewInput, by: string, now: Date): Promise<ReviewOutcome> {
  const interview = await Interview.findOne({ _id: interviewId, campaignId: c._id, state: 'completed' });
  if (!interview) return 'NOT_FOUND';
  const answer = (interview.answers as unknown as StoredAnswer[]).find((a) => a.questionCode === questionCode);
  if (!answer) return 'NOT_FOUND';
  if (answer.status !== 'pending_review') return 'NOT_REVIEWABLE';
  const idx = (interview.answers as unknown as StoredAnswer[]).indexOf(answer);
  interview.set(`answers.${idx}.review`, {
    decision: input.decision,
    optionCodes: input.decision === 'codes' ? [...new Set(input.optionCodes)] : [],
    note: input.note || null,
    reviewedBy: by,
    reviewedAt: now,
  });
  await interview.save();
  return 'ok';
}

// ---------- Individual answers and open comments

/** Demographic columns shown with the individual answers (never identifiers). */
const DIMENSIONS = ['sex', 'ageBand', 'workCenter', 'jobType', 'seniorityBand', 'area', 'shifts', 'telework', 'dependents', 'rlpt'] as const;

export async function individualResponses(c: CampaignDoc): Promise<ResponsesDto> {
  const closed = questionsOf(c)
    .filter((q) => q.type !== 'free_text')
    .sort((a, b) => a.order - b.order);
  const data = await completedInterviews(c);
  const rows: (ResponseRow & { key: string })[] = data.map(({ interview, demographics }) => {
    const d = demographics as Record<string, string | boolean | null | undefined>;
    const answers: ResponseRow['answers'] = {};
    for (const a of interview.answers) {
      if (!closed.some((q) => q.code === a.questionCode)) continue;
      const e = effectiveAnswer(a);
      if (e.kind === 'open') continue;
      answers[a.questionCode] = { kind: e.kind, codes: e.kind === 'codes' ? e.codes : [], reviewed: 'reviewed' in e ? e.reviewed : e.kind === 'no_valid_answer' };
    }
    return {
      key: shuffleKey(String(c._id), String(interview._id)),
      demographics: Object.fromEntries(DIMENSIONS.map((k) => [k, d[k] ?? null])),
      answers,
    };
  });
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return {
    questions: closed.map((q) => ({ code: q.code, text: q.text, options: optionsOf(q) })),
    rows: rows.map(({ key: _key, ...r }) => r),
    // Re-identification risk: groups of fewer than 3 people among the interviews shown (section 5.6).
    smallGroups: smallGroups(data.map(({ demographics }) => demographics as unknown as Demographics)),
  };
}

export async function openComments(c: CampaignDoc): Promise<CommentsDto> {
  const open = questionsOf(c)
    .filter((q) => q.type === 'free_text')
    .sort((a, b) => a.order - b.order);
  const data = await completedInterviews(c);
  return {
    questions: open.map((q) => {
      const comments = data
        .flatMap(({ interview }) => interview.answers.filter((a) => a.questionCode === q.code && a.status === 'classified'))
        .map((a) => (a.freeText ?? '').trim())
        .filter(Boolean);
      return { code: q.code, text: q.text, comments: comments.sort((x, y) => shuffleKey(String(c._id), x).localeCompare(shuffleKey(String(c._id), y))) };
    }),
  };
}
