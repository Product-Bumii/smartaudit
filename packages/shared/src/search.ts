/**
 * Free-text search in lists: case- and accent-insensitive "contains" match, built as a safe regular
 * expression (user input is escaped).
 */
const EQUIVALENTS: Record<string, string> = {
  a: 'aáàâäã',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôöõ',
  u: 'uúùûü',
  n: 'nñ',
  c: 'cç',
};
const BASE = new Map(Object.entries(EQUIVALENTS).flatMap(([base, chars]) => [...chars].map((ch) => [ch, base] as const)));

/** Regular expression source for `query`, or `null` when the query is empty. Use with the `i` flag. */
export function searchPattern(query: string | null | undefined): string | null {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return null;
  return [...q]
    .map((ch) => {
      const base = BASE.get(ch);
      if (base) return `[${EQUIVALENTS[base]}]`;
      return ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    })
    .join('');
}
