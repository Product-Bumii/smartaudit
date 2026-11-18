import { describe, expect, it } from 'vitest';
import { isAvailableLanguage } from '../src/enums';
import {
  activationSchema,
  assignedOrganizationListQuerySchema,
  campaignListQuerySchema,
  campaignM1InputSchema,
  emailSchema,
  organizationCreateSchema,
  organizationListQuerySchema,
  superadminCreateSchema,
  userPreferencesSchema,
} from '../src/schemas';

describe('schemas', () => {
  it('normalizes emails', () => {
    expect(emailSchema.parse('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(emailSchema.safeParse('nope').success).toBe(false);
    expect(emailSchema.safeParse(42).success).toBe(false);
  });

  it('validates organizations (time zone and country)', () => {
    const ok = { name: 'Org', country: 'CO', timeZone: 'America/Bogota', defaultLanguage: 'es' };
    expect(organizationCreateSchema.safeParse(ok).success).toBe(true);
    expect(organizationCreateSchema.safeParse({ ...ok, timeZone: 'Mars/Base' }).success).toBe(false);
    expect(organizationCreateSchema.safeParse({ ...ok, country: 'col' }).success).toBe(false);
  });

  it('only allows superadmin roles for superadmin creation', () => {
    expect(superadminCreateSchema.safeParse({ email: 'a@b.co', role: 'SUPERADMIN_FUNDACION' }).success).toBe(true);
    expect(superadminCreateSchema.safeParse({ email: 'a@b.co', role: 'AUDITOR' }).success).toBe(false);
  });

  it('parses recursive activation rules', () => {
    expect(
      activationSchema.safeParse({
        kind: 'all',
        of: [{ kind: 'not', expr: { kind: 'campaign_in', field: 'excellence', values: [true] } }, { kind: 'always' }],
      }).success,
    ).toBe(true);
    expect(activationSchema.safeParse({ kind: 'script', code: 'x' }).success).toBe(false);
  });

  it('validates M1 campaign input', () => {
    const r = campaignM1InputSchema.safeParse({
      norm: '1000-1',
      auditType: 'inicial',
      excellence: false,
      interviewStartDate: '2026-12-01',
      scopeSize: 120,
      maxCompleted: 25,
      languages: ['es'],
    });
    expect(r.success).toBe(true);
  });

  it('does not accept the hidden language (ca) where a language is chosen', () => {
    const base = { norm: '1000-1', auditType: 'inicial', excellence: false, interviewStartDate: '2026-12-01', scopeSize: 120 };
    expect(campaignM1InputSchema.safeParse({ ...base, languages: ['es', 'ca'] }).success).toBe(false);
    expect(userPreferencesSchema.safeParse({ preferredLanguage: 'ca' }).success).toBe(false);
    expect(userPreferencesSchema.safeParse({ preferredLanguage: 'pt' }).success).toBe(true);
    expect(isAvailableLanguage('ca')).toBe(false);
    expect(isAvailableLanguage('fr')).toBe(true);
  });

  it('parses list queries with defaults and limits', () => {
    expect(organizationListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25, sort: 'name' });
    expect(organizationListQuerySchema.parse({ q: ' andina ', page: '2', pageSize: '50', auditEntityId: 'none', dir: 'desc' })).toMatchObject({
      q: 'andina', page: 2, pageSize: 50, auditEntityId: 'none', dir: 'desc',
    });
    expect(organizationListQuerySchema.safeParse({ pageSize: '33' }).success).toBe(false);
    expect(assignedOrganizationListQuerySchema.parse({ sort: 'country' }).sort).toBe('country');
    expect(campaignListQuerySchema.parse({ status: 'open' })).toMatchObject({ status: 'open', sort: 'createdAt' });
    expect(campaignListQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});
