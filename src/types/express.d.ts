import type { AuthPayload } from '../shared/middlewares/require-auth.middleware.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}
