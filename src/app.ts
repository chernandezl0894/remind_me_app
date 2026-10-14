import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './config/logger.config.js';
import { authRoutes } from './auth/auth.routes.js';
import { reminderRoutes } from './reminders/reminder.routes.js';
import { errorHandler } from './shared/middlewares/error-handler.middleware.js';

export function buildApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
