import { prisma } from '../db/prisma';
import { UserSession } from '@prisma/client';

export class SessionRepository {
  private get isDbConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  /**
   * Create a new session in database.
   */
  async createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSession> {
    if (!this.isDbConfigured) {
      return {
        id: `sess_mem_${Date.now()}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revokedAt: null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      };
    }

    return prisma.userSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Finds an active, non-revoked, non-expired session by token hash.
   */
  async findValidSession(tokenHash: string): Promise<
    (UserSession & {
      user: {
        id: string;
        email: string;
        namaLengkap: string;
        gelarDepan: string | null;
        gelarBelakang: string | null;
        nip: string | null;
        nuptk: string | null;
        isActive: boolean;
        fotoProfilUrl: string | null;
      };
    }) | null
  > {
    if (!this.isDbConfigured) return null;

    try {
      const session = await prisma.userSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              namaLengkap: true,
              gelarDepan: true,
              gelarBelakang: true,
              nip: true,
              nuptk: true,
              isActive: true,
              fotoProfilUrl: true,
            },
          },
        },
      });

      if (!session) return null;
      if (session.revokedAt) return null;
      if (new Date() > session.expiresAt) return null;
      if (!session.user.isActive) return null;

      return session;
    } catch (err) {
      return null;
    }
  }

  /**
   * Updates lastUsedAt timestamp.
   */
  async updateLastUsed(id: string): Promise<void> {
    if (!this.isDbConfigured) return;
    try {
      await prisma.userSession.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Non-blocking update failure
    }
  }

  /**
   * Revoke a specific session by token hash.
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    if (!this.isDbConfigured) return;
    try {
      await prisma.userSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Revoke all sessions for a user (logout all devices).
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    if (!this.isDbConfigured) return 0;
    try {
      const res = await prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return res.count;
    } catch {
      return 0;
    }
  }

  /**
   * List active sessions for user.
   */
  async listActiveSessions(userId: string): Promise<UserSession[]> {
    if (!this.isDbConfigured) return [];
    try {
      return await prisma.userSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastUsedAt: 'desc' },
      });
    } catch {
      return [];
    }
  }

  /**
   * Cleans up expired or revoked sessions older than 30 days to prevent table bloat.
   */
  async cleanupExpiredSessions(retentionDays = 30): Promise<number> {
    if (!this.isDbConfigured) return 0;
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const res = await prisma.userSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoff } },
            { revokedAt: { not: null, lt: cutoff } },
          ],
        },
      });
      return res.count;
    } catch {
      return 0;
    }
  }
}

export const sessionRepository = new SessionRepository();
