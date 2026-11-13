import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { MemoryMailProvider } from '@smartaudit/mail';
import { runSeed, SEED_ORGS } from '../../../seed/seed-lib';
import { createApp } from '../src/app';
import { createContext } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import type { AppContext, RateLimits } from '../src/context';
import { Organization, User } from '../src/models';

export const TEST_ENV = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-0123456789-0123456789-abcdef',
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  EMAIL_HASH_KEY: 'test-email-hash-key-0123456789-0123456789',
  MAIL_PROVIDER: 'memory',
  LOG_LEVEL: 'silent',
  APP_URL: 'http://localhost:4200',
} as const;

export interface TestEnv {
  ctx: AppContext;
  app: ReturnType<typeof createApp>;
  mail: MemoryMailProvider;
  replSet: MongoMemoryReplSet;
  orgs: { CO: string; ES: string };
  stop: () => Promise<void>;
}

export async function startTestEnv(opts: { rateLimits?: Partial<RateLimits> } = {}): Promise<TestEnv> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 90_000 }],
  });
  const uri = replSet.getUri('smartaudit_test');
  await mongoose.connect(uri);
  const config = loadConfig({ ...TEST_ENV, MONGO_URL: uri });
  const mail = new MemoryMailProvider();
  const ctx = createContext(config, {
    mail,
    now: () => new Date('2026-11-12T12:00:00Z'),
    rateLimits: { magicLinkPerIp: 1000, magicLinkPerEmail: 1000, verifyPerIp: 1000, accessCodePerIp: 1000, ...opts.rateLimits },
  });
  await runSeed(ctx.crypto, () => undefined);
  const co = await Organization.findOne({ name: SEED_ORGS.CO.name }).lean();
  const es = await Organization.findOne({ name: SEED_ORGS.ES.name }).lean();
  return {
    ctx,
    app: createApp(ctx),
    mail,
    replSet,
    orgs: { CO: String(co!._id), ES: String(es!._id) },
    stop: async () => {
      await mongoose.disconnect();
      await replSet.stop();
    },
  };
}

/** Session cookie for a user found by email (and organization, for multi-account emails). */
export async function sessionFor(env: TestEnv, email: string, organizationId: string | null = null): Promise<string> {
  const user = await User.findOne({ emailHash: env.ctx.crypto.hash(email), ...(organizationId !== undefined ? { organizationId } : {}) }).lean();
  if (!user) throw new Error(`no seed user ${email}`);
  const token = jwt.sign({ purpose: 'session' }, env.ctx.config.jwtSecret, { subject: String(user._id), expiresIn: '8h' });
  return `sa_session=${token}`;
}

export const campaignInput = (over: Record<string, unknown> = {}) => ({
  reference: 'Auditoría sintética',
  norm: '1000-1',
  auditType: 'inicial',
  excellence: false,
  efrManagerName: 'Mánager ficticio',
  visitDate: '2026-12-09',
  scopeSize: 120,
  languages: ['es', 'en', 'ca'],
  ...over,
});

/** Extracts the magic link token from the last email sent to `to`. */
export function lastMagicToken(mail: MemoryMailProvider, to: string): string {
  const msg = [...mail.outbox].reverse().find((m) => m.to === to);
  const match = msg?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`no magic link for ${to}`);
  return match[1];
}
