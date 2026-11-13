/**
 * Field-level encryption (AES-256-GCM) and keyed hashes for lookups / duplicate detection.
 * Emails are never stored in clear text: `<field>Encrypted` + `<field>Hash`.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export class FieldCrypto {
  private readonly key: Buffer;

  constructor(
    keyBase64: string,
    private readonly hashKey: string,
  ) {
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes encoded in base64');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ct] = payload.split(':');
    if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error('Invalid encrypted payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  }

  /** Keyed hash (HMAC-SHA256) of a normalized value; stable for lookups. */
  hash(value: string): string {
    return createHmac('sha256', this.hashKey).update(value).digest('hex');
  }
}

/** URL-safe random token (default 32 bytes). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** SHA-256 of a high-entropy secret (tokens, access codes) for storage. */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const secureBytes = (n: number): Uint8Array => randomBytes(n);
