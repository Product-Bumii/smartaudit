import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { MemoryMailProvider } from '@smartaudit/mail';
import type { AppContext } from './context';
import { errorHandler, notFoundHandler } from './lib/errors';
import { authenticate, requireAuth } from './middleware/auth';
import { authRouter } from './routes/auth';
import { campaignsRouter } from './routes/campaigns';
import { configRouter } from './routes/config';
import { organizationsRouter } from './routes/organizations';
import { participantRouter } from './routes/participant';

function cors(origins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
      }
    }
    next();
  };
}

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  if (ctx.config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors(ctx.config.corsOrigins));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, version: process.env.APP_VERSION ?? 'dev' });
  });

  app.use('/api', authenticate(ctx));
  app.use('/api/auth', authRouter(ctx));
  app.use('/api/organizations', requireAuth, organizationsRouter(ctx));
  app.use('/api/config', requireAuth, configRouter(ctx));
  app.use('/api/campaigns', requireAuth, campaignsRouter(ctx));
  // Public: participants have no account.
  app.use('/api/participant', participantRouter(ctx));

  // Local in-memory mode only: lets the e2e suite read magic links. Never enabled in production.
  if (ctx.config.enableDevOutbox && ctx.mail instanceof MemoryMailProvider) {
    const outbox = ctx.mail;
    app.get('/api/dev/outbox', (_req, res) => {
      res.json({ items: outbox.outbox.map((m) => ({ to: m.to, subject: m.subject, text: m.text, sentAt: m.sentAt })) });
    });
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler(ctx.logger));
  return app;
}
