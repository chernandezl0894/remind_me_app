import { prisma } from '../config/db.config.js';
import type { ReminderStatus } from '@prisma/client';
import type { CreateReminderInput, Reminder, UpdateReminderInput } from './reminder.types.js';

export interface ReminderRepository {
  create(userId: string, input: CreateReminderInput): Promise<Reminder>;
  findByUser(userId: string, status?: ReminderStatus): Promise<Reminder[]>;
  findByIdForUser(id: string, userId: string): Promise<Reminder | null>;
  updateForUser(id: string, userId: string, input: UpdateReminderInput): Promise<Reminder>;
  findDue(now: Date, limit?: number): Promise<Array<Reminder & { user: { email: string } }>>;
  markNotified(id: string, next: Date | null): Promise<void>;
}

export class PrismaReminderRepository implements ReminderRepository {
  create(userId: string, input: CreateReminderInput) {
    return prisma.reminder.create({ data: { userId, ...input } });
  }
  findByUser(userId: string, status?: ReminderStatus) {
    return prisma.reminder.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { nextReminderAt: 'asc' },
    });
  }
  findByIdForUser(id: string, userId: string) {
    return prisma.reminder.findFirst({ where: { id, userId } });
  }
  updateForUser(id: string, userId: string, input: UpdateReminderInput) {
    return prisma.reminder.update({ where: { id, userId } as never, data: input });
  }
  findDue(now: Date, limit = 100) {
    return prisma.reminder.findMany({
      where: { status: 'PROCESSING', nextReminderAt: { lte: now } },
      orderBy: { nextReminderAt: 'asc' },
      take: limit,
      include: { user: { select: { email: true } } },
    });
  }
  async markNotified(id: string, next: Date | null) {
    if (next) await prisma.reminder.update({ where: { id }, data: { nextReminderAt: next } });
    else await prisma.reminder.update({ where: { id }, data: { status: 'CANCELED' } });
  }
}
