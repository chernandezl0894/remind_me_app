import { prisma } from '../config/db.config.js';

export interface NotificationLogRepository {
  log(reminderId: string, success: boolean, error?: string): Promise<void>;
}

export class PrismaNotificationLogRepository implements NotificationLogRepository {
  async log(reminderId: string, success: boolean, error?: string) {
    await prisma.notificationLog.create({ data: { reminderId, success, error } });
  }
}
