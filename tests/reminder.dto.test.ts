import { describe, it, expect } from 'vitest';
import { toReminderResponse } from '../src/reminders/reminder.dto.js';

describe('toReminderResponse', () => {
  it('oculta userId y campos internos', () => {
    const dto = toReminderResponse({
      id: 'r1',
      userId: 'u1',
      note: 'pagar luz',
      createdAt: new Date(),
      nextReminderAt: new Date(),
      frequency: 'DAILY',
      priority: 'HIGH',
      status: 'PROCESSING',
    });
    expect(dto).not.toHaveProperty('userId');
    expect(dto.note).toBe('pagar luz');
  });
});
