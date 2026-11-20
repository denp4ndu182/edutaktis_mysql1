import { prisma } from '../db/prisma';
import { AuditLog, Prisma } from '@prisma/client';

export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[DEPTH_LIMIT]';

  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) =>
      sanitizeAuditDetails(item, depth + 1)
    );
  }

  if (typeof value === 'object') {
    const sensitiveKey =
      /(password|passwd|passphrase|pwd|token|secret|cookie|authorization|hash|session|user.?agent|email|phone|telepon|nip|nuptk|api.?key|access.?key|private.?key|client.?secret|credential|bearer|jwt|signature|salt|verification.?code|otp)/i;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKey.test(key))
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          sanitizeAuditDetails(item, depth + 1),
        ])
    );
  }

  return undefined;
}

export class AuditLogRepository {
  async createInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      userId?: string;
      institutionId?: string;
      action: string;
      resource: string;
      details?: unknown;
      ipAddress?: string;
    }
  ): Promise<AuditLog> {
    const safeDetails = sanitizeAuditDetails(params.details ?? {}) as Prisma.InputJsonValue;

    return tx.auditLog.create({
      data: {
        action: params.action,
        resource: params.resource,
        details: safeDetails,
        ipAddress: params.ipAddress,
        ...(params.userId
          ? { user: { connect: { id: params.userId } } }
          : {}),
        ...(params.institutionId
          ? { institution: { connect: { id: params.institutionId } } }
          : {}),
      },
    });
  }


  async logAction(params: {
    userId?: string;
    institutionId?: string;
    action: string;
    resource: string;
    details?: unknown;
    ipAddress?: string;
  }): Promise<AuditLog | null> {
    if (!process.env.DATABASE_URL) {
      return null;
    }
    try {
      return await prisma.auditLog.create({
        data: {
          action: params.action,
          resource: params.resource,
          details: sanitizeAuditDetails(params.details ?? {}) as Prisma.InputJsonValue,
          ipAddress: params.ipAddress,
          ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
          ...(params.institutionId
            ? { institution: { connect: { id: params.institutionId } } }
            : {}),
        },
      });
    } catch (e) {
      console.error('Failed creating audit log record:', e);
      return null;
    }
  }

  async listByInstitution(institutionId: string, limit = 50): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      ...log,
      details: sanitizeAuditDetails(log.details) as AuditLog['details'],
    }));
  }

  async listByUser(userId: string, limit = 50): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      ...log,
      details: sanitizeAuditDetails(log.details) as AuditLog['details'],
    }));
  }

  async listLogs(params: { limit?: number; offset?: number; action?: string } = {}): Promise<{
    logs: Array<Pick<AuditLog, 'id' | 'createdAt' | 'action' | 'resource' | 'details' | 'ipAddress'>>;
    total: number;
  }> {
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const where = params.action ? { action: params.action } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          action: true,
          resource: true,
          details: true,
          ipAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const sanitizedLogs = logs.map((log) => ({
      ...log,
      details: sanitizeAuditDetails(log.details) as AuditLog['details'],
    }));

    return { logs: sanitizedLogs, total };
  }
}

export const auditLogRepository = new AuditLogRepository();

