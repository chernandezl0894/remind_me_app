import { z } from 'zod';

const frequency = z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const status = z.enum(['PROCESSING', 'CANCELED']);

export const createReminderSchema = z.object({
  note: z.string().min(1).max(280),
  nextReminderAt: z.coerce.date(),
  frequency: frequency.default('ONCE'),
  priority: priority.default('MEDIUM'),
});

export const updateReminderSchema = z
  .object({
    note: z.string().min(1).max(280).optional(),
    nextReminderAt: z.coerce.date().optional(),
    frequency: frequency.optional(),
    priority: priority.optional(),
    status: status.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
