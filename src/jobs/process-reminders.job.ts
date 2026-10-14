import cron from 'node-cron';
import { prisma } from '../config/db.config.js';
import { logger } from '../config/logger.config.js';
import { PrismaReminderRepository } from '../reminders/reminder.repository.js';
import { PrismaNotificationLogRepository } from '../notifications/notification-log.repository.js';
import { SmtpMailService } from '../notifications/mail.service.js';
import { computeNextReminder, rollForwardToFuture } from '../shared/utils/date.util.js';

const reminders = new PrismaReminderRepository();
const logs = new PrismaNotificationLogRepository();
const mail = new SmtpMailService();

export async function processDueReminders(now = new Date()): Promise<number> {
  const due = await reminders.findDue(now, 100);
  let processed = 0;
  for (const r of due) {
    // Solo PROCESSING (findDue ya filtra); ignora CANCELED
    if (now < r.nextReminderAt) continue;
    try {
      await mail.send(
        r.user.email,
        `Recordatorio (${r.priority}): ${r.note.slice(0, 60)}`,
        `<p>${r.note}</p><p>Frecuencia: ${r.frequency}</p>`,
      );
      await logs.log(r.id, true);
      const raw = computeNextReminder(r.nextReminderAt, r.frequency);
      const next = raw ? rollForwardToFuture(r.nextReminderAt, r.frequency, now) : null;
      await reminders.markNotified(r.id, next);
      processed++;
    } catch (err) {
      logger.error({ err, reminderId: r.id }, 'Failed to notify reminder');
      await logs.log(r.id, false, (err as Error).message).catch(() => {});
    }
  }
  logger.info({ processed }, 'processDueReminders finished');
  return processed;
}

export function scheduleReminderJob() {
  cron.schedule('* * * * *', () => {
    processDueReminders().catch((err) => logger.error({ err }, 'Cron failed'));
  });
  logger.info('Reminder cron scheduled: every minute');
}

// CLI: npm run reminders:process
if (process.argv.includes('--run-once')) {
  processDueReminders()
    .then((n) => {
      console.log(`Processed: ${n}`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
