import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.config.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = err as { status?: number; message?: string; details?: unknown };
  const status = e.status ?? 500;
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json({
    error: e.message ?? 'Internal server error',
    ...(e.details ? { details: e.details } : {}),
  });
}
