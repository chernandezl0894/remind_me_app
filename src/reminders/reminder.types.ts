import type { Frequency, Priority, ReminderStatus } from '@prisma/client';

export interface Reminder {
  id: string;
  userId: string;
  note: string;
  createdAt: Date;
  nextReminderAt: Date;
  frequency: Frequency;
  priority: Priority;
  status: ReminderStatus;
}

export interface CreateReminderInput {
  note: string;
  nextReminderAt: Date;
  frequency: Frequency;
  priority: Priority;
}

export interface UpdateReminderInput {
  note?: string;
  nextReminderAt?: Date;
  frequency?: Frequency;
  priority?: Priority;
  status?: ReminderStatus;
}
