import mongoose from 'mongoose';
import { createLlmProvider } from '@smartaudit/llm';
import { DisabledMailProvider, MemoryMailProvider, SmtpMailProvider, type MailProvider } from '@smartaudit/mail';
import { loadConfig, type AppConfig } from './config';
import { DEFAULT_RATE_LIMITS, type AppContext } from './context';
import { FieldCrypto } from './lib/crypto';
import { createLogger } from './lib/logger';

export function createMailProvider(config: AppConfig): MailProvider {
  if (config.mail.provider === 'memory') return new MemoryMailProvider();
  if (config.mail.provider === 'disabled') return new DisabledMailProvider();
  return new SmtpMailProvider({ ...config.mail.smtp, from: config.mail.from });
}

export function createContext(config: AppConfig = loadConfig(), overrides: Partial<AppContext> = {}): AppContext {
  return {
    config,
    crypto: new FieldCrypto(config.fieldEncryptionKey, config.emailHashKey),
    mail: createMailProvider(config),
    llm: createLlmProvider(config.llmProvider, { gemini: config.gemini ?? undefined }),
    logger: createLogger(config.logLevel),
    now: () => new Date(),
    rateLimits: DEFAULT_RATE_LIMITS,
    ...overrides,
  };
}

export async function connectDb(url: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(url, { serverSelectionTimeoutMS: 15_000 });
}
