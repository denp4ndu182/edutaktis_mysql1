import { prisma } from '../db/prisma';
import { AuditLog } from '@prisma/client';

export class AuditLogRepository {
  async logAction(params: {
    userId?: string;
    institutionId?: string;
    action: string;
    resource: string;
    details?: any;
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
          details: params.details || {},
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
    return prisma.auditLog.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listByUser(userId: string, limit = 50): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listLogs(params: { limit?: number; offset?: number; action?: string } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const where = params.action ? { action: params.action } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export const auditLogRepository = new AuditLogRepository();

