import { ApiError } from '../shared/errors/api-error.error.js';
import type { ReminderStatus } from '@prisma/client';
import type { ReminderRepository } from './reminder.repository.js';
import {
  toReminderResponse,
  type CreateReminderDTO,
  type ReminderResponseDTO,
  type UpdateReminderDTO,
} from './reminder.dto.js';

export class ReminderService {
  constructor(private repo: ReminderRepository) {}

  async create(userId: string, input: CreateReminderDTO): Promise<ReminderResponseDTO> {
    if (input.nextReminderAt.getTime() < Date.now() - 60_000 && input.frequency === 'ONCE') {
      throw ApiError.badRequest('nextReminderAt must be in the future for ONCE reminders');
    }
    return toReminderResponse(await this.repo.create(userId, input));
  }

  async list(userId: string, status?: ReminderStatus): Promise<ReminderResponseDTO[]> {
    return (await this.repo.findByUser(userId, status)).map(toReminderResponse);
  }

  async get(userId: string, id: string): Promise<ReminderResponseDTO> {
    const r = await this.repo.findByIdForUser(id, userId);
    if (!r) throw ApiError.notFound('Reminder not found');
    return toReminderResponse(r);
  }

  async update(userId: string, id: string, input: UpdateReminderDTO): Promise<ReminderResponseDTO> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw ApiError.notFound('Reminder not found');
    return toReminderResponse(await this.repo.updateForUser(id, userId, input));
  }

  async cancel(userId: string, id: string): Promise<ReminderResponseDTO> {
    return this.update(userId, id, { status: 'CANCELED' });
  }
}
