/**
 * Derived values of an M1 campaign: minimum and maximum of completed interviews, window and activated questions.
 * Recomputed by the API whenever an editable campaign is saved, and shown as a preview while editing.
 */
import { computeCampaignWindow, campaignWindowWarnings, type CampaignWindow, type WindowWarning } from './business-days';
import type { AuditType } from './enums';
import { classifyQuestions, type Question, type QuestionActivationState } from './questionnaire';
import { resolveMaximum, resolveMinimum, type MaximumResolution, type MinimumResolution, type SamplingBracket } from './sampling';

export interface M1DerivationInput {
  scopeSize: number;
  auditorMinimum?: number | null;
  /** Maximum of completed interviews requested by the auditor (`null` = the minimum). */
  maxCompleted?: number | null;
  interviewStartDate: string;
  timeZone: string;
  brackets: readonly SamplingBracket[];
  questions: readonly Question[];
  auditType: AuditType;
  excellence: boolean;
  wellbeing?: boolean;
  norm: string;
  now: Date;
}

export interface M1Derivation {
  minimum: MinimumResolution;
  /** `null` while the minimum is unknown. */
  maximum: MaximumResolution | null;
  window: CampaignWindow | null;
  windowError: string | null;
  windowWarnings: WindowWarning[];
  questions: { code: string; order: number; mandatory: boolean; state: QuestionActivationState }[];
}

export function deriveM1Campaign(input: M1DerivationInput): M1Derivation {
  const minimum = resolveMinimum(input.brackets, input.scopeSize, input.auditorMinimum);
  let window: CampaignWindow | null = null;
  let windowError: string | null = null;
  try {
    window = computeCampaignWindow(input.interviewStartDate, input.timeZone);
  } catch (e) {
    windowError = (e as Error).message;
  }
  const questions = classifyQuestions(input.questions, {
    campaign: { auditType: input.auditType, excellence: input.excellence, wellbeing: input.wellbeing ?? false, norm: input.norm },
  });
  const maximum = resolveMaximum({
    minimum: minimum.ok ? minimum.minimum : null,
    requested: input.maxCompleted,
    scopeSize: input.scopeSize,
  });
  return {
    minimum,
    maximum,
    window,
    windowError,
    windowWarnings: window ? campaignWindowWarnings(window, input.now, input.interviewStartDate) : [],
    questions,
  };
}
