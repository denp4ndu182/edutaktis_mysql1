import { prisma } from '../db/prisma';
import { PasswordResetToken } from '@prisma/client';

export class PasswordResetRepository {
  private memTokens: Map<string, PasswordResetToken> = new Map();

  private get isDbConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  async createToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    if (!this.isDbConfigured) {
      const token: PasswordResetToken = {
        id: `rst_mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      this.memTokens.set(data.tokenHash, token);
      return token;
    }

    return prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findValidToken(tokenHash: string): Promise<PasswordResetToken | null> {
    if (!this.isDbConfigured) {
      const record = this.memTokens.get(tokenHash);
      if (!record) return null;
      if (record.usedAt) return null;
      if (new Date() > record.expiresAt) return null;
      return record;
    }

    try {
      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!record) return null;
      if (record.usedAt) return null;
      if (new Date() > record.expiresAt) return null;

      return record;
    } catch {
      return null;
    }
  }

  async markTokenUsed(id: string): Promise<void> {
    if (!this.isDbConfigured) {
      for (const token of this.memTokens.values()) {
        if (token.id === id) {
          token.usedAt = new Date();
          break;
        }
      }
      return;
    }

    try {
      await prisma.passwordResetToken.update({
        where: { id },
        data: { usedAt: new Date() },
      });
    } catch {
      // Non-blocking
    }
  }

  async cleanupExpiredTokens(retentionDays = 7): Promise<number> {
    if (!this.isDbConfigured) {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      let count = 0;
      for (const [hash, token] of this.memTokens.entries()) {
        if (token.expiresAt < cutoff || (token.usedAt && token.usedAt < cutoff)) {
          this.memTokens.delete(hash);
          count++;
        }
      }
      return count;
    }

    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const res = await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoff } },
            { usedAt: { not: null, lt: cutoff } },
          ],
        },
      });
      return res.count;
    } catch {
      return 0;
    }
  }
}

export const passwordResetRepository = new PasswordResetRepository();
