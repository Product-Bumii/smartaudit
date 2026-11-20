import type { LlmProvider } from '@smartaudit/llm';
import type { MailProvider } from '@smartaudit/mail';
import type { Logger } from 'pino';
import type { AppConfig } from './config';
import type { FieldCrypto } from './lib/crypto';

export interface RateLimits {
  /** Magic link requests per IP per 15 minutes. */
  magicLinkPerIp: number;
  /** Magic link requests per email per 15 minutes. */
  magicLinkPerEmail: number;
  /** Token verifications / account selections per IP per 15 minutes. */
  verifyPerIp: number;
  /** FAILED participant access-code attempts per IP per 15 minutes (then temporary lockout). */
  accessCodePerIp: number;
  /** Participant chat requests (answers, resumes) per IP per 15 minutes. */
  chatPerIp: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = { magicLinkPerIp: 30, magicLinkPerEmail: 5, verifyPerIp: 60, accessCodePerIp: 10, chatPerIp: 600 };

export interface AppContext {
  config: AppConfig;
  crypto: FieldCrypto;
  mail: MailProvider;
  /** AI provider (section 5.5): only phrases, clarifies and classifies. */
  llm: LlmProvider;
  logger: Logger;
  now: () => Date;
  rateLimits: RateLimits;
}
