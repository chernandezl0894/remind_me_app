import type { Frequency } from '@prisma/client';

export function computeNextReminder(from: Date, frequency: Frequency): Date | null {
  const next = new Date(from);
  switch (frequency) {
    case 'ONCE':
      return null;
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      return next;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      return next;
    case 'MONTHLY': {
      const day = next.getDate();
      next.setMonth(next.getMonth() + 1);
      if (next.getDate() < day) next.setDate(0);
      return next;
    }
    default:
      return null;
  }
}

/** Avanza fechas pasadas hasta futuro (evita spam si el job estuvo caído). */
export function rollForwardToFuture(
  from: Date,
  frequency: Frequency,
  now = new Date(),
): Date | null {
  let next = computeNextReminder(from, frequency);
  if (!next) return null;
  let guard = 0;
  while (next <= now && guard++ < 366) {
    const n = computeNextReminder(next, frequency);
    if (!n) return null;
    next = n;
  }
  return next;
}
