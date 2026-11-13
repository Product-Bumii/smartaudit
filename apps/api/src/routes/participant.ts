/**
 * Public participant access (no account). Phase 1 scope (requested): landing `/c/<slug>` asks for the
 * 8-character code of people without email and tells them whether the interview can start.
 * TODO(Fase 2): participant session, notice acceptance, language choice persisted and the interview chat;
 * invitation links `/i/<token>` for people with email.
 *
 * Never returns or logs personal data, codes or identifiers.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  accessCodeInputSchema,
  campaignSlugSchema,
  isWellFormedAccessCode,
  normalizeAccessCode,
  participantAvailability,
  type CampaignStatus,
  type RespondentStatus,
} from '@smartaudit/shared';
import type { AppContext } from '../context';
import { sha256 } from '../lib/crypto';
import { notFound, unauthorized } from '../lib/errors';
import { Campaign, ParticipantContact, Respondent } from '../models';

const ACCESS_WINDOW_MS = 15 * 60_000;

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

  const findCampaign = async (slugParam: unknown) => {
    const slug = campaignSlugSchema.safeParse(slugParam);
    if (!slug.success) throw notFound('CAMPAIGN_NOT_FOUND');
    const campaign = await Campaign.findOne({ slug: slug.data }).lean();
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

    const availability = participantAvailability({
      campaignStatus: campaign.status as CampaignStatus,
      respondentStatus: respondent.status as RespondentStatus,
      opensAt: campaign.window?.opensAt ?? null,
      closesAt: campaign.window?.closesAt ?? null,
      now: ctx.now(),
    });
    res.json({
      availability,
      offeredLanguages: campaign.offeredLanguages ?? ['es'],
      window: campaign.window?.opensAt
        ? { opensAt: campaign.window.opensAt, closesAt: campaign.window.closesAt, timeZone: campaign.window.timeZone }
        : null,
    });
  });

  return r;
}
