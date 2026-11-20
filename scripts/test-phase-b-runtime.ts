import fs from 'node:fs';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';

const config = dotenv.parse(fs.readFileSync('.env.onboarding-test'));

if (config.MYSQL_DATABASE !== 'edutaktis_onboarding_test') {
  throw new Error('ABORT: Database bukan database pengujian.');
}

const credentials =
  `${encodeURIComponent(config.MYSQL_USER)}:${encodeURIComponent(config.MYSQL_PASSWORD)}`;

process.env.DATABASE_URL =
  `mysql://${credentials}@127.0.0.1:3307/${config.MYSQL_DATABASE}`;

process.env.NODE_ENV = 'test';

const { prisma } = await import('../src/db/prisma');
const { platformAdminService } =
  await import('../src/services/platformAdminService');
const { authService } =
  await import('../src/security/authService');
const { auditLogRepository } =
  await import('../src/repositories/auditLogRepository');

const {
  InstitutionRole,
  MembershipStatus,
} = await import('@prisma/client');

const suffix = randomUUID();
const MARKER_IP = `phase-b-${suffix}`;

let tempTargetId: string | undefined;
let tempInactiveActorId: string | undefined;
let tempTargetMembershipId: string | undefined;
let tempInactiveMembershipId: string | undefined;
let institutionIdForRestore: string | undefined;
let originalInstitutionNamaSingkat: string | undefined;
let databaseIdentityVerified = false;

let passed = 0;
let failed = 0;

function report(name: string, success: boolean, detail = '') {
  if (success) {
    passed++;
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectRejected(
  name: string,
  operation: () => Promise<unknown>,
  expectedText: string
) {
  try {
    await operation();
    report(name, false, 'Operasi seharusnya ditolak.');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    report(name, message.includes(expectedText), message);
  }
}

try {
  const identity = await prisma.$queryRaw<
    Array<{ db: string; port: bigint }>
  >`SELECT DATABASE() AS db, @@port AS port`;

  if (
    identity[0]?.db !== 'edutaktis_onboarding_test' ||
    Number(identity[0]?.port) !== 3306
  ) {
    throw new Error('ABORT: Identitas koneksi database tidak cocok.');
  }

  databaseIdentityVerified = true;

  const superAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: 'superadmin@onboarding.test' },
    include: { memberships: true },
  });

  const schoolAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: 'schooladmin@onboarding.test' },
    include: { memberships: true },
  });

  const institutionId = superAdmin.memberships.find(
    (m) =>
      m.role === InstitutionRole.SUPER_ADMIN &&
      m.status === MembershipStatus.ACTIVE
  )?.institutionId;

  if (!institutionId) {
    throw new Error('ABORT: Membership SUPER_ADMIN aktif tidak ditemukan.');
  }
    // B-02: simpan nilai asli untuk pemulihan fixture.
  const institutionFixture = await prisma.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { namaSingkat: true },
  });

  institutionIdForRestore = institutionId;
  originalInstitutionNamaSingkat = institutionFixture.namaSingkat;

  const schoolMembership = schoolAdmin.memberships.find(
    (m) =>
      m.institutionId === institutionId &&
      m.status === MembershipStatus.ACTIVE
  );

  if (!schoolMembership) {
    throw new Error('ABORT: Membership SCHOOL_ADMIN fixture tidak ditemukan.');
  }

  const activeSuperAdmins = await prisma.institutionMembership.findMany({
    where: {
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
      user: { isActive: true },
    },
    select: { userId: true },
  });

  if (new Set(activeSuperAdmins.map((m) => m.userId)).size !== 1) {
    throw new Error(
      'ABORT: Jumlah SUPER_ADMIN aktif bukan satu. Fixture tidak sesuai.'
    );
  }

  // Dua akun sementara dibuat khusus untuk pengujian.
  const target = await prisma.user.create({
    data: {
      email: `phase-b-target-${suffix}@onboarding.test`,
      namaLengkap: 'Temporary Phase B Target',
      isActive: true,
      emailVerified: true,
    },
  });
  tempTargetId = target.id;

  const targetMembership = await prisma.institutionMembership.create({
    data: {
      userId: target.id,
      institutionId,
      role: InstitutionRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });
  tempTargetMembershipId = targetMembership.id;

  const inactiveActor = await prisma.user.create({
    data: {
      email: `phase-b-inactive-${suffix}@onboarding.test`,
      namaLengkap: 'Temporary Phase B Inactive Actor',
      isActive: false,
      emailVerified: true,
    },
  });
  tempInactiveActorId = inactiveActor.id;

  const inactiveMembership = await prisma.institutionMembership.create({
    data: {
      userId: inactiveActor.id,
      institutionId,
      role: InstitutionRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });
  tempInactiveMembershipId = inactiveMembership.id;

  // B-01: platform admin tidak boleh mengubah membership sendiri.
  await expectRejected(
    'B-01 self-membership protection',
    () =>
      platformAdminService.updateMembership(
        superAdmin.id,
        institutionId,
        undefined,
        MembershipStatus.INACTIVE,
        superAdmin.id,
        MARKER_IP
      ),
    'membership sendiri'
  );

  // B-02: kegagalan audit harus membatalkan perubahan membership.
  const originalAuditMethod = auditLogRepository.createInTransaction;

  try {
    auditLogRepository.createInTransaction = async () => {
      throw new Error('PHASE_B_FORCED_AUDIT_FAILURE');
    };

    await expectRejected(
      'B-02 transaction rollback on audit failure',
      () =>
        platformAdminService.updateMembership(
          target.id,
          institutionId,
          InstitutionRole.OPERATOR,
          undefined,
          superAdmin.id,
          MARKER_IP
        ),
      'PHASE_B_FORCED_AUDIT_FAILURE'
    );
  } finally {
    auditLogRepository.createInTransaction = originalAuditMethod;
  }

  const afterRollback = await prisma.institutionMembership.findUniqueOrThrow({
    where: {
      userId_institutionId: {
        userId: target.id,
        institutionId,
      },
    },
  });

  report(
    'B-02 rollback verification',
    afterRollback.role === InstitutionRole.TEACHER,
    `Role setelah rollback: ${afterRollback.role}`
  );

    // B-02: audit gagal harus membatalkan perubahan institusi.
  const rollbackNamaSingkat = `B02-ROLLBACK-${suffix.slice(0, 8)}`;
  const originalAuditForInstitution =
    auditLogRepository.createInTransaction;

  try {
    auditLogRepository.createInTransaction = async () => {
      throw new Error('B02_INSTITUTION_FORCED_AUDIT_FAILURE');
    };

    await expectRejected(
      'B-02 institution update rejected when audit fails',
      () =>
        platformAdminService.updateInstitution(
          institutionId,
          { namaSingkat: rollbackNamaSingkat },
          superAdmin.id,
          MARKER_IP
        ),
      'B02_INSTITUTION_FORCED_AUDIT_FAILURE'
    );
  } finally {
    auditLogRepository.createInTransaction =
      originalAuditForInstitution;
  }

  const institutionAfterRollback =
    await prisma.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: { namaSingkat: true },
    });

  report(
    'B-02 institution update rollback verification',
    institutionAfterRollback.namaSingkat ===
      originalInstitutionNamaSingkat,
    `namaSingkat setelah rollback: ${institutionAfterRollback.namaSingkat}`
  );

  // B-02: update institusi normal harus menghasilkan satu audit.
  const successNamaSingkat = `B02-SUCCESS-${suffix.slice(0, 8)}`;

  const institutionAuditBefore = await prisma.auditLog.count({
    where: {
      ipAddress: MARKER_IP,
      action: 'PLATFORM_INSTITUTION_UPDATED',
      institutionId,
    },
  });

  const updatedInstitution =
    await platformAdminService.updateInstitution(
      institutionId,
      { namaSingkat: successNamaSingkat },
      superAdmin.id,
      MARKER_IP
    );

  const institutionAuditAfter = await prisma.auditLog.count({
    where: {
      ipAddress: MARKER_IP,
      action: 'PLATFORM_INSTITUTION_UPDATED',
      institutionId,
    },
  });

  report(
    'B-02 institution update and audit transaction',
    updatedInstitution.namaSingkat === successNamaSingkat &&
      institutionAuditAfter === institutionAuditBefore + 1,
    `audit bertambah: ${institutionAuditAfter - institutionAuditBefore}`
  );

  // B-03: perubahan membership berhasil dan audit tercatat.
  const auditBeforeB03 = await prisma.auditLog.count({
    where: { ipAddress: MARKER_IP },
  });

  const updatedMembership =
    await platformAdminService.updateMembership(
      target.id,
      institutionId,
      InstitutionRole.OPERATOR,
      undefined,
      superAdmin.id,
      MARKER_IP
    );

  const auditAfterB03 = await prisma.auditLog.findFirst({
    where: {
      ipAddress: MARKER_IP,
      action: 'PLATFORM_MEMBERSHIP_UPDATED',
      userId: superAdmin.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  const auditDetails = auditAfterB03?.details as
    | Record<string, unknown>
    | null;

  report(
    'B-03 membership transaction',
    updatedMembership.role === InstitutionRole.OPERATOR &&
      (await prisma.auditLog.count({
        where: { ipAddress: MARKER_IP },
      })) === auditBeforeB03 + 1
  );

  // B-06: audit harus mencatat nilai before/after yang benar.
  report(
    'B-06 audit before/after consistency',
    auditDetails?.roleBefore === InstitutionRole.TEACHER &&
      auditDetails?.roleAfter === InstitutionRole.OPERATOR &&
      auditDetails?.targetUserId === target.id
  );

  // B-04: perubahan status user berhasil dan audit tercatat.
  const updatedUser = await platformAdminService.updateUserStatus(
    target.id,
    false,
    superAdmin.id,
    MARKER_IP
  );

  const statusAudit = await prisma.auditLog.findFirst({
    where: {
      ipAddress: MARKER_IP,
      action: 'PLATFORM_USER_STATUS_UPDATED',
      userId: superAdmin.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  const statusDetails = statusAudit?.details as
    | Record<string, unknown>
    | null;

  report(
    'B-04 user status transaction',
    updatedUser.isActive === false &&
      statusDetails?.isActiveBefore === true &&
      statusDetails?.isActiveAfter === false
  );

  // B-05: SCHOOL_ADMIN mencoba menurunkan SUPER_ADMIN terakhir.
  await expectRejected(
    'B-05 last active SUPER_ADMIN invariant',
    () =>
      authService.updateMembership({
        callerUserId: schoolAdmin.id,
        targetUserId: superAdmin.id,
        institutionId,
        newRole: InstitutionRole.SCHOOL_ADMIN,
        ipAddress: MARKER_IP,
      }).then((result) => {
        if (!result.success) {
          throw new Error(result.error || 'Membership update rejected.');
        }
      }),
    'Super Admin aktif terakhir'
  );

  const superAdminAfterB05 = await prisma.user.findUniqueOrThrow({
    where: { id: superAdmin.id },
    include: { memberships: true },
  });

  report(
    'B-05 fixture remains protected',
    superAdminAfterB05.isActive &&
      superAdminAfterB05.memberships.some(
        (m) =>
          m.institutionId === institutionId &&
          m.role === InstitutionRole.SUPER_ADMIN &&
          m.status === MembershipStatus.ACTIVE
      )
  );

  // B-07: akun tidak aktif tidak boleh menjadi aktor.
  const inactiveResult = await authService.updateMembership({
    callerUserId: inactiveActor.id,
    targetUserId: target.id,
    institutionId,
    newRole: InstitutionRole.TEACHER,
    ipAddress: MARKER_IP,
  });

  report(
    'B-07 inactive actor rejected',
    inactiveResult.success === false &&
      inactiveResult.error?.includes('tidak aktif') === true,
    inactiveResult.error || ''
  );

} catch (error) {
  failed++;
  console.error(
    'FATAL TEST ERROR:',
    error instanceof Error ? error.message : error
  );
} finally {
  // Pemulihan hanya menyentuh data dengan ID yang dibuat runner ini.
 if (databaseIdentityVerified) {
  try {
    if (
      institutionIdForRestore &&
      originalInstitutionNamaSingkat !== undefined
    ) {
      await prisma.institution.update({
        where: { id: institutionIdForRestore },
        data: {
          namaSingkat: originalInstitutionNamaSingkat,
        },
      });

      console.log('CLEANUP: Institution fixture restored.');
    }

    await prisma.auditLog.deleteMany({
      where: { ipAddress: MARKER_IP },
    });

      console.log('CLEANUP: Temporary fixture cleanup completed.');
    } catch (cleanupError) {
      failed++;
      console.error(
        'CRITICAL CLEANUP ERROR:',
        cleanupError instanceof Error
          ? cleanupError.message
          : cleanupError
      );
    }
  } else {
    console.error('CLEANUP SKIPPED: Database identity was not verified.');
  }

  await prisma.$disconnect();

  console.log(`\nPHASE B RESULT: ${passed} PASSED, ${failed} FAILED`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}
