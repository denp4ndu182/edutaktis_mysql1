import { prisma } from '../db/prisma';
import { InstitutionRole, MembershipStatus, Prisma } from '@prisma/client';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { membershipRepository } from '../repositories/membershipRepository';
import { withOnboardingTransaction } from '../security/onboardingTransaction';
import {
  withSuperAdminGuard,
  assertSuperAdminInvariant,
} from '../security/superAdminGuard';

/**
 * Memvalidasi aktor langsung di dalam transaksi administratif.
 * Middleware tetap diperlukan, tetapi service tidak boleh
 * mengandalkan middleware sebagai satu-satunya lapisan otorisasi.
 */
async function assertActivePlatformSuperAdmin(
  tx: Prisma.TransactionClient,
  actorUserId: string
): Promise<void> {
  if (typeof actorUserId !== 'string' || !actorUserId.trim()) {
    throw new Error('Identitas aktor wajib tersedia.');
  }

  const actorMembership = await tx.institutionMembership.findFirst({
    where: {
      userId: actorUserId,
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
      user: {
        isActive: true,
      },
    },
    select: {
      id: true,
    },
  });

  if (!actorMembership) {
    throw new Error(
      'Akses ditolak: aktor bukan Super Admin aktif.'
    );
  }
}

type InstitutionUpdateData = {
  namaResmi?: string;
  namaSingkat?: string;
  jenjang?: string;
  alamatLengkap?: string;
  namaKepala?: string | null;
  nipKepala?: string | null;
  kotaTandaTangan?: string | null;
  telepon?: string | null;
  email?: string | null;
  website?: string | null;
};

export class PlatformAdminService {

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
        select: {
          id: true,
          npsn: true,
          namaResmi: true,
          jenjang: true,
          kabupatenKota: true,
          provinsi: true,
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
    telepon?: string;
    email?: string;
    website?: string;
    initialAdminUserId: string;
    actorUserId: string;
    ipAddress?: string;
  }) {
    const npsn = data.npsn.trim();
    const namaResmi = data.namaResmi.trim();
    const kabupatenKota = data.kabupatenKota.trim();
    const provinsi = data.provinsi.trim();
    const actorUserId = data.actorUserId.trim();
    const initialAdminUserId = data.initialAdminUserId.trim();

    if (!npsn || npsn.length > 20) {
      throw new Error('NPSN wajib diisi dan maksimal 20 karakter.');
    }
    if (!namaResmi || namaResmi.length > 255) {
      throw new Error('Nama resmi institusi wajib diisi dan maksimal 255 karakter.');
    }
    if (!data.jenjang.trim() || data.jenjang.trim().length > 20) {
      throw new Error('Jenjang wajib diisi dan maksimal 20 karakter.');
    }
    if (!kabupatenKota || kabupatenKota.length > 100) {
      throw new Error('Kabupaten/kota wajib diisi dan maksimal 100 karakter.');
    }
    if (!provinsi || provinsi.length > 100) {
      throw new Error('Provinsi wajib diisi dan maksimal 100 karakter.');
    }
    if (!actorUserId || !initialAdminUserId) {
      throw new Error('Aktor dan admin pertama wajib ditentukan.');
    }

    return withOnboardingTransaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { id: true, isActive: true },
      });

      if (!actor || !actor.isActive) {
        throw new Error('PLATFORM_ACTOR_NOT_ACTIVE');
      }

      const superAdminMembership = await tx.institutionMembership.findFirst({
        where: {
          userId: actorUserId,
          role: InstitutionRole.SUPER_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!superAdminMembership) {
        throw new Error('SUPER_ADMIN_REQUIRED');
      }

      const initialAdmin = await tx.user.findUnique({
        where: { id: initialAdminUserId },
        select: { id: true, isActive: true },
      });

      if (!initialAdmin || !initialAdmin.isActive) {
        throw new Error('INITIAL_ADMIN_NOT_ACTIVE');
      }

      const existing = await tx.institution.findUnique({
        where: { npsn },
        select: { id: true },
      });

      if (existing) {
        throw new Error('NPSN_ALREADY_REGISTERED');
      }

      const created = await tx.institution.create({
        data: {
          npsn,
          namaResmi,
          namaSingkat: data.namaSingkat?.trim() || namaResmi,
          jenjang: data.jenjang.trim(),
          jenisInstitusi: data.jenisInstitusi?.trim() || 'Negeri',
          kementerianDinas:
            data.kementerianDinas?.trim() || 'Kementerian Agama',
          alamatLengkap: data.alamatLengkap?.trim() || '-',
          kabupatenKota,
          provinsi,
          namaKepala: data.namaKepala?.trim() || null,
          nipKepala: data.nipKepala?.trim() || null,
          kotaTandaTangan:
            data.kotaTandaTangan?.trim() || kabupatenKota,
          telepon: data.telepon?.trim() || null,
          email: data.email?.trim() || null,
          website: data.website?.trim() || null,
        },
      });

      await membershipRepository.create(
        {
          user: { connect: { id: initialAdminUserId } },
          institution: { connect: { id: created.id } },
          role: InstitutionRole.SCHOOL_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        tx
      );

      await auditLogRepository.createInTransaction(tx, {
        userId: actorUserId,
        institutionId: created.id,
        action: 'PLATFORM_INSTITUTION_CREATED',
        resource: 'Institution',
        details: {
          npsn: created.npsn,
          initialAdminUserId,
          assignedRole: InstitutionRole.SCHOOL_ADMIN,
        },
        ipAddress: data.ipAddress,
      });

      return created;
    });
  }

  async updateInstitution(
    id: string,
    data: InstitutionUpdateData,
    actorUserId: string,
    ipAddress?: string
  ) {
    return withSuperAdminGuard(async (tx) => {
      // 1. Validasi aktor di dalam transaksi
      await assertActivePlatformSuperAdmin(tx, actorUserId);

      // 2. Pastikan institusi tersedia
      const institution = await tx.institution.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!institution) {
        throw new Error('Institusi tidak ditemukan.');
      }

      // 3. Hanya izinkan field yang telah disetujui
      const safeData: InstitutionUpdateData = {
        ...(data.namaResmi !== undefined
          ? { namaResmi: data.namaResmi }
          : {}),
        ...(data.namaSingkat !== undefined
          ? { namaSingkat: data.namaSingkat }
          : {}),
        ...(data.jenjang !== undefined
          ? { jenjang: data.jenjang }
          : {}),
        ...(data.alamatLengkap !== undefined
          ? { alamatLengkap: data.alamatLengkap }
          : {}),
        ...(data.namaKepala !== undefined
          ? { namaKepala: data.namaKepala }
          : {}),
        ...(data.nipKepala !== undefined
          ? { nipKepala: data.nipKepala }
          : {}),
        ...(data.kotaTandaTangan !== undefined
          ? { kotaTandaTangan: data.kotaTandaTangan }
          : {}),
        ...(data.telepon !== undefined
          ? { telepon: data.telepon }
          : {}),
        ...(data.email !== undefined
          ? { email: data.email }
          : {}),
        ...(data.website !== undefined
          ? { website: data.website }
          : {}),
      };

      if (Object.keys(safeData).length === 0) {
        throw new Error(
          'Tidak ada data institusi yang dapat diperbarui.'
        );
      }

      // 4. Update menggunakan transaction client
      const updated = await tx.institution.update({
        where: { id },
        data: safeData,
      });

      // 5. Audit wajib berada dalam transaksi yang sama
      await auditLogRepository.createInTransaction(tx, {
        userId: actorUserId,
        institutionId: id,
        action: 'PLATFORM_INSTITUTION_UPDATED',
        resource: 'Institution',
        details: {
          changedFields: Object.keys(safeData),
        },
        ipAddress,
      });

      return updated;
    });
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
          isActive: true,
          _count: { select: { memberships: true } },
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
    if (typeof actorUserId !== 'string' || !actorUserId.trim()) {
      throw new Error('Identitas aktor wajib tersedia.');
    }

    if (actorUserId === userId && isActive === false) {
      throw new Error(
        'Akses ditolak: Anda tidak dapat menonaktifkan akun sendiri.'
      );
    }

    return withSuperAdminGuard(async (tx) => {
      await assertActivePlatformSuperAdmin(tx, actorUserId);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!user) {
        throw new Error('Pengguna tidak ditemukan.');
      }

      await assertSuperAdminInvariant(tx, {
        targetUserId: userId,
        newUserActiveStatus: isActive,
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          namaLengkap: true,
          nip: true,
          nuptk: true,
          isActive: true,
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      await auditLogRepository.createInTransaction(tx, {
        userId: actorUserId,
        action: 'PLATFORM_USER_STATUS_UPDATED',
        resource: 'User',
        details: {
          targetUserId: userId,
          isActiveBefore: user.isActive,
          isActiveAfter: updated.isActive,
        },
        ipAddress,
      });

      return updated;
    });
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
        select: {
          id: true,
          role: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              namaLengkap: true,
              email: true,
            },
          },
          institution: {
            select: {
              id: true,
              namaResmi: true,
              npsn: true,
            },
          },
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
    newRole: InstitutionRole | undefined,
    newStatus: MembershipStatus | undefined,
    actorUserId: string,
    ipAddress?: string
  ) {
    if (!actorUserId || !actorUserId.trim()) {
      throw new Error('Identitas aktor wajib tersedia untuk perubahan membership.');
    }

    if (actorUserId === userId) {
      throw new Error(
        'Akses ditolak: Anda tidak dapat mengubah membership sendiri.'
      );
    }

    if (newRole === InstitutionRole.SUPER_ADMIN) {
      throw new Error(
        'SECURITY_VIOLATION: Pemberian peran SUPER_ADMIN hanya diperbolehkan melalui prosedur khusus.'
      );
    }

    if (newRole === undefined && newStatus === undefined) {
      throw new Error('Tidak ada perubahan membership yang diminta.');
    }

    return withSuperAdminGuard(async (tx) => {
      await assertActivePlatformSuperAdmin(tx, actorUserId);

      const mem = await tx.institutionMembership.findUnique({
        where: {
          userId_institutionId: {
            userId,
            institutionId,
          },
        },
      });

      if (!mem) {
        throw new Error('Keanggotaan institusi tidak ditemukan.');
      }

      await assertSuperAdminInvariant(tx, {
        targetUserId: userId,
        institutionId,
        newRole,
        newStatus,
      });

      const updated = await tx.institutionMembership.update({
        where: {
          userId_institutionId: {
            userId,
            institutionId,
          },
        },
        data: {
          ...(newRole !== undefined ? { role: newRole } : {}),
          ...(newStatus !== undefined ? { status: newStatus } : {}),
        },
      });

      await auditLogRepository.createInTransaction(tx, {
        userId: actorUserId,
        institutionId,
        action: 'PLATFORM_MEMBERSHIP_UPDATED',
        resource: 'InstitutionMembership',
        details: {
          targetUserId: userId,
          roleBefore: mem.role,
          roleAfter: updated.role,
          statusBefore: mem.status,
          statusAfter: updated.status,
        },
        ipAddress,
      });

      return updated;
    });
  }
}
export const platformAdminService = new PlatformAdminService();
