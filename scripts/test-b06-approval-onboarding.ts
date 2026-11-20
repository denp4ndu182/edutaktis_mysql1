import { randomInt, randomUUID } from 'node:crypto';
import {
  InstitutionRole,
  MembershipStatus,
  InstitutionRequestStatus,
} from '@prisma/client';

const PREFIX = `B06-${Date.now()}-${randomUUID().slice(0, 8)}`;
const createdUserIds: string[] = [];
const createdInstitutionIds: string[] = [];
const createdRequestIds: string[] = [];
const createdMembershipIds: string[] = [];

let passed = 0;
let failed = 0;
let prisma: any;
let fixtureReady = false;

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed++;
  console.log(`PASS ${passed}: ${message}`);
}

async function expectError(
  callback: () => Promise<unknown>,
  expected: string,
  message: string
): Promise<void> {
  let actual = "";
  try {
    await callback();
  } catch (error) {
    actual = error instanceof Error ? error.message : String(error);
  }
  if (!actual) throw new Error(`FAIL: ${message} — tidak ada error ${expected}`);
  if (!actual.includes(expected)) {
    throw new Error(`FAIL: ${message} — menerima ${actual}, mengharapkan ${expected}`);
  }
  assert(true, message);
}

const generatedNpsn = new Set<string>();

function npsn(_index: number): string {
  let candidate: string;

  do {
    candidate = randomInt(0, 10_000_000_000_000)
      .toString()
      .padStart(13, '0');
  } while (generatedNpsn.has(candidate));

  generatedNpsn.add(candidate);
  return candidate;
}

async function createUser(label: string, isActive = true): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}-${label}@b06.invalid`,
      namaLengkap: `B06 Test ${label}`,
      isActive,
      emailVerified: true,
    },
    select: { id: true },
  });

  createdUserIds.push(user.id);
  return user.id;
}

async function createInstitution(label: string): Promise<string> {
  const institution = await prisma.institution.create({
    data: {
      npsn: npsn(createdInstitutionIds.length + 1),
      namaResmi: `B06 Test Institution ${label}`,
      namaSingkat: `B06 ${label}`,
      jenjang: 'MA',
      jenisInstitusi: 'NEGERI',
      kementerianDinas: 'Kementerian Agama',
      alamatLengkap: 'Alamat pengujian B06',
      kabupatenKota: 'Gunungkidul',
      provinsi: 'DI Yogyakarta',
    },
    select: { id: true },
  });

  createdInstitutionIds.push(institution.id);
  return institution.id;
}

async function createMembership(
  userId: string,
  institutionId: string,
  role: InstitutionRole,
  status: MembershipStatus
): Promise<{ id: string }> {
  const membership = await prisma.institutionMembership.create({
    data: { userId, institutionId, role, status },
    select: { id: true },
  });

  createdMembershipIds.push(membership.id);
  return membership;
}

async function createRequest(
  requesterUserId: string,
  index: number
): Promise<{ id: string; npsn: string }> {
  const requestNpsn = npsn(100 + index);

  const request = await prisma.institutionRequest.create({
    data: {
      requesterUserId,
      npsn: requestNpsn,
      namaResmi: `B06 Request Institution ${index}`,
      namaSingkat: `B06 Request ${index}`,
      jenjang: 'MA',
      jenisInstitusi: 'NEGERI',
      kementerianDinas: 'Kementerian Agama',
      alamatLengkap: 'Alamat pengujian onboarding B06',
      kabupatenKota: 'Gunungkidul',
      provinsi: 'DI Yogyakarta',
      status: InstitutionRequestStatus.PENDING_REVIEW,
    },
    select: { id: true, npsn: true },
  });

  createdRequestIds.push(request.id);
  return request;
}

async function cleanup(): Promise<void> {
  if (!prisma || !fixtureReady) return;

  console.log('\n=== B06 FIXTURE CLEANUP ===');

  const cleanupErrors: Array<{ step: string; error: unknown }> = [];

  async function runCleanupStep(
    step: string,
    operation: () => Promise<unknown>
  ): Promise<void> {
    try {
      const result = await operation();
      console.log(`CLEANUP PASS: ${step}`, result);
    } catch (error) {
      cleanupErrors.push({ step, error });
      console.error(`CLEANUP FAIL: ${step}`, error);
    }
  }

  // Audit dihapus lebih dahulu agar tidak meninggalkan relasi fixture.
  if (createdUserIds.length || createdInstitutionIds.length) {
    await runCleanupStep('audit logs', () =>
      prisma.auditLog.deleteMany({
        where: {
          OR: [
            ...(createdUserIds.length
              ? [{ userId: { in: createdUserIds } }]
              : []),
            ...(createdInstitutionIds.length
              ? [{ institutionId: { in: createdInstitutionIds } }]
              : []),
          ],
        },
      })
    );
  }

  if (createdRequestIds.length) {
    await runCleanupStep('institution requests', () =>
      prisma.institutionRequest.deleteMany({
        where: { id: { in: createdRequestIds } },
      })
    );
  }

  const membershipCleanupConditions = [
    ...(createdMembershipIds.length
      ? [{ id: { in: createdMembershipIds } }]
      : []),
    ...(createdUserIds.length
      ? [{ userId: { in: createdUserIds } }]
      : []),
    ...(createdInstitutionIds.length
      ? [{ institutionId: { in: createdInstitutionIds } }]
      : []),
  ];

  if (membershipCleanupConditions.length) {
    await runCleanupStep('institution memberships', () =>
      prisma.institutionMembership.deleteMany({
        where: { OR: membershipCleanupConditions },
      })
    );
  }

  if (createdInstitutionIds.length) {
    await runCleanupStep('institutions', () =>
      prisma.institution.deleteMany({
        where: { id: { in: createdInstitutionIds } },
      })
    );
  }

  if (createdUserIds.length) {
    await runCleanupStep('users', () =>
      prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      })
    );
  }

  if (cleanupErrors.length) {
    throw new Error(
      `B06 cleanup gagal pada ${cleanupErrors.length} tahap: ${
        cleanupErrors.map(({ step }) => step).join(', ')
      }`
    );
  }

  console.log('Fixture cleanup selesai.');
}

async function main(): Promise<void> {
  // Import ini memuat .env.onboarding-test dan memverifikasi database.
  const testDb = await import('./onboarding-test-prisma');
  prisma = testDb.prisma;

  const identity = await prisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  if (
    identity[0]?.db !== 'edutaktis_onboarding_test' ||
    Number(identity[0]?.port) !== 3306
  ) {
    throw new Error(
      'STOP: Identitas database tidak sesuai. Tidak ada fixture dibuat.'
    );
  }

  console.log(
    'DATABASE VERIFIED:',
    identity[0].db,
    'internal port:',
    Number(identity[0].port)
  );

  fixtureReady = true;

  // Service baru diimpor setelah database test terverifikasi.
  const { membershipApprovalService } =
    await import('../src/services/membershipApprovalService');
  const { institutionOnboardingService } =
    await import('../src/services/institutionOnboardingService');
  const { auditLogRepository } =
    await import('../src/repositories/auditLogRepository');

  // Seluruh fixture dibuat dengan ID dan identitas unik.
  const institutionA = await createInstitution('A');
  const institutionB = await createInstitution('B');

  const schoolAdmin = await createUser('school-admin');
  const teacher = await createUser('teacher');
  const platformAdmin = await createUser('platform-admin');
  const inactiveAdmin = await createUser('inactive-admin', false);
  const otherTenantAdmin = await createUser('other-tenant-admin');

  await createMembership(
    schoolAdmin, institutionA,
    InstitutionRole.SCHOOL_ADMIN, MembershipStatus.ACTIVE
  );

  await createMembership(
    teacher, institutionA,
    InstitutionRole.TEACHER, MembershipStatus.ACTIVE
  );

  await createMembership(
    platformAdmin, institutionA,
    InstitutionRole.SUPER_ADMIN, MembershipStatus.ACTIVE
  );

  await createMembership(
    inactiveAdmin, institutionA,
    InstitutionRole.SUPER_ADMIN, MembershipStatus.ACTIVE
  );

  await createMembership(
    otherTenantAdmin, institutionB,
    InstitutionRole.SCHOOL_ADMIN, MembershipStatus.ACTIVE
  );

  const applicantApprove = await createUser('applicant-approve');
  const applicantReject = await createUser('applicant-reject');

  const pendingApprove = await createMembership(
    applicantApprove, institutionA,
    InstitutionRole.TEACHER, MembershipStatus.PENDING
  );

  const pendingReject = await createMembership(
    applicantReject, institutionA,
    InstitutionRole.TEACHER, MembershipStatus.PENDING
  );


  console.log('\n=== B06 MEMBERSHIP APPROVAL TESTS ===');

  const pendingList = await membershipApprovalService.listPending({
    institutionId: institutionA,
    actorUserId: schoolAdmin,
  });

  assert(
    pendingList.length === 2,
    'Reviewer SCHOOL_ADMIN dapat melihat dua permintaan pending tenant sendiri'
  );

  await expectError(
    () => membershipApprovalService.listPending({
      institutionId: institutionA,
      actorUserId: teacher,
    }),
    'REVIEWER_NOT_AUTHORIZED',
    'TEACHER tidak boleh melihat daftar permintaan membership'
  );

  await expectError(
    () => membershipApprovalService.listPending({
      institutionId: institutionA,
      actorUserId: otherTenantAdmin,
    }),
    'REVIEWER_MEMBERSHIP_NOT_ACTIVE',
    'Admin tenant lain tidak boleh melihat daftar tenant ini'
  );

  await expectError(
    () => membershipApprovalService.listPending({
      institutionId: institutionA,
      actorUserId: inactiveAdmin,
    }),
    'REVIEWER_NOT_ACTIVE',
    'User nonaktif tidak boleh melihat daftar permintaan'
  );

  const approvedMembership = await membershipApprovalService.approve({
    membershipId: pendingApprove.id,
    institutionId: institutionA,
    actorUserId: schoolAdmin,
  });

  assert(
    approvedMembership.status === MembershipStatus.ACTIVE,
    'Persetujuan membership mengubah PENDING menjadi ACTIVE'
  );

  assert(
    approvedMembership.role === InstitutionRole.TEACHER,
    'Persetujuan membership mempertahankan role pemohon'
  );

  const rejectedMembership = await membershipApprovalService.reject({
    membershipId: pendingReject.id,
    institutionId: institutionA,
    actorUserId: schoolAdmin,
    reason: 'B06 test rejection',
  });

  assert(
    rejectedMembership.status === MembershipStatus.INACTIVE,
    'Penolakan membership mengubah PENDING menjadi INACTIVE'
  );

  await expectError(
    () => membershipApprovalService.approve({
      membershipId: pendingApprove.id,
      institutionId: institutionA,
      actorUserId: schoolAdmin,
    }),
    'MEMBERSHIP_REQUEST_STATE_CONFLICT',
    'Membership yang sudah diproses tidak dapat disetujui ulang'
  );

  const membershipAuditCount = await prisma.auditLog.count({
    where: {
      institutionId: institutionA,
      userId: schoolAdmin,
      action: {
        in: [
          'MEMBERSHIP_REQUEST_APPROVED',
          'MEMBERSHIP_REQUEST_REJECTED',
        ],
      },
    },
  });

  assert(
    membershipAuditCount === 2,
    'Persetujuan dan penolakan membership menghasilkan dua audit log'
  );

  console.log('\n=== B06 INSTITUTION ONBOARDING TESTS ===');

  const requesterApprove = await createUser('requester-approve');
  const requesterReject = await createUser('requester-reject');
  const requesterUnauthorized = await createUser('requester-unauthorized');
  const requesterRollback = await createUser('requester-rollback');

  const requestApprove = await createRequest(requesterApprove, 1);
  const requestReject = await createRequest(requesterReject, 2);
  const requestUnauthorized = await createRequest(
    requesterUnauthorized, 3
  );
  const requestRollback = await createRequest(requesterRollback, 4);

  await expectError(
    () => institutionOnboardingService.approveRequest({
      requestId: requestUnauthorized.id,
      reviewerUserId: teacher,
    }),
    'REVIEWER_NOT_PLATFORM_SUPER_ADMIN',
    'Reviewer TEACHER tidak dapat menyetujui onboarding institusi'
  );

  await expectError(
    () => institutionOnboardingService.approveRequest({
      requestId: requestUnauthorized.id,
      reviewerUserId: inactiveAdmin,
    }),
    'REVIEWER_NOT_ACTIVE',
    'Reviewer SUPER_ADMIN yang nonaktif ditolak'
  );

  const approvedRequest =
    await institutionOnboardingService.approveRequest({
      requestId: requestApprove.id,
      reviewerUserId: platformAdmin,
    });

  const createdInstitutionId = approvedRequest.institutionId;

  if (createdInstitutionId) {
    createdInstitutionIds.push(createdInstitutionId);
  }

  assert(
    approvedRequest.status === InstitutionRequestStatus.APPROVED,
    'Onboarding institusi berhasil berubah menjadi APPROVED'
  );

  assert(
    Boolean(createdInstitutionId),
    'Persetujuan onboarding menghasilkan institutionId'
  );

  const schoolAdminMembership =
    await prisma.institutionMembership.findUnique({
      where: {
        userId_institutionId: {
          userId: requesterApprove,
          institutionId: createdInstitutionId,
        },
      },
      select: { role: true, status: true },
    });

  assert(
    schoolAdminMembership?.role === InstitutionRole.SCHOOL_ADMIN &&
    schoolAdminMembership?.status === MembershipStatus.ACTIVE,
    'Pemohon onboarding memperoleh membership SCHOOL_ADMIN ACTIVE'
  );

  const rejectedRequest =
    await institutionOnboardingService.rejectRequest({
      requestId: requestReject.id,
      reviewerUserId: platformAdmin,
      rejectionReason: 'Alasan penolakan pengujian B06',
    });

  assert(
    rejectedRequest.status === InstitutionRequestStatus.REJECTED,
    'Onboarding institusi berhasil berubah menjadi REJECTED'
  );

  assert(
    Boolean(rejectedRequest.rejectionReason),
    'Alasan penolakan tersimpan pada pengajuan'
  );

  await expectError(
    () => institutionOnboardingService.rejectRequest({
      requestId: requestReject.id,
      reviewerUserId: platformAdmin,
      rejectionReason: 'Percobaan kedua',
    }),
    'INSTITUTION_REQUEST_NOT_PENDING',
    'Pengajuan yang sudah ditolak tidak dapat diproses ulang'
  );

  const onboardingAudit = await prisma.auditLog.findMany({
    where: {
      userId: platformAdmin,
      action: {
        in: [
          'INSTITUTION_REQUEST_APPROVED',
          'INSTITUTION_REQUEST_REJECTED',
        ],
      },
    },
    select: { action: true },
  });

  assert(
    onboardingAudit.some(
      (entry: { action: string }) =>
        entry.action === 'INSTITUTION_REQUEST_APPROVED'
    ),
    'Persetujuan onboarding menghasilkan audit log'
  );

  assert(
    onboardingAudit.some(
      (entry: { action: string }) =>
        entry.action === 'INSTITUTION_REQUEST_REJECTED'
    ),
    'Penolakan onboarding menghasilkan audit log'
  );

  console.log('\n=== B06 TRANSACTION ROLLBACK TEST ===');

  const auditCountBefore = await prisma.auditLog.count({
    where: { userId: platformAdmin },
  });

  const originalCreate = auditLogRepository.createInTransaction;

  try {
    auditLogRepository.createInTransaction = async () => {
      throw new Error('B06_FORCED_AUDIT_FAILURE');
    };

    await expectError(
      () => institutionOnboardingService.approveRequest({
        requestId: requestRollback.id,
        reviewerUserId: platformAdmin,
      }),
      'B06_FORCED_AUDIT_FAILURE',
      'Kegagalan audit yang disengaja membatalkan transaksi'
    );
  } finally {
    auditLogRepository.createInTransaction = originalCreate;
  }

  const rollbackRequest =
    await prisma.institutionRequest.findUnique({
      where: { id: requestRollback.id },
      select: { status: true, institutionId: true },
    });

  assert(
    rollbackRequest?.status === InstitutionRequestStatus.PENDING_REVIEW &&
    rollbackRequest.institutionId === null,
    'Rollback mempertahankan request pada PENDING_REVIEW tanpa institutionId'
  );

  const rollbackInstitution = await prisma.institution.findUnique({
    where: { npsn: requestRollback.npsn },
    select: { id: true },
  });

  assert(
    rollbackInstitution === null,
    'Rollback menghapus efek pembuatan institusi'
  );

  const rollbackMembership = await prisma.institutionMembership.findFirst({
    where: { userId: requesterRollback },
    select: { id: true },
  });

  assert(
    rollbackMembership === null,
    'Rollback menghapus efek pembuatan membership'
  );

  const auditCountAfter = await prisma.auditLog.count({
    where: { userId: platformAdmin },
  });

  assert(
    auditCountAfter === auditCountBefore,
    'Rollback tidak meninggalkan audit log parsial'
  );
}

try {
  await main();
} catch (error) {
  failed++;
  console.error('\nB06 TEST ERROR:', error);
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    failed++;
    console.error(
      'CLEANUP ERROR — fixture mungkin masih tersisa:',
      cleanupError
    );
  }

  if (prisma) {
    await prisma.$disconnect();
  }

  console.log('\n=== B06 TEST SUMMARY ===');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}
