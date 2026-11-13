/**
 * Random identifiers for participants without email and campaign slugs.
 * Pure: the API injects a cryptographically secure byte source (`crypto.randomBytes`).
 */

/** Uppercase alphabet without ambiguous characters (no 0/O, 1/I/L). */
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACCESS_CODE_LENGTH = 8;
/** Lowercase alphabet for URL slugs, same exclusions. */
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SLUG_LENGTH = 10;

export type ByteSource = (count: number) => Uint8Array;

/** Unbiased random string by rejection sampling over the byte source. */
export function randomString(alphabet: string, length: number, bytes: ByteSource): string {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const b of bytes(length * 2)) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}

export const generateAccessCode = (bytes: ByteSource): string =>
  randomString(ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH, bytes);

export const generateSlug = (bytes: ByteSource): string => randomString(SLUG_ALPHABET, SLUG_LENGTH, bytes);

/** Accepts what a person types from a paper slip: lowercase, spaces or dashes. */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isWellFormedAccessCode(code: string): boolean {
  return code.length === ACCESS_CODE_LENGTH && [...code].every((c) => ACCESS_CODE_ALPHABET.includes(c));
}
