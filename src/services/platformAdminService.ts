import { prisma } from '../db/prisma';
import { InstitutionRole, MembershipStatus, Prisma } from '@prisma/client';
import { auditLogRepository } from '../repositories/auditLogRepository';

export class PlatformAdminService {
  /**
   * Helper to verify if user is the last active SUPER_ADMIN in the platform.
   */
  private async assertNotLastSuperAdmin(
    targetUserId: string,
    targetInstitutionId?: string,
    newRole?: InstitutionRole,
    newMembershipStatus?: MembershipStatus,
    newUserActiveStatus?: boolean
  ) {
    const activeSuperMems = await prisma.institutionMembership.findMany({
      where: {
        role: InstitutionRole.SUPER_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
      include: { user: true },
    });

    const activeSuperAdmins = activeSuperMems.filter((m) => m.user.isActive);
    const isTargetSuperAdmin = activeSuperAdmins.some((m) => m.userId === targetUserId);

    if (isTargetSuperAdmin && activeSuperAdmins.length <= 1) {
      const isDeactivatingUser = newUserActiveStatus === false;
      const isRevokingMembership = targetInstitutionId && mMatch(targetInstitutionId, targetUserId, activeSuperMems) && (
        (newRole && newRole !== InstitutionRole.SUPER_ADMIN) ||
        (newMembershipStatus && newMembershipStatus !== MembershipStatus.ACTIVE)
      );

      if (isDeactivatingUser || isRevokingMembership) {
        throw new Error('SECURITY_VIOLATION: Tidak dapat menonaktifkan atau mencabut hak akses Super Admin dari satu-satunya Super Admin aktif terakhir.');
      }
    }
  }

  async getPlatformStats() {
    const [totalInstitutions, totalUsers, totalProjects, totalAuditLogs, pendingMemberships] = await Promise.all([
      prisma.institution.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.auditLog.count(),
      prisma.institutionMembership.count({ where: { status: MembershipStatus.PENDING } }),
    ]);

    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const inactiveUsers = await prisma.user.count({ where: { isActive: false } });

    return {
      totalInstitutions,
      activeInstitutions: totalInstitutions,
      totalUsers,
      activeUsers,
      inactiveUsers,
      pendingMemberships,
      totalProjects,
      totalAuditLogs,
    };
  }

  async listInstitutions(params: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const search = params.search?.trim() || '';

    const where: Prisma.InstitutionWhereInput = search
      ? {
          OR: [
            { namaResmi: { contains: search } },
            { namaSingkat: { contains: search } },
            { npsn: { contains: search } },
            { kabupatenKota: { contains: search } },
          ],
        }
      : {};

    const [institutions, total] = await Promise.all([
      prisma.institution.findMany({
        where,
        include: {
          _count: { select: { memberships: true, projects: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.institution.count({ where }),
    ]);

    return { institutions, total, limit, offset };
  }

  async createInstitution(data: {
    npsn: string;
    namaResmi: string;
    namaSingkat?: string;
    jenjang: string;
    jenisInstitusi?: string;
    kementerianDinas?: string;
    alamatLengkap?: string;
    kabupatenKota: string;
    provinsi: string;
    namaKepala?: string;
    nipKepala?: string;
    kotaTandaTangan?: string;
    actorUserId: string;
    ipAddress?: string;
  }) {
    const existing = await prisma.institution.findUnique({ where: { npsn: data.npsn.trim() } });
    if (existing) {
      throw new Error('NPSN sudah terdaftar dalam sistem.');
    }

    const created = await prisma.institution.create({
      data: {
        npsn: data.npsn.trim(),
        namaResmi: data.namaResmi.trim(),
        namaSingkat: data.namaSingkat?.trim() || data.namaResmi.trim(),
        jenjang: data.jenjang.trim(),
        jenisInstitusi: data.jenisInstitusi?.trim() || 'Negeri',
        kementerianDinas: data.kementerianDinas?.trim() || 'Kementerian Agama',
        alamatLengkap: data.alamatLengkap?.trim() || '-',
        kabupatenKota: data.kabupatenKota.trim(),
        provinsi: data.provinsi.trim(),
        namaKepala: data.namaKepala?.trim() || null,
        nipKepala: data.nipKepala?.trim() || null,
        kotaTandaTangan: data.kotaTandaTangan?.trim() || data.kabupatenKota,
      },
    });

    await auditLogRepository.logAction({
      userId: data.actorUserId,
      institutionId: created.id,
      action: 'PLATFORM_INSTITUTION_CREATED',
      resource: 'Institution',
      details: { npsn: created.npsn, namaResmi: created.namaResmi },
      ipAddress: data.ipAddress,
    });

    return created;
  }

  async updateInstitution(
    id: string,
    data: Prisma.InstitutionUpdateInput,
    actorUserId: string,
    ipAddress?: string
  ) {
    const institution = await prisma.institution.findUnique({ where: { id } });
    if (!institution) {
      throw new Error('Institusi tidak ditemukan.');
    }

    const updated = await prisma.institution.update({
      where: { id },
      data,
    });

    await auditLogRepository.logAction({
      userId: actorUserId,
      institutionId: id,
      action: 'PLATFORM_INSTITUTION_UPDATED',
      resource: 'Institution',
      details: { before: institution, after: updated },
      ipAddress,
    });

    return updated;
  }

  async listUsers(params: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);
    const search = params.search?.trim() || '';

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search } },
            { namaLengkap: { contains: search } },
            { nip: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          namaLengkap: true,
          nip: true,
          nuptk: true,
          nomorTelepon: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { memberships: true, projects: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, limit, offset };
  }

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    actorUserId: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    if (!isActive) {
      await this.assertNotLastSuperAdmin(userId, undefined, undefined, undefined, false);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    await auditLogRepository.logAction({
      userId: actorUserId,
      action: 'PLATFORM_USER_STATUS_UPDATED',
      resource: 'User',
      details: { targetUserId: userId, isActiveBefore: user.isActive, isActiveAfter: isActive },
      ipAddress,
    });

    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  async listMemberships(params: { limit?: number; offset?: number; institutionId?: string; role?: InstitutionRole; status?: MembershipStatus }) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    const where: Prisma.InstitutionMembershipWhereInput = {
      ...(params.institutionId ? { institutionId: params.institutionId } : {}),
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [memberships, total] = await Promise.all([
      prisma.institutionMembership.findMany({
        where,
        include: {
          user: { select: { id: true, namaLengkap: true, email: true, nip: true } },
          institution: { select: { id: true, namaResmi: true, namaSingkat: true, npsn: true } },
        },
        orderBy: { joinedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.institutionMembership.count({ where }),
    ]);

    return { memberships, total, limit, offset };
  }

  async updateMembership(
    userId: string,
    institutionId: string,
    newRole?: InstitutionRole,
    newStatus?: MembershipStatus,
    actorUserId?: string,
    ipAddress?: string
  ) {
    const mem = await prisma.institutionMembership.findUnique({
      where: { userId_institutionId: { userId, institutionId } },
    });
    if (!mem) {
      throw new Error('Keanggotaan institusi tidak ditemukan.');
    }

    if (newRole && newRole !== mem.role) {
      // Prevent granting SUPER_ADMIN through standard platform role endpoint unless already super admin
      if (newRole === InstitutionRole.SUPER_ADMIN) {
        throw new Error('SECURITY_VIOLATION: Pemberian peran Super Admin baru dilarang melalui endpoint ini.');
      }
      if (mem.role === InstitutionRole.SUPER_ADMIN) {
        await this.assertNotLastSuperAdmin(userId, institutionId, newRole, newStatus);
      }
    }

    if (newStatus && newStatus !== mem.status && mem.role === InstitutionRole.SUPER_ADMIN) {
      await this.assertNotLastSuperAdmin(userId, institutionId, newRole, newStatus);
    }

    const updated = await prisma.institutionMembership.update({
      where: { userId_institutionId: { userId, institutionId } },
      data: {
        ...(newRole ? { role: newRole } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      },
    });

    if (actorUserId) {
      await auditLogRepository.logAction({
        userId: actorUserId,
        institutionId,
        action: 'PLATFORM_MEMBERSHIP_UPDATED',
        resource: 'InstitutionMembership',
        details: { targetUserId: userId, before: mem, after: updated },
        ipAddress,
      });
    }

    return updated;
  }
}

function mMatch(institutionId: string, userId: string, activeSuperMems: any[]): boolean {
  return activeSuperMems.some((m) => m.userId === userId && m.institutionId === institutionId);
}

export const platformAdminService = new PlatformAdminService();
