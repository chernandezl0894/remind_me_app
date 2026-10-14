import { Router } from 'express';
import { requireAuth } from '../shared/middlewares/require-auth.middleware.js';
import { validateBody } from '../shared/middlewares/validate-request.middleware.js';
import { createReminderSchema, updateReminderSchema } from './reminder.schema.js';
import {
  createReminder,
  listReminders,
  getReminder,
  updateReminder,
  cancelReminder,
} from './reminder.controller.js';

export const reminderRoutes = Router();
reminderRoutes.use(requireAuth);
reminderRoutes.post('/', validateBody(createReminderSchema), createReminder);
reminderRoutes.get('/', listReminders);
reminderRoutes.get('/:id', getReminder);
reminderRoutes.patch('/:id', validateBody(updateReminderSchema), updateReminder);
reminderRoutes.delete('/:id', cancelReminder);
