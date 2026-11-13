import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { randomInt, randomUUID } from 'node:crypto';
import {
  InstitutionRole,
  MembershipStatus,
  InstitutionRequestStatus,
} from '@prisma/client';
import { hashPassword } from '../src/security/password';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.onboarding-test');
const PREFIX = `B10-${randomUUID()}`;

let prisma: any;
let fixtureReady = false;
let passed = 0;
let failed = 0;

const userIds: string[] = [];
const requestIds: string[] = [];

const fixture: Record<string, any> = {};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    throw new Error(`FAIL: ${message}`);
  }

  passed++;
  console.log(`PASS ${passed}: ${message}`);
}

function requireCondition(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new Error(message);
}

function uniqueNpsn(): string {
  return randomInt(0, 10_000_000_000_000)
    .toString()
    .padStart(13, '0');
}

function errorMessage(error: any): string {
  return String(
    error?.message ??
    error?.code ??
    error ??
    'Unknown error'
  );
}

async function runRace(
  label: string,
  operations: Promise<any>[]
): Promise<{
  fulfilled: any[];
  rejected: any[];
}> {
  const results = await Promise.allSettled(operations);

  const fulfilled = results
    .filter((item): item is PromiseFulfilledResult<any> =>
      item.status === 'fulfilled'
    )
    .map((item) => item.value);

  const rejected = results
    .filter((item): item is PromiseRejectedResult =>
      item.status === 'rejected'
    )
    .map((item) => item.reason);

  console.log(`\n${label}`);
  console.log(`  Berhasil: ${fulfilled.length}`);
  console.log(`  Gagal: ${rejected.length}`);

  for (const error of rejected) {
    console.log(`  Error: ${errorMessage(error)}`);
  }

  return { fulfilled, rejected };
}

async function createFixture(): Promise<void> {
  const passwordHash = await hashPassword(
    `B10-${randomUUID()}-Temporary-Password!`
  );

  const definitions = [
    {
      key: 'school-admin-a',
      role: InstitutionRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      key: 'school-admin-b',
      role: InstitutionRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      key: 'platform-admin-a',
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      key: 'platform-admin-b',
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      key: 'member-target-approve',
      role: null,
      status: null,
    },
    {
      key: 'member-target-conflict',
      role: null,
      status: null,
    },
    {
      key: 'requester-race',
      role: null,
      status: null,
    },
    {
      key: 'requester-duplicate-a',
      role: null,
      status: null,
    },
    {
      key: 'requester-duplicate-b',
      role: null,
      status: null,
    },
  ];

  const users = definitions.map((item) => ({
    id: randomUUID(),
    email: `${PREFIX}-${item.key}@b10.invalid`,
    namaLengkap: `${PREFIX} ${item.key}`,
    passwordHash,
    isActive: true,
    emailVerified: true,
  }));

  const baseInstitution = {
    id: randomUUID(),
    npsn: uniqueNpsn(),
    namaResmi: `${PREFIX} Base Institution`,
    namaSingkat: `${PREFIX} Base`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis B10',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  };

  const duplicateNpsn = uniqueNpsn();

  const requests = [
    {
      id: randomUUID(),
      requesterUserId: users[6].id,
      npsn: uniqueNpsn(),
      namaResmi: `${PREFIX} Request Race`,
      namaSingkat: `${PREFIX} Race`,
      jenjang: 'MA',
      jenisInstitusi: 'NEGERI',
      kementerianDinas: 'Kementerian Agama',
      alamatLengkap: 'Alamat sintetis B10 Race',
      kabupatenKota: 'Gunungkidul',
      provinsi: 'DI Yogyakarta',
      status: InstitutionRequestStatus.PENDING_REVIEW,
    },
    {
      id: randomUUID(),
      requesterUserId: users[7].id,
      npsn: duplicateNpsn,
      namaResmi: `${PREFIX} Duplicate A`,
      namaSingkat: `${PREFIX} Dup A`,
      jenjang: 'MA',
      jenisInstitusi: 'NEGERI',
      kementerianDinas: 'Kementerian Agama',
      alamatLengkap: 'Alamat sintetis B10 Duplicate A',
      kabupatenKota: 'Gunungkidul',
      provinsi: 'DI Yogyakarta',
      status: InstitutionRequestStatus.PENDING_REVIEW,
    },
    {
      id: randomUUID(),
      requesterUserId: users[8].id,
      npsn: duplicateNpsn,
      namaResmi: `${PREFIX} Duplicate B`,
      namaSingkat: `${PREFIX} Dup B`,
      jenjang: 'MA',
      jenisInstitusi: 'NEGERI',
      kementerianDinas: 'Kementerian Agama',
      alamatLengkap: 'Alamat sintetis B10 Duplicate B',
      kabupatenKota: 'Gunungkidul',
      provinsi: 'DI Yogyakarta',
      status: InstitutionRequestStatus.PENDING_REVIEW,
    },
  ];

  const memberships = [
    {
      id: randomUUID(),
      userId: users[0].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      id: randomUUID(),
      userId: users[1].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      id: randomUUID(),
      userId: users[2].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      id: randomUUID(),
      userId: users[3].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    {
      id: randomUUID(),
      userId: users[4].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.TEACHER,
      status: MembershipStatus.PENDING,
    },
    {
      id: randomUUID(),
      userId: users[5].id,
      institutionId: baseInstitution.id,
      role: InstitutionRole.OPERATOR,
      status: MembershipStatus.PENDING,
    },
  ];

  await prisma.$transaction(async (tx: any) => {
    await tx.user.createMany({ data: users });
    await tx.institution.create({ data: baseInstitution });
    await tx.institutionMembership.createMany({
      data: memberships,
    });
    await tx.institutionRequest.createMany({
      data: requests,
    });
  });

  userIds.push(...users.map((item) => item.id));
  requestIds.push(...requests.map((item) => item.id));

  Object.assign(fixture, {
    users,
    baseInstitution,
    memberships,
    requests,
    duplicateNpsn,
  });

  fixtureReady = true;
  console.log('B10 FIXTURE CREATED.');
}

async function cleanupFixture(): Promise<void> {
  if (!prisma || !fixtureReady) return;

  await prisma.$transaction(async (tx: any) => {
    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
      },
    });

    if (
      users.length !== userIds.length ||
      users.some((item: any) =>
        !item.email.startsWith(`${PREFIX}-`) ||
        !item.namaLengkap.startsWith(PREFIX)
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: identitas user B10 tidak cocok.'
      );
    }

    const requests = await tx.institutionRequest.findMany({
      where: { id: { in: requestIds } },
    });

    if (
      requests.length !== requestIds.length ||
      requests.some((item: any) => {
        const expected = fixture.requests.find(
          (entry: any) => entry.id === item.id
        );

        return (
          !expected ||
          item.requesterUserId !== expected.requesterUserId ||
          item.npsn !== expected.npsn ||
          item.namaResmi !== expected.namaResmi
        );
      })
    ) {
      throw new Error(
        'Cleanup dihentikan: identitas request B10 tidak cocok.'
      );
    }

    const expectedNpsns = [
      fixture.baseInstitution.npsn,
      ...fixture.requests.map((item: any) => item.npsn),
    ];

    const institutions = await tx.institution.findMany({
      where: { npsn: { in: [...new Set(expectedNpsns)] } },
    });

    const allowedNames = new Set([
      fixture.baseInstitution.namaResmi,
      ...fixture.requests.map((item: any) => item.namaResmi),
    ]);

    if (
      institutions.some((item: any) =>
        !allowedNames.has(item.namaResmi) ||
        !expectedNpsns.includes(item.npsn)
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: ditemukan institusi di luar fixture B10.'
      );
    }

    const institutionIds = institutions.map(
      (item: any) => item.id
    );

    const memberships = await tx.institutionMembership.findMany({
      where: { institutionId: { in: institutionIds } },
    });

    if (
      memberships.some((item: any) =>
        !userIds.includes(item.userId)
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: ditemukan membership milik user di luar fixture.'
      );
    }

    const auditLogs = await tx.auditLog.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { institutionId: { in: institutionIds } },
        ],
      },
      select: { id: true, userId: true, institutionId: true },
    });

    if (
      auditLogs.some((item: any) =>
        item.userId !== null && !userIds.includes(item.userId) ||
        item.institutionId !== null &&
          !institutionIds.includes(item.institutionId)
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: ditemukan audit log dengan referensi di luar fixture.'
      );
    }

    await tx.auditLog.deleteMany({
      where: { id: { in: auditLogs.map((item: any) => item.id) } },
    });

    await tx.userSession.deleteMany({
      where: { userId: { in: userIds } },
    });

    await tx.passwordResetToken.deleteMany({
      where: { userId: { in: userIds } },
    });

    await tx.institutionRequest.deleteMany({
      where: { id: { in: requestIds } },
    });

    await tx.institutionMembership.deleteMany({
      where: { id: { in: memberships.map((item: any) => item.id) } },
    });

    await tx.institution.deleteMany({
      where: { id: { in: institutionIds } },
    });

    await tx.user.deleteMany({
      where: { id: { in: userIds } },
    });

    const remaining = await Promise.all([
      tx.user.count({ where: { id: { in: userIds } } }),
      tx.institutionRequest.count({
        where: { id: { in: requestIds } },
      }),
      tx.institutionMembership.count({
        where: { id: { in: memberships.map((item: any) => item.id) } },
      }),
      tx.institution.count({
        where: { id: { in: institutionIds } },
      }),
    ]);

    if (remaining.some((count: number) => count !== 0)) {
      throw new Error(
        'Cleanup gagal: masih terdapat record fixture B10.'
      );
    }
  });

  fixtureReady = false;
  console.log('B10 FIXTURE CLEANUP VERIFIED.');
}

async function runConcurrencyTests(): Promise<void> {
  const [
    { membershipApprovalService },
    { institutionOnboardingService },
  ] = await Promise.all([
    import('../src/services/membershipApprovalService'),
    import('../src/services/institutionOnboardingService'),
  ]);

  const users = fixture.users;
  const memberships = fixture.memberships;
  const requests = fixture.requests;
  const institution = fixture.baseInstitution;

  // B10-01: Dua reviewer menyetujui membership yang sama.
  const b1001 = await runRace(
    'B10-01: Dua reviewer approve membership yang sama',
    [
      membershipApprovalService.approve({
        membershipId: memberships[4].id,
        institutionId: institution.id,
        actorUserId: users[0].id,
      }),
      membershipApprovalService.approve({
        membershipId: memberships[4].id,
        institutionId: institution.id,
        actorUserId: users[1].id,
      }),
    ]
  );

  assert(
    b1001.fulfilled.length === 1 &&
    b1001.rejected.length === 1,
    'B10-01 hanya satu approval membership yang berhasil.'
  );

  const memberApproveState =
    await prisma.institutionMembership.findUnique({
      where: { id: memberships[4].id },
      select: { status: true },
    });

  assert(
    memberApproveState?.status === MembershipStatus.ACTIVE,
    'B10-01 status akhir membership adalah ACTIVE.'
  );

  // B10-02: Approve dan reject pada membership yang sama.
  const b1002 = await runRace(
    'B10-02: Approve dan reject membership secara bersamaan',
    [
      membershipApprovalService.approve({
        membershipId: memberships[5].id,
        institutionId: institution.id,
        actorUserId: users[0].id,
      }),
      membershipApprovalService.reject({
        membershipId: memberships[5].id,
        institutionId: institution.id,
        actorUserId: users[1].id,
        reason: 'Pengujian konkurensi B10.',
      }),
    ]
  );

  assert(
    b1002.fulfilled.length === 1 &&
    b1002.rejected.length === 1,
    'B10-02 hanya satu transisi approve/reject yang berhasil.'
  );

  const memberConflictState =
    await prisma.institutionMembership.findUnique({
      where: { id: memberships[5].id },
      select: { status: true },
    });

  assert(
    memberConflictState?.status === MembershipStatus.ACTIVE ||
    memberConflictState?.status === MembershipStatus.INACTIVE,
    'B10-02 status akhir membership hanya ACTIVE atau INACTIVE.'
  );

  // B10-03: Dua Super Admin menyetujui request yang sama.
  const b1003 = await runRace(
    'B10-03: Dua Super Admin approve request yang sama',
    [
      institutionOnboardingService.approveRequest({
        requestId: requests[0].id,
        reviewerUserId: users[2].id,
      }),
      institutionOnboardingService.approveRequest({
        requestId: requests[0].id,
        reviewerUserId: users[3].id,
      }),
    ]
  );

  assert(
    b1003.fulfilled.length === 1 &&
    b1003.rejected.length === 1,
    'B10-03 hanya satu approval onboarding yang berhasil.'
  );

  const requestRaceState =
    await prisma.institutionRequest.findUnique({
      where: { id: requests[0].id },
      select: { status: true, institutionId: true },
    });

  assert(
    requestRaceState?.status === InstitutionRequestStatus.APPROVED &&
    Boolean(requestRaceState.institutionId),
    'B10-03 request berstatus APPROVED dan memiliki institutionId.'
  );

  const raceInstitutionCount = await prisma.institution.count({
    where: { npsn: requests[0].npsn },
  });

  const raceMembershipCount =
    await prisma.institutionMembership.count({
      where: {
        userId: requests[0].requesterUserId,
        institutionId: requestRaceState.institutionId!,
      },
    });

  assert(
    raceInstitutionCount === 1 && raceMembershipCount === 1,
    'B10-03 hanya satu institusi dan satu membership admin terbentuk.'
  );

  // B10-04: Dua request berbeda menggunakan NPSN yang sama.
  const b1004 = await runRace(
    'B10-04: Dua request dengan NPSN sama disetujui bersamaan',
    [
      institutionOnboardingService.approveRequest({
        requestId: requests[1].id,
        reviewerUserId: users[2].id,
      }),
      institutionOnboardingService.approveRequest({
        requestId: requests[2].id,
        reviewerUserId: users[3].id,
      }),
    ]
  );

  assert(
    b1004.fulfilled.length === 1 &&
    b1004.rejected.length === 1,
    'B10-04 hanya satu request dengan NPSN sama yang berhasil disetujui.'
  );

  const duplicateInstitutions = await prisma.institution.count({
    where: { npsn: fixture.duplicateNpsn },
  });

  const duplicateRequests = await prisma.institutionRequest.findMany({
    where: { id: { in: [requests[1].id, requests[2].id] } },
    select: { id: true, status: true, institutionId: true },
  });

  const duplicateApproved = duplicateRequests.filter(
    (item: any) =>
      item.status === InstitutionRequestStatus.APPROVED &&
      item.institutionId !== null
  );

  const duplicatePending = duplicateRequests.filter(
    (item: any) =>
      item.status === InstitutionRequestStatus.PENDING_REVIEW &&
      item.institutionId === null
  );

  assert(
    duplicateInstitutions === 1 &&
    duplicateApproved.length === 1 &&
    duplicatePending.length === 1,
    'B10-04 hanya satu institusi terbentuk dan satu request tetap pending.'
  );

  const duplicateMembershipCount =
    await prisma.institutionMembership.count({
      where: {
        userId: {
          in: [requests[1].requesterUserId, requests[2].requesterUserId],
        },
        institutionId: duplicateApproved[0].institutionId!,
      },
    });

  assert(
    duplicateMembershipCount === 1,
    'B10-04 hanya satu membership admin terbentuk.'
  );
}

async function runAuditConsistencyTest(): Promise<void> {
  const users = fixture.users;
  const institution = fixture.baseInstitution;
  const memberships = fixture.memberships;

  const auditCount = await prisma.auditLog.count({
    where: {
      userId: { in: [users[0].id, users[1].id, users[2].id, users[3].id] },
      action: {
        in: [
          'MEMBERSHIP_REQUEST_APPROVED',
          'MEMBERSHIP_REQUEST_REJECTED',
          'INSTITUTION_REQUEST_APPROVED',
        ],
      },
    },
  });

  const memberAuditCount = await prisma.auditLog.count({
    where: {
      institutionId: institution.id,
      action: {
        in: [
          'MEMBERSHIP_REQUEST_APPROVED',
          'MEMBERSHIP_REQUEST_REJECTED',
        ],
      },
      details: {
        path: '$.membershipId',
        equals: memberships[4].id,
      },
    },
  });

  assert(
    auditCount === 4,
    'B10-05 jumlah audit log sama dengan empat operasi review yang berhasil.'
  );

  assert(
    memberAuditCount === 1,
    'B10-05 membership yang direview paralel memiliki tepat satu audit log.'
  );
}

async function runRetryPolicyTests(): Promise<void> {
  const { withOnboardingTransaction } =
    await import('../src/security/onboardingTransaction');

  const originalTransaction = prisma.$transaction.bind(prisma);

  let attempts = 0;
  let operationCalls = 0;

  try {
    prisma.$transaction = async (
      callback: any,
      options: any
    ) => {
      attempts++;

      if (attempts <= 2) {
        const error: any = new Error('Simulated serialization conflict');
        error.code = 'P2034';
        throw error;
      }

      return originalTransaction(callback, options);
    };

    const result = await withOnboardingTransaction(async (tx: any) => {
      operationCalls++;
      return tx.$queryRaw`SELECT 1 AS retry_test`;
    });

    assert(
      attempts === 3 && operationCalls === 1,
      'B10-06a P2034 diulang dan berhasil pada percobaan ketiga.'
    );

    assert(
      Array.isArray(result) && Number(result[0]?.retry_test) === 1,
      'B10-06a transaksi setelah retry benar-benar berjalan pada database test.'
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }

  attempts = 0;
  operationCalls = 0;

  try {
    prisma.$transaction = async () => {
      attempts++;
      const error: any = new Error('Simulated unique constraint');
      error.code = 'P2002';
      throw error;
    };

    let caught: any;

    try {
      await withOnboardingTransaction(async () => {
        operationCalls++;
        return true;
      });
    } catch (error) {
      caught = error;
    }

    assert(
      caught?.code === 'P2002' &&
      attempts === 1 &&
      operationCalls === 0,
      'B10-06b P2002 tidak diulang dan langsung diteruskan.'
    );
  } finally {
    prisma.$transaction = originalTransaction;
  }
}

async function main(): Promise<void> {
  let cleanupError: unknown;

  try {
    requireCondition(
      fs.existsSync(ENV_PATH),
      '.env.onboarding-test tidak ditemukan.'
    );

    const config = dotenv.parse(fs.readFileSync(ENV_PATH));

    requireCondition(
      config.MYSQL_DATABASE === 'edutaktis_onboarding_test',
      'STOP: database bukan edutaktis_onboarding_test.'
    );

    requireCondition(
      Boolean(config.MYSQL_USER && config.MYSQL_PASSWORD),
      'Konfigurasi database test tidak lengkap.'
    );

    const testDb = await import('./onboarding-test-prisma');
    prisma = testDb.prisma;

    const identity = await prisma.$queryRaw`
      SELECT DATABASE() AS db, @@port AS port
    `;

    requireCondition(
      identity[0]?.db === 'edutaktis_onboarding_test' &&
      Number(identity[0]?.port) === 3306,
      'STOP: identitas database test tidak sesuai.'
    );

    console.log(
      'DATABASE VERIFIED: edutaktis_onboarding_test; internal port 3306.'
    );

    await createFixture();
    await runConcurrencyTests();
    await runAuditConsistencyTest();
    await runRetryPolicyTests();

    console.log('\nB10 ALL TESTS COMPLETED.');
  } finally {
    if (fixtureReady) {
      try {
        await cleanupFixture();
      } catch (error) {
        cleanupError = error;
        console.error('B10 CLEANUP ERROR:', error);
      }
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  }

  if (cleanupError) throw cleanupError;

  console.log(`\nB10 RESULT: ${passed} passed, ${failed} failed.`);
}

main().catch((error) => {
  console.error('\nB10 FAILED:', error);
  process.exitCode = 1;
});
