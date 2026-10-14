import { Router } from 'express';
import { requestCode, verifyCode } from './auth.controller.js';
import { validateBody } from '../shared/middlewares/validate-request.middleware.js';
import { requestCodeSchema, verifyCodeSchema } from './auth.schema.js';

export const authRoutes = Router();
authRoutes.post('/request-code', validateBody(requestCodeSchema), requestCode);
authRoutes.post('/verify-code', validateBody(verifyCodeSchema), verifyCode);
