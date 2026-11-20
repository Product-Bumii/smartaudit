/**
 * Background worker (Agenda, queue persisted in MongoDB).
 * - campaign-scheduler (every minute): invitations, reminders and automatic status changes (section 5.4).
 * - retention-purge (daily, disabled by default in settings).
 * TODO(Fase 3): report generation (docx/xlsx, LibreOffice → PDF).
 */
import { Agenda } from 'agenda';
import mongoose from 'mongoose';
import pino from 'pino';
import { createContext } from '@smartaudit/api/bootstrap';
import { loadConfig } from '@smartaudit/api/config';
import { runScheduler } from '@smartaudit/api/services/scheduler';
import { runRetentionPurge } from './jobs/retention';

const log = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017/smartaudit?replicaSet=rs0';
  await mongoose.connect(mongoUrl);
  const agenda = new Agenda({ db: { address: mongoUrl, collection: 'agendaJobs' }, processEvery: '1 minute' });

  // Same configuration as the API (mail provider, encryption keys, app URL for the invitation links).
  // The worker never calls the AI, so it does not need the Gemini key.
  const ctx = createContext(loadConfig({ ...process.env, MONGO_URL: mongoUrl, LLM_PROVIDER: 'mock' }));
  agenda.define('campaign-scheduler', async () => {
    await runScheduler(ctx);
  });

  agenda.define('retention-purge', async () => {
    const result = await runRetentionPurge(new Date());
    log.info(result, 'retention purge');
  });

  await agenda.start();
  await agenda.every('1 minute', 'campaign-scheduler');
  await agenda.every('0 3 * * *', 'retention-purge', {}, { timezone: 'Europe/Madrid' });
  log.info('worker started');

  const shutdown = async () => {
    await agenda.stop();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.error({ err: err.message }, 'worker failed');
  process.exit(1);
});
