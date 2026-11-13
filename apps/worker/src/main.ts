/**
 * Background worker (Agenda, queue persisted in MongoDB).
 * Phase 1: only the retention purge (disabled by default in settings).
 * TODO(Fase 2): invitations, reminders, scheduled status changes, AI coding.
 * TODO(Fase 3): report generation (docx/xlsx, LibreOffice → PDF).
 */
import { Agenda } from 'agenda';
import mongoose from 'mongoose';
import pino from 'pino';
import { runRetentionPurge } from './jobs/retention';

const log = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017/smartaudit?replicaSet=rs0';
  await mongoose.connect(mongoUrl);
  const agenda = new Agenda({ db: { address: mongoUrl, collection: 'agendaJobs' }, processEvery: '1 minute' });

  agenda.define('retention-purge', async () => {
    const result = await runRetentionPurge(new Date());
    log.info(result, 'retention purge');
  });

  await agenda.start();
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
