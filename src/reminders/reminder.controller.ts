import type { Request, Response, NextFunction } from 'express';
import { PrismaReminderRepository } from './reminder.repository.js';
import { ReminderService } from './reminder.service.js';
import type { CreateReminderDTO, UpdateReminderDTO } from './reminder.dto.js';

const service = new ReminderService(new PrismaReminderRepository());

function userId(req: Request): string {
  if (!req.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return req.user.sub;
}

export async function createReminder(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await service.create(userId(req), req.body as CreateReminderDTO));
  } catch (err) {
    next(err);
  }
}
export async function listReminders(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query['status'] as 'PROCESSING' | 'CANCELED' | undefined;
    res.json(await service.list(userId(req), status));
  } catch (err) {
    next(err);
  }
}
export async function getReminder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.get(userId(req), req.params['id'] as string));
  } catch (err) {
    next(err);
  }
}
export async function updateReminder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await service.update(userId(req), req.params['id'] as string, req.body as UpdateReminderDTO),
    );
  } catch (err) {
    next(err);
  }
}
export async function cancelReminder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.cancel(userId(req), req.params['id'] as string));
  } catch (err) {
    next(err);
  }
}
