import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        Object.assign(new Error('Validation error'), {
          status: 400,
          details: parsed.error.flatten(),
        }),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
