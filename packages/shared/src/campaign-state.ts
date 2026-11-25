/**
 * Campaign state machine (section 5.1). Every transition is validated here.
 *
 * Change group 3 (decision 88): there is no manual activation, suspension or cancellation. Once the sample is
 * loaded the audit is scheduled (`muestra_cargada`) and opens by itself on the interview start date
 * (`en_curso`), then closes at the end of the window or at the maximum (`finalizada`).
 * `envios_activos`, `suspendida` and `cancelada` are kept only for audits created before this change.
 */
import type { CampaignStatus } from './enums';

const FLOW: Record<CampaignStatus, readonly CampaignStatus[]> = {
  borrador: ['muestra_cargada'],
  muestra_cargada: ['en_curso'],
  envios_activos: ['en_curso'], // legacy: launched before change group 3
  en_curso: ['finalizada'],
  finalizada: ['informe_generado'],
  informe_generado: [],
  suspendida: [], // legacy
  cancelada: [], // legacy
};

export function allowedTransitions(from: CampaignStatus): CampaignStatus[] {
  return [...FLOW[from]];
}

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return FLOW[from].includes(to);
}

/** Configuration and sample can change until the window opens (`borrador`, `muestra_cargada`). */
export function isCampaignEditable(status: CampaignStatus): boolean {
  return status === 'borrador' || status === 'muestra_cargada';
}

/** States in which the window opens by itself when its time comes (scheduler). */
export const SCHEDULED_STATUSES: readonly CampaignStatus[] = ['muestra_cargada', 'envios_activos'];

export type SampleMode = 'replace' | 'append';

/** Sample can be replaced until the window opens and only appended to while the campaign is running. */
export function allowedSampleModes(status: CampaignStatus): SampleMode[] {
  if (isCampaignEditable(status)) return ['replace'];
  if (status === 'envios_activos' || status === 'en_curso') return ['append'];
  return [];
}
