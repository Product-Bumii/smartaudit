/**
 * Local mode WITHOUT Docker (used by the e2e suite and for quick demos):
 * in-memory MongoDB replica set + seed + API with in-memory mail and the dev outbox
 * (GET /api/dev/outbox). Data is lost on exit. Never use in staging/production.
 *
 *   npm run dev:local            # API on :3000, then `npm start -w apps/web` (proxy to :3000)
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../apps/api/src/app';
import { createContext } from '../apps/api/src/bootstrap';
import { loadConfig } from '../apps/api/src/config';
import { runSeed } from '../seed/seed-lib';

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 90_000 }] });
  const uri = replSet.getUri('smartaudit');
  await mongoose.connect(uri);
  const config = loadConfig({
    NODE_ENV: 'development',
    PORT: String(port),
    MONGO_URL: uri,
    APP_URL: process.env.APP_URL ?? 'http://localhost:4200',
    CORS_ORIGINS: 'http://localhost:4200',
    JWT_SECRET: 'dev-local-jwt-secret-not-for-production-000000',
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    EMAIL_HASH_KEY: 'dev-local-email-hash-key-not-for-production-0',
    MAIL_PROVIDER: 'memory',
    ENABLE_DEV_OUTBOX: 'true',
    DEV_SHOW_MAGIC_LINK: 'true',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  });
  const ctx = createContext(config);
  await runSeed(ctx.crypto, () => undefined);
  const server = createApp(ctx).listen(port, () => {
    console.log(`SmartAudit efr API (in-memory) on http://localhost:${port}`);
    console.log(`Dev outbox (magic links): http://localhost:${port}/api/dev/outbox`);
  });
  const stop = async () => {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
