
import { randomUUID } from 'node:crypto';

import { prisma } from './onboarding-test-prisma';

import {
  withOnboardingTransaction,
} from '../src/security/onboardingTransaction';

import {
  withSuperAdminGuard,
} from '../src/security/superAdminGuard';

const PREFIX = `B11-TIMEOUT-${randomUUID()}`;

const fixture = {
  id: randomUUID(),
  email: `${PREFIX}@b11.invalid`,
  originalName: `${PREFIX} Original`,
};

let fixtureReady = false;
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

function errorCode(error: any): string {
  return String(error?.code ?? 'NO_PRISMA_CODE');
}

async function createFixture(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: fixture.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error('STOP: Email fixture sudah digunakan.');
  }

  await prisma.user.create({
    data: {
      id: fixture.id,
      email: fixture.email,
      namaLengkap: fixture.originalName,
      isActive: true,
      emailVerified: true,
    },
  });

  fixtureReady = true;

  console.log('B11 TIMEOUT FIXTURE CREATED.');
  console.log(`  User ID: ${fixture.id}`);
}

async function runTimeoutTest(
  label: string,
  wrapper: (
    operation: (tx: any) => Promise<unknown>
  ) => Promise<unknown>,
  targetName: string,
): Promise<void> {
  console.log(`\n========== ${label} ==========`);

  let callbackCalls = 0;
  let capturedError: any = null;

  const startedAt = Date.now();

  try {
    await wrapper(async (tx) => {
      callbackCalls++;

      await tx.user.update({
        where: { id: fixture.id },
        data: { namaLengkap: targetName },
      });

      console.log(
        `${label}: update selesai; menunggu 31 detik...`
      );

      await sleep(31_000);

      return 'CALLBACK_COMPLETED';
    });
  } catch (error) {
    capturedError = error;
  }

  const elapsed = Date.now() - startedAt;

  assert(
    capturedError !== null,
    `${label}: transaksi menghasilkan error timeout.`
  );

  if (capturedError) {
    console.log(
      `${label}: error code = ${errorCode(capturedError)}`
    );

    console.log(
      `${label}: error message = ${String(capturedError.message ?? capturedError).slice(0, 500)}`
    );

    assert(
      errorCode(capturedError) !== 'P2034',
      `${label}: timeout bukan konflik transaksi P2034.`
    );
  }

  assert(
    callbackCalls === 1,
    `${label}: callback hanya dipanggil satu kali (actual: ${callbackCalls}).`
  );

  assert(
    elapsed >= 30_000,
    `${label}: durasi pengujian mencapai batas timeout (actual: ${elapsed} ms).`
  );

  const userAfter = await prisma.user.findUnique({
    where: { id: fixture.id },
    select: { namaLengkap: true },
  });

  assert(
    userAfter?.namaLengkap === fixture.originalName,
    `${label}: perubahan nama berhasil di-rollback.`
  );

  console.log(
    `${label}: elapsed ${elapsed} ms`
  );
}

async function cleanupFixture(): Promise<void> {
  if (!fixtureReady) return;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: fixture.id },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
      },
    });

    if (
      !user ||
      user.email !== fixture.email ||
      !user.namaLengkap.startsWith(PREFIX)
    ) {
      throw new Error(
        'STOP CLEANUP: Identitas fixture tidak cocok.'
      );
    }

    await tx.userSession.deleteMany({
      where: { userId: fixture.id },
    });

    await tx.passwordResetToken.deleteMany({
      where: { userId: fixture.id },
    });

    await tx.auditLog.deleteMany({
      where: { userId: fixture.id },
    });

    await tx.user.delete({
      where: { id: fixture.id },
    });

    const remaining = await tx.user.count({
      where: { id: fixture.id },
    });

    if (remaining !== 0) {
      throw new Error(
        'Cleanup gagal: fixture user masih tersisa.'
      );
    }
  });

  console.log('B11 TIMEOUT FIXTURE CLEANED.');
}

async function main(): Promise<void> {
  try {
    await createFixture();

    await runTimeoutTest(
      'ONBOARDING TRANSACTION',
      withOnboardingTransaction,
      `${PREFIX} Onboarding Changed`,
    );

    await runTimeoutTest(
      'SUPER ADMIN GUARD',
      withSuperAdminGuard,
      `${PREFIX} Super Admin Changed`,
    );
  } finally {
    try {
      await cleanupFixture();
    } catch (error) {
      failed++;
      console.error(
        'CLEANUP ERROR:',
        error
      );
    }

    await prisma.$disconnect();
  }

  console.log('\n========== B11-05 TIMEOUT SUMMARY ==========');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('FATAL TEST ERROR:', error);

  try {
    await prisma.$disconnect();
  } catch {
    // Tidak ada tindakan tambahan jika disconnect gagal.
  }

  process.exitCode = 1;
});
