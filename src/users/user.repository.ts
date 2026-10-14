import { prisma } from '../config/db.config.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findOrCreate(email: string): Promise<UserRecord>;
}

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }
  async findOrCreate(email: string) {
    const normalized = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) return existing;
    return prisma.user.create({ data: { email: normalized } });
  }
}
