import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { MemoryMailProvider } from '@smartaudit/mail';
import { runSeed, SEED_ENTITIES, SEED_ORGS } from '../../../seed/seed-lib';
import { createApp } from '../src/app';
import { createContext } from '../src/bootstrap';
import { loadConfig } from '../src/config';
import type { AppContext, RateLimits } from '../src/context';
import { AuditEntity, Organization, User } from '../src/models';

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
  /** Audited organizations: CO and ES have an auditor (auditor1 in each entity); CO2 has none; ES2 → auditor2. */
  orgs: Record<keyof typeof SEED_ORGS, string>;
  /** Audit entities: CO = ICONTEC, ES = AENOR. */
  entities: Record<keyof typeof SEED_ENTITIES, string>;
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
  const orgId = async (k: keyof typeof SEED_ORGS) => String((await Organization.findOne({ name: SEED_ORGS[k].name }).lean())!._id);
  const entityId = async (k: keyof typeof SEED_ENTITIES) => String((await AuditEntity.findOne({ name: SEED_ENTITIES[k].name }).lean())!._id);
  const orgs = { CO: await orgId('CO'), ES: await orgId('ES'), CO2: await orgId('CO2'), ES2: await orgId('ES2') };
  defaultOrganizationId = orgs.CO;
  return {
    ctx,
    app: createApp(ctx),
    mail,
    replSet,
    orgs,
    entities: { CO: await entityId('CO'), ES: await entityId('ES') },
    stop: async () => {
      await mongoose.disconnect();
      await replSet.stop();
    },
  };
}

/** Session cookie for a user found by email and audit entity (`null` for superadmins). */
export async function sessionFor(env: TestEnv, email: string, auditEntityId: string | null = null): Promise<string> {
  const user = await User.findOne({ emailHash: env.ctx.crypto.hash(email), auditEntityId }).lean();
  if (!user) throw new Error(`no seed user ${email}`);
  const token = jwt.sign({ purpose: 'session' }, env.ctx.config.jwtSecret, { subject: String(user._id), expiresIn: '8h' });
  return `sa_session=${token}`;
}

let defaultOrganizationId = '';

/** Campaign input; by default for the CO organization (assigned to auditor1 @ ICONTEC). */
export const campaignInput = (over: Record<string, unknown> = {}) => ({
  organizationId: defaultOrganizationId,
  reference: 'Auditoría sintética',
  norm: '1000-1',
  auditType: 'inicial',
  excellence: false,
  efrManagerName: 'Mánager ficticio',
  interviewStartDate: '2026-11-25',
  scopeSize: 120,
  languages: ['es', 'en', 'pt'],
  ...over,
});

/** Extracts the magic link token from the last email sent to `to`. */
export function lastMagicToken(mail: MemoryMailProvider, to: string): string {
  const msg = [...mail.outbox].reverse().find((m) => m.to === to);
  const match = msg?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`no magic link for ${to}`);
  return match[1];
}
