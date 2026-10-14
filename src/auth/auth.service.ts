import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config.js';
import { ApiError } from '../shared/errors/api-error.error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { OtpRepository } from './otp.repository.js';
import type { MailService } from '../notifications/mail.service.js';
import type { AuthTokenDTO, RequestCodeDTO, VerifyCodeDTO } from './auth.dto.js';

const MAX_ATTEMPTS = 5;

export class AuthService {
  constructor(
    private users: UserRepository,
    private otps: OtpRepository,
    private mail: MailService,
  ) {}

  private generateCode(): string {
    const len = env.OTP_LENGTH;
    const max = 10 ** len;
    return String(Math.floor(Math.random() * max)).padStart(len, '0');
  }

  async requestCode(dto: RequestCodeDTO): Promise<void> {
    const user = await this.users.findOrCreate(dto.email);
    await this.otps.invalidatePrevious(user.id);
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);
    await this.otps.create(user.id, codeHash, expiresAt);
    await this.mail.send(
      user.email,
      'Tu código de acceso',
      `<p>Tu código es: <strong>${code}</strong>. Expira en ${env.OTP_TTL_MINUTES} minutos.</p>`,
    );
  }

  async verifyCode(dto: VerifyCodeDTO): Promise<AuthTokenDTO> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw ApiError.unauthorized('Invalid code');
    const otp = await this.otps.findLatestValid(user.id);
    if (!otp) throw ApiError.unauthorized('Invalid or expired code');
    if (otp.attempts >= MAX_ATTEMPTS) throw ApiError.tooMany('Too many attempts');
    const ok = await bcrypt.compare(dto.code, otp.codeHash);
    if (!ok) {
      await this.otps.incrementAttempts(otp.id);
      throw ApiError.unauthorized('Invalid code');
    }
    await this.otps.consume(otp.id);
    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn'],
    });
    return { token };
  }
}
