import { createApp } from './app';
import { connectDb, createContext } from './bootstrap';
import { getSettings, syncAllIndexes } from './models';

async function main() {
  const ctx = createContext();
  await connectDb(ctx.config.mongoUrl);
  await syncAllIndexes();
  await getSettings();
  const app = createApp(ctx);
  app.listen(ctx.config.port, () => ctx.logger.info({ port: ctx.config.port, env: ctx.config.env }, 'api listening'));
}

main().catch((err) => {
  console.error('fatal', err);
  process.exit(1);
});
