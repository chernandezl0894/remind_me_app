import { z } from 'zod';

export const requestCodeSchema = z.object({ email: z.string().email().max(255) });
export const verifyCodeSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
