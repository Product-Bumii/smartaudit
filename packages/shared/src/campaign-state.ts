/**
 * Campaign state machine (section 5.1). Every transition is validated here.
 */
import type { CampaignStatus } from './enums';

/** States from which a campaign can be suspended or cancelled. */
export const SUSPENDABLE_STATUSES: readonly CampaignStatus[] = [
  'borrador',
  'muestra_cargada',
  'envios_activos',
  'en_curso',
];

const FLOW: Record<CampaignStatus, readonly CampaignStatus[]> = {
  borrador: ['muestra_cargada'],
  muestra_cargada: ['envios_activos'],
  envios_activos: ['en_curso'],
  en_curso: ['finalizada'],
  finalizada: ['informe_generado'],
  informe_generado: [],
  suspendida: [],
  cancelada: [],
};

/**
 * Allowed target states from `from`. A suspended campaign may only resume to the state it was
 * suspended from (`previousStatus`) or be cancelled.
 */
export function allowedTransitions(from: CampaignStatus, previousStatus?: CampaignStatus | null): CampaignStatus[] {
  if (from === 'suspendida') {
    return previousStatus && SUSPENDABLE_STATUSES.includes(previousStatus)
      ? [previousStatus, 'cancelada']
      : ['cancelada'];
  }
  const extra: CampaignStatus[] = SUSPENDABLE_STATUSES.includes(from) ? ['suspendida', 'cancelada'] : [];
  return [...FLOW[from], ...extra];
}

export function canTransition(
  from: CampaignStatus,
  to: CampaignStatus,
  previousStatus?: CampaignStatus | null,
): boolean {
  return allowedTransitions(from, previousStatus).includes(to);
}

/** Campaign configuration (and the frozen questionnaire/table snapshot) can change only before launch. */
export function isCampaignEditable(status: CampaignStatus): boolean {
  return status === 'borrador' || status === 'muestra_cargada';
}

export type SampleMode = 'replace' | 'append';

/** Sample can be replaced before launch and only appended to while the campaign is running. */
export function allowedSampleModes(status: CampaignStatus): SampleMode[] {
  if (isCampaignEditable(status)) return ['replace'];
  if (status === 'envios_activos' || status === 'en_curso') return ['append'];
  return [];
}
