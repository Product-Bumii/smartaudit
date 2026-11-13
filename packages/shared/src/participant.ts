/**
 * Participant access (section 5.4): whether a person with a valid link/code can start the interview.
 * Deterministic; the API and the landing only display the result.
 */
import type { CampaignStatus, RespondentStatus } from './enums';

export type ParticipantAvailability =
  /** Window not open yet, or the campaign has not been launched. */
  | 'not_open_yet'
  /** The interview can be started or resumed. */
  | 'open'
  /** Window closed or campaign finished. */
  | 'closed'
  /** This person already completed the interview (the link/code cannot start it again). */
  | 'completed'
  /** Campaign suspended or cancelled. */
  | 'unavailable';

const LAUNCHED: readonly CampaignStatus[] = ['envios_activos', 'en_curso'];

export function participantAvailability(input: {
  campaignStatus: CampaignStatus;
  respondentStatus: RespondentStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  now: Date;
}): ParticipantAvailability {
  const { campaignStatus, respondentStatus, opensAt, closesAt, now } = input;
  if (respondentStatus === 'completed') return 'completed';
  if (campaignStatus === 'suspendida' || campaignStatus === 'cancelada') return 'unavailable';
  if (campaignStatus === 'finalizada' || campaignStatus === 'informe_generado') return 'closed';
  if (closesAt && now.getTime() > closesAt.getTime()) return 'closed';
  if (!LAUNCHED.includes(campaignStatus) || !opensAt || now.getTime() < opensAt.getTime()) return 'not_open_yet';
  return 'open';
}
