import { describe, expect, it } from 'vitest';
import { searchPattern } from '../src/search';

const matches = (query: string, text: string) => new RegExp(searchPattern(query)!, 'i').test(text);

describe('searchPattern', () => {
  it('is null for an empty query', () => {
    expect(searchPattern('')).toBeNull();
    expect(searchPattern('   ')).toBeNull();
    expect(searchPattern(undefined)).toBeNull();
    expect(searchPattern(null)).toBeNull();
  });
  it('matches ignoring case and accents, in both directions', () => {
    expect(matches('montana', 'Montaña Textil S.L.')).toBe(true);
    expect(matches('IBÉRICA', 'Ibérica Logística')).toBe(true);
    expect(matches('logistica', 'Ibérica Logística')).toBe(true);
    expect(matches('logística', 'Iberica Logistica')).toBe(true);
    expect(matches('alimentos', 'Costa Alimentos')).toBe(true);
    expect(matches('andina', 'Costa Alimentos')).toBe(false);
  });
  it('escapes regular expression characters', () => {
    expect(matches('S.A.S.', 'Andina Servicios S.A.S.')).toBe(true);
    expect(matches('S.A.S.', 'Andina Servicios SxAxSx')).toBe(false);
    expect(matches('(a+)', 'x (a+) y')).toBe(true);
    expect(() => searchPattern('[*?')).not.toThrow();
  });
});
