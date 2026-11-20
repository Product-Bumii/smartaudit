/**
 * Public participant area (no account, section 5.4):
 * - `/i/<token>`: personal invitation link (people with email).
 * - `/c/<slug>` + 8-character code (people without email), with temporary lockout after failed attempts.
 * Both open a participant session (httpOnly cookie scoped to `/api/participant`) that only identifies the
 * respondent record. The interview chat then starts after the notice and the language choice, and resumes
 * where it was left with the same link or code.
 *
 * Never returns or logs personal data, codes or identifiers.
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import {
  accessCodeInputSchema,
  campaignSlugSchema,
  interviewAnswerSchema,
  interviewStartSchema,
  invitationTokenSchema,
  isWellFormedAccessCode,
  normalizeAccessCode,
  participantAvailability,
  type CampaignStatus,
  type InterviewState,
  type Language,
  type ParticipantSessionDto,
  type RespondentStatus,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { sha256 } from '../lib/crypto';
import { conflict, notFound, unauthorized, unprocessable } from '../lib/errors';
import { Campaign, Interview, ParticipantContact, Respondent, type CampaignDoc } from '../models';
import { answerInterview, findInterview, resumeInterview, startInterview } from '../services/interview';

const ACCESS_WINDOW_MS = 15 * 60_000;
const PARTICIPANT_COOKIE = 'sa_participant';
const SESSION_MS = 12 * 3600_000;

interface ParticipantClaims {
  purpose: 'participant';
  rid: string;
  cid: string;
}

export function participantRouter(ctx: AppContext): Router {
  const r = Router();

  /** Temporary lockout: only FAILED attempts count, per IP. */
  const accessLimiter = rateLimit({
    windowMs: ACCESS_WINDOW_MS,
    limit: ctx.rateLimits.accessCodePerIp,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'TOO_MANY_ATTEMPTS' } },
  });
  const chatLimiter = rateLimit({
    windowMs: ACCESS_WINDOW_MS,
    limit: ctx.rateLimits.chatPerIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'RATE_LIMITED' } },
  });

  const setSession = (res: Response, rid: string, cid: string) => {
    const token = jwt.sign({ purpose: 'participant', rid, cid } satisfies ParticipantClaims, ctx.config.jwtSecret, { expiresIn: SESSION_MS / 1000 });
    res.cookie(PARTICIPANT_COOKIE, token, {
      httpOnly: true,
      secure: ctx.config.cookieSecure,
      sameSite: 'lax',
      path: '/api/participant',
      maxAge: SESSION_MS,
    });
  };

  /** Respondent and campaign of the participant session; the link/code must still be valid. */
  const fromSession = async (req: Request) => {
    const raw = req.cookies?.[PARTICIPANT_COOKIE];
    if (!raw) throw unauthorized('NO_PARTICIPANT_SESSION');
    let claims: ParticipantClaims;
    try {
      claims = jwt.verify(raw, ctx.config.jwtSecret) as ParticipantClaims;
    } catch {
      throw unauthorized('NO_PARTICIPANT_SESSION');
    }
    if (claims.purpose !== 'participant') throw unauthorized('NO_PARTICIPANT_SESSION');
    const [contact, campaign, respondent] = await Promise.all([
      ParticipantContact.findOne({ respondentId: claims.rid, revokedAt: null }, { _id: 1 }).lean(),
      Campaign.findById(claims.cid).lean<CampaignDoc>(),
      Respondent.findById(claims.rid, { status: 1 }).lean(),
    ]);
    if (!contact || !campaign || !respondent) throw unauthorized('NO_PARTICIPANT_SESSION');
    return { campaign, respondentId: claims.rid, respondentStatus: respondent.status as RespondentStatus };
  };

  const availabilityOf = (campaign: CampaignDoc, respondentStatus: RespondentStatus) =>
    participantAvailability({
      campaignStatus: campaign.status as CampaignStatus,
      respondentStatus,
      opensAt: campaign.window?.opensAt ?? null,
      closesAt: campaign.window?.closesAt ?? null,
      now: ctx.now(),
    });

  const sessionDto = async (campaign: CampaignDoc, respondentId: string, respondentStatus: RespondentStatus): Promise<ParticipantSessionDto> => {
    const interview = await Interview.findOne({ respondentId }, { state: 1, language: 1 }).lean();
    return {
      availability: availabilityOf(campaign, respondentStatus),
      offeredLanguages: (campaign.offeredLanguages ?? ['es']) as Language[],
      window: campaign.window?.opensAt
        ? { opensAt: new Date(campaign.window.opensAt).toISOString(), closesAt: new Date(campaign.window.closesAt!).toISOString(), timeZone: campaign.window.timeZone as string }
        : null,
      interview: interview ? { state: interview.state as InterviewState, language: interview.language as Language } : null,
    };
  };

  const findCampaign = async (slugParam: unknown) => {
    const slug = campaignSlugSchema.safeParse(slugParam);
    if (!slug.success) throw notFound('CAMPAIGN_NOT_FOUND');
    const campaign = await Campaign.findOne({ slug: slug.data }).lean<CampaignDoc>();
    if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND');
    return campaign;
  };

  /** Minimal public info for the landing (no organization data). */
  r.get('/c/:slug', async (req, res) => {
    const campaign = await findCampaign(req.params.slug);
    res.json({ offeredLanguages: campaign.offeredLanguages ?? ['es'] });
  });

  r.post('/c/:slug/access', accessLimiter, async (req, res) => {
    const campaign = await findCampaign(req.params.slug);
    const code = normalizeAccessCode(accessCodeInputSchema.parse(req.body).code);
    if (!isWellFormedAccessCode(code)) throw unauthorized('INVALID_ACCESS_CODE');
    const contact = await ParticipantContact.findOne(
      { campaignId: campaign._id, accessCodeHash: sha256(code), revokedAt: null },
      { respondentId: 1 },
    ).lean();
    if (!contact) throw unauthorized('INVALID_ACCESS_CODE');
    const respondent = await Respondent.findById(contact.respondentId, { status: 1 }).lean();
    if (!respondent) throw unauthorized('INVALID_ACCESS_CODE');
    setSession(res, String(contact.respondentId), String(campaign._id));
    res.json(await sessionDto(campaign, String(contact.respondentId), respondent.status as RespondentStatus));
  });

  /** Personal invitation link (people with email). */
  r.post('/i/:token', accessLimiter, async (req, res) => {
    const token = invitationTokenSchema.safeParse(req.params.token);
    if (!token.success) throw unauthorized('INVALID_INVITATION');
    const contact = await ParticipantContact.findOne({ invitationTokenHash: sha256(token.data), revokedAt: null }, { respondentId: 1, campaignId: 1 }).lean();
    if (!contact) throw unauthorized('INVALID_INVITATION');
    const [campaign, respondent] = await Promise.all([Campaign.findById(contact.campaignId).lean<CampaignDoc>(), Respondent.findById(contact.respondentId, { status: 1 }).lean()]);
    if (!campaign || !respondent) throw unauthorized('INVALID_INVITATION');
    setSession(res, String(contact.respondentId), String(campaign._id));
    res.json(await sessionDto(campaign, String(contact.respondentId), respondent.status as RespondentStatus));
  });

  r.get('/session', chatLimiter, async (req, res) => {
    const s = await fromSession(req);
    res.json(await sessionDto(s.campaign, s.respondentId, s.respondentStatus));
  });

  /** After the notice and the language choice. Resumes if already started. */
  r.post('/interview/start', chatLimiter, async (req, res) => {
    const s = await fromSession(req);
    const { language } = interviewStartSchema.parse(req.body);
    const existing = await findInterview(s.respondentId);
    if (existing) {
      res.json(await resumeInterview(ctx, existing, s.campaign));
      return;
    }
    if (availabilityOf(s.campaign, s.respondentStatus) !== 'open') throw conflict('INTERVIEW_NOT_AVAILABLE');
    if (!(s.campaign.offeredLanguages ?? ['es']).includes(language)) throw unprocessable('LANGUAGE_NOT_OFFERED');
    res.json(await startInterview(ctx, s.campaign, s.respondentId, language));
  });

  /** Resume: same link or code, same pending question (nothing repeated or lost). */
  r.get('/interview', chatLimiter, async (req, res) => {
    const s = await fromSession(req);
    const interview = await findInterview(s.respondentId);
    if (!interview) throw notFound('INTERVIEW_NOT_STARTED');
    res.json(await resumeInterview(ctx, interview, s.campaign));
  });

  r.post('/interview/answer', chatLimiter, async (req, res) => {
    const s = await fromSession(req);
    const input = interviewAnswerSchema.parse(req.body);
    const interview = await findInterview(s.respondentId);
    if (!interview) throw notFound('INTERVIEW_NOT_STARTED');
    if (availabilityOf(s.campaign, s.respondentStatus) !== 'open') throw conflict('INTERVIEW_NOT_AVAILABLE');
    res.json(await answerInterview(ctx, interview, s.campaign, input));
  });

  return r;
}
