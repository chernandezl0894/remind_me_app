import { describe, it, expect } from 'vitest';
import { computeNextReminder } from '../src/shared/utils/date.util.js';

describe('computeNextReminder', () => {
  it('ONCE returns null', () => {
    expect(computeNextReminder(new Date('2026-01-01'), 'ONCE')).toBeNull();
  });
  it('DAILY adds one day', () => {
    const next = computeNextReminder(new Date('2026-01-01T10:00:00Z'), 'DAILY');
    expect(next?.toISOString()).toBe('2026-01-02T10:00:00.000Z');
  });
});
