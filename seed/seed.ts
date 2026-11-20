/** CLI: `npm run seed` (uses MONGO_URL, FIELD_ENCRYPTION_KEY and EMAIL_HASH_KEY from the environment). */
import mongoose from 'mongoose';
import { loadConfig } from '../apps/api/src/config';
import { connectDb } from '../apps/api/src/bootstrap';
import { FieldCrypto } from '../apps/api/src/lib/crypto';
import { runSeed } from './seed-lib';

async function main() {
  // The seed never calls the AI: it does not need (nor get) the Gemini key.
  const config = loadConfig({ ...process.env, LLM_PROVIDER: 'mock' });
  await connectDb(config.mongoUrl);
  await runSeed(new FieldCrypto(config.fieldEncryptionKey, config.emailHashKey));
  await mongoose.disconnect();
  console.log('seed ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
