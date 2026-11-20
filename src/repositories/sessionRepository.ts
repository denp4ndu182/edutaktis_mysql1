import { prisma } from '../db/prisma';
import { UserSession } from '@prisma/client';

export class SessionRepository {
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
   * Returns null only when the session is genuinely invalid or absent.
   * Database errors are propagated to the caller.
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
  }

  /**
   * Updates lastUsedAt timestamp.
   * Best-effort operation: failures are logged, not silently discarded.
   */
  async updateLastUsed(id: string): Promise<void> {
    try {
      await prisma.userSession.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch (err) {
      console.error('Session last-used update failed:', err);
    }
  }

  /**
   * Revoke a specific session by token hash.
   * Database errors are propagated to the caller.
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await prisma.userSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user (logout all devices).
   * Database errors are propagated to the caller.
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return res.count;
  }

  /**
   * List active sessions for user.
   * Database errors are propagated to the caller.
   */
  async listActiveSessions(userId: string): Promise<UserSession[]> {
    return prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Cleans up expired or revoked sessions older than 30 days.
   * Database errors are propagated to the caller.
   */
  async cleanupExpiredSessions(retentionDays = 30): Promise<number> {
    if (!Number.isFinite(retentionDays) || retentionDays < 0) {
      throw new Error('retentionDays must be a non-negative finite number.');
    }

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
  }
}

export const sessionRepository = new SessionRepository();
