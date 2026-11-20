import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  /** `staging`: production build and hardening, but allows test-only aids (DEV_SHOW_MAGIC_LINK). */
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  MONGO_URL: z.string().min(1).default('mongodb://localhost:27017/smartaudit?replicaSet=rs0'),
  APP_URL: z.string().url().default('http://localhost:4200'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  JWT_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  EMAIL_HASH_KEY: z.string().min(32),
  MAIL_PROVIDER: z.enum(['smtp', 'memory', 'disabled']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_NAME: z.string().default('SmartAudit efr'),
  MAIL_FROM_ADDRESS: z.string().default('no-reply@bumii.ai'),
  COOKIE_SECURE: bool.optional(),
  TRUST_PROXY: bool.default(false),
  ENABLE_DEV_OUTBOX: bool.default(false),
  /** Test environments without email: the magic link is returned to the browser. Never in production. */
  DEV_SHOW_MAGIC_LINK: bool.default(false),
  /** AI provider adapter (section 5.5): `mock` (development, tests) or `gemini` (decision 83). */
  LLM_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  /**
   * Gemini API key. Prefer NOT to put it in the environment: in the servers it is an encrypted systemd
   * credential (`gemini_api_key`, read from $CREDENTIALS_DIRECTORY) or a file (`GEMINI_API_KEY_FILE`).
   */
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY_FILE: z.string().optional(),
  CREDENTIALS_DIRECTORY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  GEMINI_BASE_URL: z.string().url().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export interface AppConfig {
  env: 'development' | 'test' | 'staging' | 'production';
  port: number;
  mongoUrl: string;
  appUrl: string;
  corsOrigins: string[];
  jwtSecret: string;
  fieldEncryptionKey: string;
  emailHashKey: string;
  mail: {
    provider: 'smtp' | 'memory' | 'disabled';
    smtp: { host: string; port: number; secure: boolean; user?: string; pass?: string };
    from: { name: string; address: string };
  };
  cookieSecure: boolean;
  trustProxy: boolean;
  enableDevOutbox: boolean;
  devShowMagicLink: boolean;
  logLevel: string;
  llmProvider: 'mock' | 'gemini';
  gemini: { apiKey: string; model: string; baseUrl?: string; timeoutMs: number } | null;
  /** Session lifetime and magic link expiry. */
  sessionHours: number;
  magicLinkMinutes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = envSchema.parse(env);
  const isProd = e.NODE_ENV === 'production';
  const isDeployed = isProd || e.NODE_ENV === 'staging';
  if (isProd && (e.MAIL_PROVIDER !== 'smtp' || e.ENABLE_DEV_OUTBOX || e.DEV_SHOW_MAGIC_LINK)) {
    throw new Error('only SMTP mail is allowed in production; dev outbox and DEV_SHOW_MAGIC_LINK are not allowed');
  }
  if (e.NODE_ENV === 'staging' && e.ENABLE_DEV_OUTBOX) throw new Error('the dev outbox is not allowed in staging');
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    mongoUrl: e.MONGO_URL,
    appUrl: e.APP_URL.replace(/\/$/, ''),
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    jwtSecret: e.JWT_SECRET,
    fieldEncryptionKey: e.FIELD_ENCRYPTION_KEY,
    emailHashKey: e.EMAIL_HASH_KEY,
    mail: {
      provider: e.MAIL_PROVIDER,
      smtp: { host: e.SMTP_HOST, port: e.SMTP_PORT, secure: e.SMTP_SECURE, user: e.SMTP_USER, pass: e.SMTP_PASS },
      from: { name: e.MAIL_FROM_NAME, address: e.MAIL_FROM_ADDRESS },
    },
    cookieSecure: e.COOKIE_SECURE ?? isDeployed,
    trustProxy: e.TRUST_PROXY,
    enableDevOutbox: !isDeployed && e.ENABLE_DEV_OUTBOX && e.MAIL_PROVIDER === 'memory',
    devShowMagicLink: !isProd && e.DEV_SHOW_MAGIC_LINK,
    logLevel: e.LOG_LEVEL,
    llmProvider: e.LLM_PROVIDER,
    gemini: e.LLM_PROVIDER === 'gemini' ? { apiKey: geminiApiKey(e), model: e.GEMINI_MODEL, baseUrl: e.GEMINI_BASE_URL, timeoutMs: e.LLM_TIMEOUT_MS } : null,
    sessionHours: 8,
    magicLinkMinutes: 15,
  };
}

/**
 * Gemini API key: env var, explicit file, or the systemd credential `gemini_api_key`
 * (LoadCredentialEncrypted= in smartaudit-api.service). Fails at start-up if Gemini is chosen without a key.
 */
function geminiApiKey(e: z.infer<typeof envSchema>): string {
  if (e.GEMINI_API_KEY?.trim()) return e.GEMINI_API_KEY.trim();
  const file = e.GEMINI_API_KEY_FILE ?? (e.CREDENTIALS_DIRECTORY ? join(e.CREDENTIALS_DIRECTORY, 'gemini_api_key') : null);
  const key = file && existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  if (!key) throw new Error('LLM_PROVIDER=gemini requires an API key (systemd credential gemini_api_key, GEMINI_API_KEY_FILE or GEMINI_API_KEY)');
  return key;
}
