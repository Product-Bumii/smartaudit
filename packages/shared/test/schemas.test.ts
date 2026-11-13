import { describe, expect, it } from 'vitest';
import {
  activationSchema,
  campaignM1InputSchema,
  emailSchema,
  organizationCreateSchema,
  superadminCreateSchema,
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
      visitDate: '2026-12-01',
      scopeSize: 120,
      languages: ['es'],
    });
    expect(r.success).toBe(true);
  });
});
