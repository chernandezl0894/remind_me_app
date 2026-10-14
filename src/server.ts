import { env } from './config/env.config.js';
import { logger } from './config/logger.config.js';
import { buildApp } from './app.js';
import { scheduleReminderJob } from './jobs/process-reminders.job.js';

const app = buildApp();
app.listen(env.PORT, () => {
  logger.info(`API listening on :${env.PORT}`);
  if (process.env['DISABLE_CRON'] !== 'true') scheduleReminderJob();
});
