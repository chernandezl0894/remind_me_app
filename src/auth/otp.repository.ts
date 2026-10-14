import { prisma } from '../config/db.config.js';

export interface OtpRecord {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

export interface OtpRepository {
  create(userId: string, codeHash: string, expiresAt: Date): Promise<OtpRecord>;
  findLatestValid(userId: string, now?: Date): Promise<OtpRecord | null>;
  consume(id: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  invalidatePrevious(userId: string): Promise<void>;
}

export class PrismaOtpRepository implements OtpRepository {
  async create(userId: string, codeHash: string, expiresAt: Date) {
    return prisma.otpCode.create({ data: { userId, codeHash, expiresAt } });
  }
  async findLatestValid(userId: string, now = new Date()) {
    return prisma.otpCode.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async consume(id: string) {
    await prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }
  async incrementAttempts(id: string) {
    await prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }
  async invalidatePrevious(userId: string) {
    await prisma.otpCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
