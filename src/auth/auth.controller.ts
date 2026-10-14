import type { Request, Response, NextFunction } from 'express';
import { PrismaUserRepository } from '../users/user.repository.js';
import { PrismaOtpRepository } from './otp.repository.js';
import { SmtpMailService } from '../notifications/mail.service.js';
import { AuthService } from './auth.service.js';
import type { RequestCodeDTO, VerifyCodeDTO } from './auth.dto.js';

const service = new AuthService(
  new PrismaUserRepository(),
  new PrismaOtpRepository(),
  new SmtpMailService(),
);

export async function requestCode(req: Request, res: Response, next: NextFunction) {
  try {
    await service.requestCode(req.body as RequestCodeDTO);
    res.status(200).json({ message: 'Code sent if email is valid' });
  } catch (err) {
    next(err);
  }
}

export async function verifyCode(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await service.verifyCode(req.body as VerifyCodeDTO));
  } catch (err) {
    next(err);
  }
}
