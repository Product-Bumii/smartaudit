/**
 * Permission matrix (section 3.2, revised by decision 56). It answers "can this role do X at all".
 * Which organizations and campaigns a user reaches is decided by the assignment rules in `access.ts`.
 */
import type { Role } from './enums';

export const ACTIONS = [
  'organization.manage',
  'auditEntity.manage',
  'coordinator.manage',
  'auditor.manage',
  'assignment.coordinator',
  'assignment.auditor',
  'organization.viewAssigned',
  'config.manage',
  'settings.technical',
  'campaign.create',
  'campaign.edit',
  'campaign.view',
  'campaign.listAll',
  'campaign.suspend',
  'campaign.cancel',
  'sample.manage',
  'sample.view',
  'respondent.viewStatus',
  'progress.viewAggregate',
  'responses.viewIndividual',
  'responses.review',
  'report.manage',
] as const;
export type Action = (typeof ACTIONS)[number];

const SUPER: readonly Action[] = [
  'organization.manage',
  'auditEntity.manage',
  'coordinator.manage',
  'auditor.manage',
  'assignment.coordinator',
  'assignment.auditor',
  'config.manage',
  'campaign.view',
  'campaign.listAll',
  'campaign.suspend',
  'campaign.cancel',
  'respondent.viewStatus',
  'progress.viewAggregate',
  'responses.viewIndividual',
  'responses.review',
  'report.manage',
];

/** What an auditor does on the campaigns of the organizations assigned to them. */
const AUDIT_WORK: readonly Action[] = [
  'organization.viewAssigned',
  'campaign.create',
  'campaign.edit',
  'campaign.view',
  'campaign.suspend',
  'campaign.cancel',
  'sample.manage',
  'sample.view',
  'respondent.viewStatus',
  'progress.viewAggregate',
  'responses.viewIndividual',
  'responses.review',
  'report.manage',
];

const MATRIX: Record<Role, readonly Action[]> = {
  SUPERADMIN_BUMII: [...SUPER, 'settings.technical'],
  SUPERADMIN_FUNDACION: SUPER,
  // A coordinator may assign themselves as auditor of an organization they coordinate; the audit
  // actions then apply only to those campaigns (campaignAccess = 'manage').
  COORDINATOR: ['auditor.manage', 'assignment.auditor', ...AUDIT_WORK],
  AUDITOR: AUDIT_WORK,
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}
