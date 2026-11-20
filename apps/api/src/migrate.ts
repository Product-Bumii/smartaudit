/** Idempotent migrations run on every deploy: collections, indexes and default settings. */
import { loadConfig } from './config';
import { connectDb } from './bootstrap';
import { getSettings, syncAllIndexes } from './models';
import mongoose from 'mongoose';

async function main() {
  // Migrations never call the AI: they do not need (nor get) the Gemini key.
  const config = loadConfig({ ...process.env, LLM_PROVIDER: 'mock' });
  await connectDb(config.mongoUrl);
  await syncAllIndexes();
  await getSettings();
  console.warn('migrations ok');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('migration failed', err);
  process.exit(1);
});
