
import {
  InstitutionRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';

import { prisma } from '../db/prisma';

const MAX_TRANSACTION_RETRIES = 3;
const TRANSACTION_MAX_WAIT_MS = 15000;
const TRANSACTION_TIMEOUT_MS = 30000;

/**
 * Memeriksa apakah error transaksi Prisma dapat dicoba ulang.
 *
 * P2034: Transaction failed due to a write conflict
 * or a deadlock.
 */
function isRetryableTransactionError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error
  ) {
    return (error as { code?: string }).code === 'P2034';
  }

  return false;
}

/**
 * Menjalankan operasi yang memengaruhi invariant Super Admin
 * dalam transaksi SERIALIZABLE.
 *
 * Semua pemeriksaan dan perubahan terkait Super Admin harus
 * menggunakan transaction client (tx) yang sama.
 *
 * Retry hanya dilakukan untuk konflik transaksi P2034.
 */
export async function withSuperAdminGuard<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_RETRIES;
    attempt++
  ) {
    try {
      return await prisma.$transaction(
        async (tx) => operation(tx),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        }
      );
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_RETRIES
      ) {
        throw error;
      }

      console.warn(
        `[SUPER_ADMIN_GUARD] Konflik transaksi. Percobaan ${attempt}/${MAX_TRANSACTION_RETRIES}.`
      );
    }
  }

  throw new Error(
    'SUPER_ADMIN_TRANSACTION_FAILED: Transaksi keamanan Super Admin gagal.'
  );
}

/**
 * Memastikan operasi tidak menghilangkan Super Admin aktif terakhir.
 *
 * Kriteria Super Admin aktif:
 * - Membership role = SUPER_ADMIN
 * - Membership status = ACTIVE
 * - User isActive = true
 *
 * Penghitungan dilakukan berdasarkan pengguna unik,
 * bukan jumlah baris membership.
 *
 * Fungsi ini wajib dipanggil di dalam withSuperAdminGuard()
 * menggunakan transaction client yang sama.
 */
export async function assertSuperAdminInvariant(
  tx: Prisma.TransactionClient,
  params: {
    targetUserId: string;
    institutionId?: string;
    newRole?: InstitutionRole;
    newStatus?: MembershipStatus;
    newUserActiveStatus?: boolean;
  }
): Promise<void> {
  const activeSuperMems =
    await tx.institutionMembership.findMany({
      where: {
        role: InstitutionRole.SUPER_ADMIN,
        status: MembershipStatus.ACTIVE,
        user: {
          isActive: true,
        },
      },
      select: {
        userId: true,
        institutionId: true,
      },
    });

  const activeSuperAdminUserIds = new Set(
    activeSuperMems.map(
      (membership) => membership.userId
    )
  );

  const isTargetSuperAdmin =
    activeSuperAdminUserIds.has(params.targetUserId);

  if (!isTargetSuperAdmin) {
    return;
  }

  const isDeactivatingUser =
    params.newUserActiveStatus === false;

  const isRevokingMembership =
    params.institutionId !== undefined &&
    activeSuperMems.some(
      (membership) =>
        membership.userId === params.targetUserId &&
        membership.institutionId === params.institutionId
    ) &&
    (
      (
        params.newRole !== undefined &&
        params.newRole !== InstitutionRole.SUPER_ADMIN
      ) ||
      (
        params.newStatus !== undefined &&
        params.newStatus !== MembershipStatus.ACTIVE
      )
    );

  if (!isDeactivatingUser && !isRevokingMembership) {
    return;
  }

  // Jika satu membership dicabut, periksa apakah pengguna
  // masih mempunyai membership SUPER_ADMIN aktif lainnya.
  const hasOtherActiveSuperAdminMembership =
    params.institutionId !== undefined &&
    activeSuperMems.some(
      (membership) =>
        membership.userId === params.targetUserId &&
        membership.institutionId !== params.institutionId
    );

  // Menonaktifkan akun menghilangkan seluruh hak akses
  // Super Admin pengguna tersebut, termasuk membership lain.
  if (
    isRevokingMembership &&
    hasOtherActiveSuperAdminMembership &&
    !isDeactivatingUser
  ) {
    return;
  }

  // Jangan sampai seluruh platform kehilangan Super Admin aktif.
  if (activeSuperAdminUserIds.size <= 1) {
    throw new Error(
      'SECURITY_VIOLATION: Operasi ditolak karena akan menghilangkan Super Admin aktif terakhir.'
    );
  }
}
