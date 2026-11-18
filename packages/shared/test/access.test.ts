import { describe, expect, it } from 'vitest';
import {
  campaignAccess,
  canAssignAuditor,
  canCreateCampaignFor,
  coordinatesOrganization,
  isCampaignClosed,
  isEligibleAuditor,
  isEligibleCoordinator,
  planAssignmentChange,
  type AccessUser,
  type OrganizationAssignment,
} from '../src';

const E1 = 'entity1';
const E2 = 'entity2';
const superadmin: AccessUser = { id: 's', role: 'SUPERADMIN_FUNDACION', auditEntityId: null };
const coord: AccessUser = { id: 'c1', role: 'COORDINATOR', auditEntityId: E1 };
const coord2: AccessUser = { id: 'c2', role: 'COORDINATOR', auditEntityId: E1 };
const auditor: AccessUser = { id: 'a1', role: 'AUDITOR', auditEntityId: E1 };
const auditor2: AccessUser = { id: 'a2', role: 'AUDITOR', auditEntityId: E1 };
const foreignAuditor: AccessUser = { id: 'a1', role: 'AUDITOR', auditEntityId: E2 };
const org: OrganizationAssignment = { auditEntityId: E1, coordinatorId: 'c1', auditorId: 'a1' };

describe('campaignAccess', () => {
  const campaign = { auditEntityId: E1, leadAuditorId: 'a1' };
  it('superadmins supervise every campaign', () => {
    expect(campaignAccess(superadmin, campaign, org)).toBe('supervise');
  });
  it('the lead auditor manages; the coordinator sees aggregates; others nothing', () => {
    expect(campaignAccess(auditor, campaign, org)).toBe('manage');
    expect(campaignAccess(coord, campaign, org)).toBe('aggregate');
    expect(campaignAccess(coord2, campaign, org)).toBe('none');
    expect(campaignAccess(auditor2, campaign, org)).toBe('none');
  });
  it('a coordinator acting as auditor manages the campaign', () => {
    expect(campaignAccess(coord, { auditEntityId: E1, leadAuditorId: 'c1' }, { ...org, auditorId: 'c1' })).toBe('manage');
  });
  it('campaigns stay with the audit entity that ran them', () => {
    // Same user id in another entity (separate account) never matches.
    expect(campaignAccess(foreignAuditor, campaign, org)).toBe('none');
    // Organization moved to entity 2: the old coordinator loses the aggregate view, the lead keeps it.
    const moved: OrganizationAssignment = { auditEntityId: E2, coordinatorId: 'c9', auditorId: 'a9' };
    expect(campaignAccess(coord, campaign, moved)).toBe('none');
    expect(campaignAccess(auditor, campaign, moved)).toBe('manage');
    expect(campaignAccess({ id: 'c9', role: 'COORDINATOR', auditEntityId: E2 }, campaign, moved)).toBe('none');
  });
});

describe('assignment rules', () => {
  it('only the assigned auditor of an active organization creates campaigns', () => {
    const active = { ...org, status: 'active' as const };
    expect(canCreateCampaignFor(auditor, active)).toBe(true);
    expect(canCreateCampaignFor(auditor2, active)).toBe(false);
    expect(canCreateCampaignFor(foreignAuditor, active)).toBe(false);
    expect(canCreateCampaignFor(auditor, { ...active, status: 'inactive' })).toBe(false);
    expect(canCreateCampaignFor(coord, { ...active, auditorId: 'c1' })).toBe(true);
    expect(canCreateCampaignFor({ ...superadmin, id: 'a1' }, active)).toBe(false);
    expect(canCreateCampaignFor({ id: 'x', role: 'AUDITOR', auditEntityId: null }, { ...active, auditEntityId: null, auditorId: 'x' })).toBe(false);
  });

  it('coordinators reach only the organizations assigned to them', () => {
    expect(coordinatesOrganization(coord, org)).toBe(true);
    expect(coordinatesOrganization(coord2, org)).toBe(false);
    expect(coordinatesOrganization(auditor, org)).toBe(false);
    expect(coordinatesOrganization({ id: 'c1', role: 'COORDINATOR', auditEntityId: E2 }, org)).toBe(false);
    expect(coordinatesOrganization({ id: 'c1', role: 'COORDINATOR', auditEntityId: null }, { ...org, auditEntityId: null })).toBe(false);
    expect(canAssignAuditor(coord, org)).toBe(true);
    expect(canAssignAuditor(coord2, org)).toBe(false);
    expect(canAssignAuditor(superadmin, org)).toBe(true);
    expect(canAssignAuditor(superadmin, { ...org, auditEntityId: null })).toBe(false);
  });

  it('eligible auditors: active auditors of the entity or its own coordinator', () => {
    const u = (over: object) => ({ id: 'a2', role: 'AUDITOR' as const, auditEntityId: E1, status: 'active' as const, ...over });
    expect(isEligibleAuditor(u({}), org)).toBe(true);
    expect(isEligibleAuditor(u({ status: 'inactive' }), org)).toBe(false);
    expect(isEligibleAuditor(u({ auditEntityId: E2 }), org)).toBe(false);
    expect(isEligibleAuditor(u({}), { ...org, auditEntityId: null })).toBe(false);
    expect(isEligibleAuditor(u({ id: 'c1', role: 'COORDINATOR' }), org)).toBe(true);
    expect(isEligibleAuditor(u({ id: 'c2', role: 'COORDINATOR' }), org)).toBe(false);
    expect(isEligibleAuditor(u({ role: 'SUPERADMIN_BUMII' }), org)).toBe(false);
    expect(isEligibleCoordinator(u({ id: 'c2', role: 'COORDINATOR' }), E1)).toBe(true);
    expect(isEligibleCoordinator(u({ id: 'c2', role: 'COORDINATOR' }), E2)).toBe(false);
    expect(isEligibleCoordinator(u({}), E1)).toBe(false);
    expect(isEligibleCoordinator(u({ role: 'COORDINATOR', status: 'inactive' }), E1)).toBe(false);
  });

  it('closed campaigns', () => {
    expect(isCampaignClosed('informe_generado')).toBe(true);
    expect(isCampaignClosed('cancelada')).toBe(true);
    expect(isCampaignClosed('finalizada')).toBe(false);
  });
});

describe('planAssignmentChange', () => {
  it('reassigning the auditor moves open campaigns to the new one', () => {
    expect(planAssignmentChange(org, { auditorId: 'a2' }, 2)).toEqual({
      ok: true,
      assignment: { auditEntityId: E1, coordinatorId: 'c1', auditorId: 'a2' },
      transferCampaignsTo: 'a2',
    });
    expect(planAssignmentChange(org, { auditorId: 'a1' }, 2)).toMatchObject({ ok: true, transferCampaignsTo: null });
  });

  it('removing the auditor is refused while campaigns are open', () => {
    expect(planAssignmentChange(org, { auditorId: null }, 1)).toEqual({ ok: false, error: 'ORG_HAS_OPEN_CAMPAIGNS' });
    expect(planAssignmentChange(org, { auditorId: null }, 0)).toMatchObject({ ok: true, assignment: { auditorId: null }, transferCampaignsTo: null });
  });

  it('changing the coordinator keeps the entity and auditor', () => {
    expect(planAssignmentChange(org, { coordinatorId: 'c2' }, 3)).toEqual({
      ok: true,
      assignment: { auditEntityId: E1, coordinatorId: 'c2', auditorId: 'a1' },
      transferCampaignsTo: null,
    });
  });

  it('changing the audit entity clears the assignment and needs no open campaigns', () => {
    expect(planAssignmentChange(org, { auditEntityId: E2 }, 1)).toEqual({ ok: false, error: 'ORG_HAS_OPEN_CAMPAIGNS' });
    expect(planAssignmentChange(org, { auditEntityId: E2 }, 0)).toEqual({
      ok: true,
      assignment: { auditEntityId: E2, coordinatorId: null, auditorId: null },
      transferCampaignsTo: null,
    });
    expect(planAssignmentChange(org, { auditEntityId: E2, coordinatorId: 'c9', auditorId: 'a9' }, 0)).toMatchObject({
      ok: true,
      assignment: { auditEntityId: E2, coordinatorId: 'c9', auditorId: 'a9' },
      transferCampaignsTo: null,
    });
    expect(planAssignmentChange(org, { auditEntityId: null }, 0)).toMatchObject({ ok: true, assignment: { auditEntityId: null, coordinatorId: null, auditorId: null } });
  });

  it('coordinator and auditor require an audit entity', () => {
    const empty: OrganizationAssignment = { auditEntityId: null, coordinatorId: null, auditorId: null };
    expect(planAssignmentChange(empty, { coordinatorId: 'c1' }, 0)).toEqual({ ok: false, error: 'COORDINATOR_REQUIRES_AUDIT_ENTITY' });
    expect(planAssignmentChange(empty, { auditorId: 'a1' }, 0)).toEqual({ ok: false, error: 'AUDITOR_REQUIRES_AUDIT_ENTITY' });
    expect(planAssignmentChange(empty, { auditEntityId: E1, coordinatorId: 'c1' }, 0)).toMatchObject({ ok: true, assignment: { auditEntityId: E1, coordinatorId: 'c1', auditorId: null } });
  });
});
