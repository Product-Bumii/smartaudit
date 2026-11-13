/**
 * M1 permission matrix (section 3.2). Organization isolation is enforced separately by the API
 * (every query is scoped by `organizationId`); this matrix answers "can this role do X at all".
 */
import type { Role } from './enums';

export const ACTIONS = [
  'organization.manage',
  'orgAdmin.manage',
  'auditor.manage',
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
  'orgAdmin.manage',
  'auditor.manage',
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

const MATRIX: Record<Role, readonly Action[]> = {
  SUPERADMIN_BUMII: [...SUPER, 'settings.technical'],
  SUPERADMIN_FUNDACION: SUPER,
  ORG_ADMIN: ['auditor.manage', 'progress.viewAggregate'],
  AUDITOR: [
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
  ],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}
