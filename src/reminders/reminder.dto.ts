import type { Frequency, Priority, ReminderStatus } from '@prisma/client';
import type { Reminder } from './reminder.types.js';

/** Transporte entrada/salida de reminders. El controller valida con zod y pasa DTOs al service. */
export interface CreateReminderDTO {
  note: string;
  nextReminderAt: Date;
  frequency: Frequency;
  priority: Priority;
}

export interface UpdateReminderDTO {
  note?: string;
  nextReminderAt?: Date;
  frequency?: Frequency;
  priority?: Priority;
  status?: ReminderStatus;
}

export interface ReminderResponseDTO {
  id: string;
  note: string;
  nextReminderAt: Date;
  frequency: Frequency;
  priority: Priority;
  status: ReminderStatus;
  createdAt: Date;
}

/** Evita filtrar userId y otros campos internos del modelo Prisma. */
export function toReminderResponse(r: Reminder): ReminderResponseDTO {
  return {
    id: r.id,
    note: r.note,
    nextReminderAt: r.nextReminderAt,
    frequency: r.frequency,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt,
  };
}
