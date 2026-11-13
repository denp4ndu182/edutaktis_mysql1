import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { randomInt, randomUUID } from 'node:crypto';
import { InstitutionRequestStatus } from '@prisma/client';
import { hashPassword } from '../src/security/password';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.onboarding-test');
const PREFIX = `B11-${randomUUID()}`;

let prisma: any;
let fixtureReady = false;
let passed = 0;
let failed = 0;

const userIds: string[] = [];
const fixture: Record<string, any> = {};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${message}`);
    return;
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

function makeRequestInput(
  requesterUserId: string,
  npsn: string,
  suffix: string
) {
  return {
    requesterUserId,
    npsn,
    namaResmi: `${PREFIX} ${suffix}`,
    namaSingkat: `${PREFIX} ${suffix}`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: `Alamat sintetis ${PREFIX}`,
    kelurahanDesa: 'Desa Pengujian',
    kecamatan: 'Kecamatan Pengujian',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
    kodePos: '55800',
    telepon: null,
    email: null,
    website: null,
    ipAddress: '127.0.0.1',
  };
}

async function createFixture(): Promise<void> {
  const passwordHash = await hashPassword(
    `B11-${randomUUID()}-Temporary-Password!`
  );

  const users = [
    {
      id: randomUUID(),
      email: `${PREFIX}-requester-a@b11.invalid`,
      namaLengkap: `${PREFIX} Requester A`,
      passwordHash,
      isActive: true,
      emailVerified: true,
    },
    {
      id: randomUUID(),
      email: `${PREFIX}-requester-b@b11.invalid`,
      namaLengkap: `${PREFIX} Requester B`,
      passwordHash,
      isActive: true,
      emailVerified: true,
    },
  ];

  let npsn = '';

  // Pastikan NPSN fixture belum digunakan.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = uniqueNpsn();

    const [institution, request] = await Promise.all([
      prisma.institution.findUnique({
        where: { npsn: candidate },
        select: { id: true },
      }),
      prisma.institutionRequest.findFirst({
        where: { npsn: candidate },
        select: { id: true },
      }),
    ]);

    if (!institution && !request) {
      npsn = candidate;
      break;
    }
  }

  requireCondition(
    Boolean(npsn),
    'Tidak berhasil memperoleh NPSN unik untuk fixture.'
  );

  await prisma.$transaction(async (tx: any) => {
    await tx.user.createMany({ data: users });
  });

  userIds.push(...users.map((item) => item.id));

  Object.assign(fixture, {
    users,
    npsn,
  });

  fixtureReady = true;

  console.log('B11 FIXTURE CREATED.');
  console.log(`  Requester: ${users.length}`);
  console.log(`  NPSN: ${npsn}`);
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
        'Cleanup dihentikan: identitas user B11 tidak cocok.'
      );
    }

    const requests = await tx.institutionRequest.findMany({
      where: { npsn: fixture.npsn },
    });

    if (
      requests.some((item: any) =>
        !userIds.includes(item.requesterUserId) ||
        !item.namaResmi.startsWith(PREFIX) ||
        !item.namaSingkat.startsWith(PREFIX)
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: ditemukan request di luar fixture B11.'
      );
    }

    const institutions = await tx.institution.findMany({
      where: { npsn: fixture.npsn },
    });

    if (institutions.length !== 0) {
      throw new Error(
        'Cleanup dihentikan: ditemukan institusi dengan NPSN fixture.'
      );
    }

    const requestIds = requests.map((item: any) => item.id);
    const requestIdSet = new Set(requestIds);

    const auditLogs = await tx.auditLog.findMany({
      where: {
        userId: { in: userIds },
        action: 'INSTITUTION_REQUEST_SUBMITTED',
      },
      select: {
        id: true,
        userId: true,
        institutionId: true,
        details: true,
      },
    });

    if (
      auditLogs.some((item: any) =>
        !requestIdSet.has(item.details?.requestId) ||
        !userIds.includes(item.userId) ||
        item.institutionId !== null
      )
    ) {
      throw new Error(
        'Cleanup dihentikan: audit log tidak cocok dengan fixture B11.'
      );
    }

    await tx.auditLog.deleteMany({
      where: {
        id: { in: auditLogs.map((item: any) => item.id) },
      },
    });

    await tx.institutionRequest.deleteMany({
      where: { id: { in: requestIds } },
    });

    await tx.userSession.deleteMany({
      where: { userId: { in: userIds } },
    });

    await tx.passwordResetToken.deleteMany({
      where: { userId: { in: userIds } },
    });

    await tx.user.deleteMany({
      where: { id: { in: userIds } },
    });

    const remaining = await Promise.all([
      tx.user.count({ where: { id: { in: userIds } } }),
      tx.institutionRequest.count({
        where: { id: { in: requestIds } },
      }),
      tx.auditLog.count({
        where: { id: { in: auditLogs.map((item: any) => item.id) } },
      }),
    ]);

    if (remaining.some((count: number) => count !== 0)) {
      throw new Error(
        'Cleanup gagal: masih terdapat record fixture B11.'
      );
    }
  });

  fixtureReady = false;
  console.log('B11 FIXTURE CLEANUP VERIFIED.');
}

async function runDuplicateSubmitTest(): Promise<void> {
  const { institutionOnboardingService } =
    await import('../src/services/institutionOnboardingService');

  const users = fixture.users;
  const npsn = fixture.npsn;

  console.log('\nB11-04: Dua requester submit NPSN identik secara bersamaan');

  const results = await Promise.allSettled([
    institutionOnboardingService.submitRequest(
      makeRequestInput(users[0].id, npsn, 'Requester A')
    ),
    institutionOnboardingService.submitRequest(
      makeRequestInput(users[1].id, npsn, 'Requester B')
    ),
  ]);

  const fulfilled = results
    .filter((item): item is PromiseFulfilledResult<any> =>
      item.status === 'fulfilled'
    );

  const rejected = results
    .filter((item): item is PromiseRejectedResult =>
      item.status === 'rejected'
    );

  console.log(`  Berhasil: ${fulfilled.length}`);
  console.log(`  Ditolak: ${rejected.length}`);

  for (const item of rejected) {
    console.log(`  Penolakan: ${errorMessage(item.reason)}`);
  }

  assert(
    fulfilled.length === 1 && rejected.length === 1,
    'B11-04 tepat satu submit berhasil dan satu ditolak.'
  );

  const requests = await prisma.institutionRequest.findMany({
    where: { npsn },
    orderBy: { createdAt: 'asc' },
  });

  const pendingRequests = requests.filter(
    (item: any) =>
      item.status === InstitutionRequestStatus.PENDING_REVIEW
  );

  assert(
    requests.length === 1 && pendingRequests.length === 1,
    'B11-04 hanya satu request pending tercatat untuk NPSN tersebut.'
  );

  if (rejected.length === 1) {
    assert(
      errorMessage(rejected[0].reason).includes(
        'NPSN_REQUEST_ALREADY_PENDING'
      ),
      'B11-04 operasi yang kalah ditolak dengan NPSN_REQUEST_ALREADY_PENDING.'
    );
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      userId: { in: userIds },
      action: 'INSTITUTION_REQUEST_SUBMITTED',
    },
  });

  assert(
    auditLogs.length === 1,
    'B11-04 hanya satu audit log submit tercatat.'
  );

  if (requests.length === 1 && auditLogs.length === 1) {
    assert(
      auditLogs[0].details?.requestId === requests[0].id &&
      auditLogs[0].details?.npsn === npsn,
      'B11-04 audit log merujuk pada request yang benar.'
    );
  }

  // Uji ulang secara sequential untuk memastikan penolakan bisnis normal.
  const winner = fulfilled.length === 1
    ? fulfilled[0].value
    : null;

  if (winner) {
    const losingUser = users.find(
      (item: any) => item.id !== winner.requesterUserId
    );

    if (losingUser) {
      let sequentialError: unknown;

      try {
        await institutionOnboardingService.submitRequest(
          makeRequestInput(losingUser.id, npsn, 'Sequential Retry')
        );
      } catch (error) {
        sequentialError = error;
      }

      assert(
        errorMessage(sequentialError).includes(
          'NPSN_REQUEST_ALREADY_PENDING'
        ),
        'B11-04 submit sequential berikutnya ditolak karena request masih pending.'
      );

      const finalAuditCount = await prisma.auditLog.count({
        where: {
          userId: { in: userIds },
          action: 'INSTITUTION_REQUEST_SUBMITTED',
        },
      });

      assert(
        finalAuditCount === 1,
        'B11-04 submit yang ditolak tidak menghasilkan audit log tambahan.'
      );
    }
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
    await runDuplicateSubmitTest();

    console.log('\nB11-04 TESTS COMPLETED.');
  } finally {
    if (fixtureReady) {
      try {
        await cleanupFixture();
      } catch (error) {
        cleanupError = error;
        console.error('B11 CLEANUP ERROR:', error);
      }
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  }

  if (cleanupError) throw cleanupError;

  console.log(`\nB11-04 RESULT: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\nB11-04 FAILED:', error);
  process.exitCode = 1;
});
