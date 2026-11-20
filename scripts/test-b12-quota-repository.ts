import { createHash, randomUUID } from 'node:crypto';

const PREFIX = `B12-QUOTA-${randomUUID()}`;
const USER_ID = randomUUID();
const USER_EMAIL = `${PREFIX}@b12.invalid`;

const KEY_HASHES = [
  'sequential',
  'concurrency',
  'shared-client',
  'window-rollover',
  'atomic-success',
  'atomic-short-limit',
  'atomic-daily-limit',
  'atomic-new-row-rollback',
  'atomic-concurrency',
].map((label) =>
  createHash('sha256')
    .update(`${PREFIX}:${label}`)
    .digest('hex')
);

const OWNER_TOKENS = ['owner-a', 'owner-b'].map((label) =>
  createHash('sha256')
    .update(`${PREFIX}:${label}`)
    .digest('hex')
);

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${message}`);
    return;
  }

  passed++;
  console.log(`PASS ${passed}: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: any): string {
  return String(error?.message ?? error?.code ?? error);
}

async function verifyIdentity(client: any, label: string): Promise<void> {
  const rows = await client.$queryRaw`
    SELECT
      DATABASE() AS db,
      @@port AS port,
      @@hostname AS host
  `;

  const identity = rows[0];

  if (
    identity?.db !== 'edutaktis_onboarding_test' ||
    Number(identity?.port) !== 3306
  ) {
    throw new Error(`${label}: database identity tidak sesuai.`);
  }

  console.log(
    `${label}: ${identity.db}, port ${Number(identity.port)}, host ${identity.host}`
  );
}

async function main(): Promise<void> {
  let primary: any;
  let secondary: any;
  let Repository: any;
  let UsageScope: any;
  let fixtureReady = false;
  let runError: unknown;
  let cleanupError: unknown;

  try {
    // Helper wajib dimuat sebelum Prisma Client kedua atau repository.
    const testDb = await import('./onboarding-test-prisma');
    primary = testDb.prisma;

    const prismaModule = await import('@prisma/client');
    const { PrismaClient } = prismaModule;
    UsageScope = prismaModule.GeneratorUsageScope;

    await verifyIdentity(primary, 'PRIMARY CLIENT');

    // Client baru, bukan singleton atau instance yang sama.
    secondary = new PrismaClient({
      log: ['error'],
    });

    await verifyIdentity(secondary, 'SECONDARY CLIENT');

    const repositoryModule = await import(
      '../src/repositories/generatorQuotaRepository'
    );

    Repository = repositoryModule.GeneratorQuotaRepository;

    const repoA = new Repository(primary);
    const repoB = new Repository(secondary);

    console.log('\n=== CREATE FIXTURE ===');

    const existing = await primary.user.findUnique({
      where: { email: USER_EMAIL },
      select: { id: true },
    });

    if (existing) {
      throw new Error('STOP: email fixture sudah digunakan.');
    }

    await primary.user.create({
      data: {
        id: USER_ID,
        email: USER_EMAIL,
        namaLengkap: `${PREFIX} Test User`,
        isActive: true,
        emailVerified: true,
      },
    });

    fixtureReady = true;

    console.log(`Fixture user created: ${USER_ID}`);

    // Q01-Q03: sequential increment dan quota limit.
    console.log('\n=== Q01-Q03: SEQUENTIAL COUNTER ===');

    const sequentialParams = {
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[0],
      windowSeconds: 900,
      limit: 3,
    };

    const sequential1 = await repoA.incrementCounter(sequentialParams);
    const sequential2 = await repoA.incrementCounter(sequentialParams);
    const sequential3 = await repoA.incrementCounter(sequentialParams);
    const sequential4 = await repoA.incrementCounter(sequentialParams);

    assert(
      sequential1.allowed && sequential1.usageCount === 1,
      'Q01: counter pertama menghasilkan usageCount 1.'
    );

    assert(
      sequential2.allowed && sequential2.usageCount === 2,
      'Q02: increment kedua menghasilkan usageCount 2.'
    );

    assert(
      sequential3.allowed && sequential3.usageCount === 3,
      'Q03-A: request terakhir pada limit masih diterima.'
    );

    assert(
      !sequential4.allowed &&
      sequential4.usageCount === 3 &&
      sequential4.remaining === 0,
      'Q03-B: request di atas limit ditolak tanpa increment.'
    );

    // Q04: sepuluh request paralel pada key yang sama.
    console.log('\n=== Q04: CONCURRENT QUOTA ===');

    const concurrentParams = {
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[1],
      windowSeconds: 900,
      limit: 5,
    };

    const concurrentResults = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        (index % 2 === 0 ? repoA : repoB).incrementCounter(
          concurrentParams
        )
      )
    );

    const fulfilled = concurrentResults.filter(
      (item: any) => item.status === 'fulfilled'
    );

    const rejected = concurrentResults.filter(
      (item: any) => item.status === 'rejected'
    );

    const allowedResults = fulfilled.filter(
      (item: any) => item.value.allowed
    );

    const deniedResults = fulfilled.filter(
      (item: any) => !item.value.allowed
    );

    for (const item of rejected as any[]) {
      console.error(
        'Q04 transaction error:',
        errorMessage(item.reason)
      );
    }

    const concurrentRows = await primary.generatorUsageCounter.findMany({
      where: {
        keyHash: KEY_HASHES[1],
        windowSeconds: 900,
      },
    });

    assert(
      rejected.length === 0,
      'Q04-A: seluruh 10 transaksi paralel berhasil diproses.'
    );

    assert(
      allowedResults.length === 5 && deniedResults.length === 5,
      'Q04-B: tepat 5 request diterima dan 5 ditolak.'
    );

    assert(
      concurrentRows.length === 1 &&
      concurrentRows[0].usageCount === 5,
      'Q04-C: database hanya mencatat 5 konsumsi quota.'
    );

    // Q05: dua Prisma Client independen berbagi counter.
    console.log('\n=== Q05: SHARED DATABASE COUNTER ===');

    const sharedParams = {
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[2],
      windowSeconds: 900,
      limit: 10,
    };

    const shared1 = await repoA.incrementCounter(sharedParams);
    const shared2 = await repoB.incrementCounter(sharedParams);

    assert(
      shared1.allowed &&
      shared2.allowed &&
      shared1.usageCount === 1 &&
      shared2.usageCount === 2,
      'Q05: dua Prisma Client independen berbagi counter MySQL.'
    );

    // Q06-Q10: execution lock dan owner token.
    console.log('\n=== Q06-Q10: EXECUTION LOCK ===');

    const ownerA = OWNER_TOKENS[0];
    const ownerB = OWNER_TOKENS[1];

    const lockA = await repoA.acquireExecutionLock({
      userId: USER_ID,
      ownerToken: ownerA,
      leaseSeconds: 120,
    });

    assert(
      lockA.acquired && lockA.expiresAt instanceof Date,
      'Q06: owner A berhasil memperoleh execution lock.'
    );

    const lockConflict = await repoB.acquireExecutionLock({
      userId: USER_ID,
      ownerToken: ownerB,
      leaseSeconds: 120,
    });

    assert(
      !lockConflict.acquired,
      'Q07: owner B tidak dapat mengambil lock aktif milik A.'
    );

    const wrongRelease = await repoB.releaseExecutionLock(
      USER_ID,
      ownerB
    );

    assert(
      !wrongRelease,
      'Q08: owner token yang salah tidak dapat melepaskan lock.'
    );

    // Simulasi kedaluwarsa menggunakan jam database, bukan jam lokal.
    const expired = await primary.$executeRaw`
      UPDATE generator_execution_locks
      SET expires_at = TIMESTAMPADD(
        SECOND,
        -1,
        UTC_TIMESTAMP(3)
      )
      WHERE user_id = ${USER_ID}
        AND owner_token = ${ownerA}
    `;

    if (expired !== 1) {
      throw new Error(
        'STOP: gagal menyiapkan fixture execution lock kedaluwarsa.'
      );
    }

    const reclaimed = await repoB.acquireExecutionLock({
      userId: USER_ID,
      ownerToken: ownerB,
      leaseSeconds: 120,
    });

    assert(
      reclaimed.acquired,
      'Q09: owner B berhasil mengambil alih lock kedaluwarsa.'
    );

    const staleRelease = await repoA.releaseExecutionLock(
      USER_ID,
      ownerA
    );

    assert(
      !staleRelease,
      'Q10-A: owner lama tidak dapat menghapus lock milik owner baru.'
    );

    const correctRelease = await repoB.releaseExecutionLock(
      USER_ID,
      ownerB
    );

    assert(
      correctRelease,
      'Q10-B: owner B berhasil melepaskan lock miliknya.'
    );

    // Q11: fixed-window rollover.
    console.log('\n=== Q11: FIXED WINDOW ROLLOVER ===');

    const rolloverParams = {
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[3],
      windowSeconds: 1,
      limit: 200,
    };

    const firstWindow = await repoA.incrementCounter(rolloverParams);

    let nextWindow: any = null;
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      await sleep(30);

      const candidate = await repoB.incrementCounter(rolloverParams);

      if (
        candidate.windowStart.getTime() !==
        firstWindow.windowStart.getTime()
      ) {
        nextWindow = candidate;
        break;
      }
    }

    assert(
      nextWindow !== null,
      'Q11-A: repository berpindah ke fixed window berikutnya.'
    );

    if (nextWindow) {
      assert(
        nextWindow.allowed && nextWindow.usageCount === 1,
        'Q11-B: counter pada window baru dimulai dari 1.'
      );
    }

    // Q13: Atomic reservation success.
    console.log('\n=== Q13: ATOMIC RESERVATION SUCCESS ===');

    const atomicSuccess = await repoA.incrementCounters([
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[4],
        windowSeconds: 900,
        limit: 5,
      },
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[4],
        windowSeconds: 86400,
        limit: 30,
      },
    ]);

    assert(
      atomicSuccess.allowed &&
      atomicSuccess.deniedIndex === null &&
      atomicSuccess.results.length === 2 &&
      atomicSuccess.results.every(
        (result: any) => result.allowed && result.usageCount === 1
      ),
      'Q13-A: kedua counter berhasil direservasi dalam satu transaksi.'
    );

    const atomicSuccessRows =
      await primary.generatorUsageCounter.findMany({
        where: {
          keyHash: KEY_HASHES[4],
          windowSeconds: { in: [900, 86400] },
        },
      });

    assert(
      atomicSuccessRows.length === 2 &&
      atomicSuccessRows.every(
        (row: any) => row.usageCount === 1
      ),
      'Q13-B: MySQL mencatat kedua counter masing-masing satu konsumsi.'
    );

    // Q14: Short-window quota denied; daily counter must not increment.
    console.log('\n=== Q14: SHORT WINDOW DENIAL ===');

    await repoA.incrementCounter({
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[5],
      windowSeconds: 900,
      limit: 1,
    });

    await repoA.incrementCounter({
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[5],
      windowSeconds: 86400,
      limit: 30,
    });

    const shortDenied = await repoB.incrementCounters([
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[5],
        windowSeconds: 900,
        limit: 1,
      },
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[5],
        windowSeconds: 86400,
        limit: 30,
      },
    ]);

    const shortDeniedRows =
      await primary.generatorUsageCounter.findMany({
        where: {
          keyHash: KEY_HASHES[5],
          windowSeconds: { in: [900, 86400] },
        },
      });

    assert(
      !shortDenied.allowed &&
      shortDenied.deniedIndex === 0,
      'Q14-A: reservasi ditolak karena kuota 15 menit habis.'
    );

    assert(
      shortDeniedRows.length === 2 &&
      shortDeniedRows.every(
        (row: any) => row.usageCount === 1
      ),
      'Q14-B: penolakan kuota 15 menit tidak mengubah counter harian.'
    );

    // Q15: Daily quota denied; existing short-window count must not increment.
    console.log('\n=== Q15: DAILY QUOTA DENIAL ===');

    await repoA.incrementCounter({
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[6],
      windowSeconds: 900,
      limit: 5,
    });

    await repoA.incrementCounter({
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[6],
      windowSeconds: 86400,
      limit: 1,
    });

    const dailyDenied = await repoB.incrementCounters([
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[6],
        windowSeconds: 900,
        limit: 5,
      },
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[6],
        windowSeconds: 86400,
        limit: 1,
      },
    ]);

    const dailyDeniedRows =
      await primary.generatorUsageCounter.findMany({
        where: {
          keyHash: KEY_HASHES[6],
          windowSeconds: { in: [900, 86400] },
        },
      });

    assert(
      !dailyDenied.allowed &&
      dailyDenied.deniedIndex === 1,
      'Q15-A: reservasi ditolak karena kuota harian habis.'
    );

    assert(
      dailyDeniedRows.length === 2 &&
      dailyDeniedRows.every(
        (row: any) => row.usageCount === 1
      ),
      'Q15-B: penolakan kuota harian tidak menambah counter 15 menit.'
    );

    // Q16: Newly inserted short-window counter must roll back.
    console.log('\n=== Q16: NEW COUNTER ROLLBACK ===');

    await repoA.incrementCounter({
      scope: UsageScope.USER,
      keyHash: KEY_HASHES[7],
      windowSeconds: 86400,
      limit: 1,
    });

    const newRowDenied = await repoB.incrementCounters([
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[7],
        windowSeconds: 900,
        limit: 5,
      },
      {
        scope: UsageScope.USER,
        keyHash: KEY_HASHES[7],
        windowSeconds: 86400,
        limit: 1,
      },
    ]);

    const rollbackRows =
      await primary.generatorUsageCounter.findMany({
        where: {
          keyHash: KEY_HASHES[7],
        },
      });

    assert(
      !newRowDenied.allowed &&
      newRowDenied.deniedIndex === 1,
      'Q16-A: reservasi ditolak ketika kuota harian sudah penuh.'
    );

    assert(
      rollbackRows.length === 1 &&
      rollbackRows[0].windowSeconds === 86400 &&
      rollbackRows[0].usageCount === 1,
      'Q16-B: counter 15 menit yang baru dibuat ikut rollback.'
    );

    // Q17: Concurrent atomic reservation across independent clients.
    console.log('\n=== Q17: CONCURRENT ATOMIC RESERVATION ===');

    const atomicConcurrentResults = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        (index % 2 === 0 ? repoA : repoB).incrementCounters([
          {
            scope: UsageScope.USER,
            keyHash: KEY_HASHES[8],
            windowSeconds: 900,
            limit: 5,
          },
          {
            scope: UsageScope.USER,
            keyHash: KEY_HASHES[8],
            windowSeconds: 86400,
            limit: 5,
          },
        ])
      )
    );

    const atomicFulfilled = atomicConcurrentResults.filter(
      (item: any) => item.status === 'fulfilled'
    );

    const atomicRejected = atomicConcurrentResults.filter(
      (item: any) => item.status === 'rejected'
    );

    const atomicAllowed = atomicFulfilled.filter(
      (item: any) => item.value.allowed
    );

    const atomicDenied = atomicFulfilled.filter(
      (item: any) => !item.value.allowed
    );

    for (const item of atomicRejected as any[]) {
      console.error(
        'Q17 transaction error:',
        errorMessage(item.reason)
      );
    }

    const atomicConcurrentRows =
      await primary.generatorUsageCounter.findMany({
        where: {
          keyHash: KEY_HASHES[8],
          windowSeconds: { in: [900, 86400] },
        },
      });

    assert(
      atomicRejected.length === 0,
      'Q17-A: seluruh 10 transaksi atomic paralel selesai tanpa error.'
    );

    assert(
      atomicAllowed.length === 5 &&
      atomicDenied.length === 5,
      'Q17-B: tepat 5 reservasi diterima dan 5 ditolak.'
    );

    assert(
      atomicConcurrentRows.length === 2 &&
      atomicConcurrentRows.every(
        (row: any) => row.usageCount === 5
      ),
      'Q17-C: kedua counter MySQL berhenti tepat pada limit 5.'
    );

    console.log('\nQ12: cleanupExpiredCounters tidak dipanggil.');
    console.log(
      'Alasan: metode tersebut menghapus counter kedaluwarsa secara global, termasuk milik proses lain.'
    );

    console.log('\n=== TEST EXECUTION FINISHED ===');
  } catch (error) {
    runError = error;
    console.error('TEST EXECUTION ERROR:', errorMessage(error));
  } finally {
    // Cleanup hanya menyentuh key dan user yang dibuat oleh test ini.
    if (fixtureReady && primary) {
      try {
        await primary.$transaction(async (tx: any) => {
          const allowedHashes = new Set(KEY_HASHES);
          const allowedOwners = new Set(OWNER_TOKENS);

          const user = await tx.user.findUnique({
            where: { id: USER_ID },
            select: {
              id: true,
              email: true,
              namaLengkap: true,
            },
          });

          if (
            !user ||
            user.email !== USER_EMAIL ||
            user.namaLengkap !== `${PREFIX} Test User`
          ) {
            throw new Error(
              'CLEANUP STOP: identitas user fixture tidak cocok.'
            );
          }

          const counters = await tx.generatorUsageCounter.findMany({
            where: {
              keyHash: { in: KEY_HASHES },
            },
          });

          if (
            counters.some(
              (item: any) => !allowedHashes.has(item.keyHash)
            )
          ) {
            throw new Error(
              'CLEANUP STOP: ditemukan counter di luar fixture.'
            );
          }

          const lock = await tx.generatorExecutionLock.findUnique({
            where: { userId: USER_ID },
          });

          if (
            lock &&
            !allowedOwners.has(lock.ownerToken)
          ) {
            throw new Error(
              'CLEANUP STOP: owner token lock tidak cocok.'
            );
          }

          await tx.generatorUsageCounter.deleteMany({
            where: {
              keyHash: { in: KEY_HASHES },
            },
          });

          await tx.generatorExecutionLock.deleteMany({
            where: { userId: USER_ID },
          });

          await tx.user.delete({
            where: { id: USER_ID },
          });

          const remaining = await Promise.all([
            tx.generatorUsageCounter.count({
              where: { keyHash: { in: KEY_HASHES } },
            }),
            tx.generatorExecutionLock.count({
              where: { userId: USER_ID },
            }),
            tx.user.count({
              where: { id: USER_ID },
            }),
          ]);

          if (remaining.some((count: number) => count !== 0)) {
            throw new Error(
              'CLEANUP FAILED: record fixture masih tersisa.'
            );
          }
        });

        fixtureReady = false;
        console.log('FIXTURE CLEANUP VERIFIED.');
      } catch (error) {
        cleanupError = error;
        console.error(
          'CLEANUP ERROR — fixture dipertahankan untuk investigasi:',
          errorMessage(error)
        );
        console.error('Fixture prefix:', PREFIX);
        console.error('Fixture user ID:', USER_ID);
        console.error('Fixture key hashes:', KEY_HASHES);
      }
    }

    if (secondary) {
      try {
        await secondary.$disconnect();
      } catch (error) {
        cleanupError ??= error;
        console.error('SECONDARY DISCONNECT ERROR:', errorMessage(error));
      }
    }

    if (primary) {
      try {
        await primary.$disconnect();
      } catch (error) {
        cleanupError ??= error;
        console.error('PRIMARY DISCONNECT ERROR:', errorMessage(error));
      }
    }
  }

  console.log(`\nB12 QUOTA RESULT: ${passed} passed, ${failed} failed.`);

  if (runError) throw runError;
  if (cleanupError) throw cleanupError;

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\nB12 QUOTA TEST FAILED:', errorMessage(error));
  process.exitCode = 1;
});
