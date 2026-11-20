/**
 * PHASE Password Reset Hardening — isolated integration test
 *
 * IMPORTANT:
 * - Do not run until rateLimiter.ts has been checked against the assertions below.
 * - Run only against a dedicated development/test database.
 * - This script creates one unique test user and cleans up only that user's data.
 *
 * Command:
 * NODE_ENV=test ALLOW_SIMULATED_RESET_TOKEN=true npx tsx scripts/test-password-reset-hardening.ts
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function main() {
  if (process.env.ALLOW_SIMULATED_RESET_TOKEN !== 'true') {
    throw new Error('Refusing to run: ALLOW_SIMULATED_RESET_TOKEN=true is required.');
  }

  const envPath = path.resolve(process.cwd(), '.env.onboarding-test');
  if (!fs.existsSync(envPath)) {
    throw new Error('Refusing to run: .env.onboarding-test tidak ditemukan.');
  }

  const config = dotenv.parse(fs.readFileSync(envPath));

  const requiredKeys = [
    'MYSQL_DATABASE',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
  ];

  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(`Refusing to run: konfigurasi ${key} tidak tersedia.`);
    }
  }

  if (config.MYSQL_DATABASE !== 'edutaktis_onboarding_test') {
    throw new Error('Refusing to run: nama database test tidak cocok.');
  }

  const credentials =
    `${encodeURIComponent(config.MYSQL_USER)}:${encodeURIComponent(config.MYSQL_PASSWORD)}`;

  process.env.DATABASE_URL =
    `mysql://${credentials}@127.0.0.1:3307/${config.MYSQL_DATABASE}`;
  process.env.NODE_ENV = 'test';

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing to run: NODE_ENV=test is required.');
  }

  const { prisma } = await import('../src/db/prisma');

  let databaseIdentityVerified = false;

  try {
    const identity = await prisma.$queryRaw<
      Array<{ db: string; port: number }>
    >`SELECT DATABASE() AS db, @@port AS port`;

    if (
      identity.length !== 1 ||
      identity[0].db !== 'edutaktis_onboarding_test' ||
      Number(identity[0].port) !== 3306
    ) {
      throw new Error(
        `Refusing to run: identitas database tidak cocok (${identity[0]?.db ?? 'unknown'}:${identity[0]?.port ?? 'unknown'}).`
      );
    }

    databaseIdentityVerified = true;
    console.log('PASS: database identity verified — edutaktis_onboarding_test');

    const {
      authService,
    } = await import('../src/security/authService');
    const { hashToken } = await import('../src/security/tokens');
    const { sessionRepository } = await import('../src/repositories/sessionRepository');
    const {
      passwordResetRequestRateLimiter,
      passwordResetAttemptRateLimiter,
    } = await import('../src/security/rateLimiter');

    const marker = randomUUID();
  const userId = randomUUID();
  const email = `password-reset-hardening-${marker}@edutaktis.test`;
  const requestIp = '198.51.100.11';
  const sessionIp = '198.51.100.12';
  let createdUser = false;

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        namaLengkap: 'Password Reset Hardening Test',
        passwordHash: null,
        isActive: true,
        emailVerified: true,
      },
    });
    createdUser = true;
    console.log(`Created isolated test user: ${email}`);

    const sessionRaw = `session-${marker}`;
    const sessionHash = hashToken(sessionRaw);
    await sessionRepository.createSession({
      userId,
      tokenHash: sessionHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: sessionIp,
      userAgent: 'PasswordResetHardeningTest/1.0',
    });

    const request = await authService.requestPasswordReset(email, requestIp);
    assert(request.success === true, 'password reset request accepted');
    const rawToken = request.simulatedToken;
    assert(typeof rawToken === 'string' && rawToken.length > 0, 'test-only reset token returned');

    const concurrent = await Promise.all([
      authService.resetPasswordWithToken(rawToken, 'EduTaktis!ConcurrentA2026', '198.51.100.21'),
      authService.resetPasswordWithToken(rawToken, 'EduTaktis!ConcurrentB2026', '198.51.100.22'),
    ]);
    assert(
      concurrent.filter((result) => result.success).length === 1 &&
      concurrent.filter((result) => !result.success).length === 1,
      'concurrent use of the same token: exactly one succeeds',
    );

    const storedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    assert(Boolean(storedToken?.usedAt), 'consumed token has usedAt timestamp');

    const storedSession = await prisma.userSession.findUnique({
      where: { tokenHash: sessionHash },
    });
    assert(Boolean(storedSession?.revokedAt), 'all active sessions revoked after reset');

    const successAuditCount = await prisma.auditLog.count({
      where: { userId, action: 'AUTH_PASSWORD_RESET_SUCCESS' },
    });
    assert(successAuditCount === 1, 'one successful reset audit record exists');

    const reuse = await authService.resetPasswordWithToken(
      rawToken,
      'EduTaktis!ReuseAttempt2026',
      '198.51.100.23',
    );
    assert(reuse.success === false, 'reuse of consumed token rejected');

    const expiredRaw = `expired-${marker}`;
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(expiredRaw),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const expired = await authService.resetPasswordWithToken(
      expiredRaw,
      'EduTaktis!ExpiredAttempt2026',
      '198.51.100.24',
    );
    assert(expired.success === false, 'expired token rejected');

    const invalid = await authService.resetPasswordWithToken(
      `unknown-${marker}`,
      'EduTaktis!InvalidAttempt2026',
      '198.51.100.25',
    );
    assert(invalid.success === false, 'unknown token rejected');

    // Rate limiter implementation locks on the maxAttempts-th registration.
    // Because the service checks the lock result immediately after registration,
    // maxAttempts - 1 requests/attempts are processed; the maxAttempts-th is throttled.
    const requestLimitKey = `test-request-${marker}`;
    let requestThrottle: Awaited<ReturnType<typeof authService.requestPasswordReset>> | undefined;
    for (let i = 0; i < 5; i += 1) {
      requestThrottle = await authService.requestPasswordReset(
        `unknown-${marker}-${i}@edutaktis.test`,
        requestLimitKey,
      );
      if (i < 4) {
        assert(requestThrottle.success === true, `request limiter permits request ${i + 1} of 4`);
      }
    }
    assert(
      requestThrottle?.success === false &&
      typeof requestThrottle.retryAfterSeconds === 'number',
      'request limiter throttles the fifth request (four requests are processed)',
    );

    const attemptLimitKey = `test-attempt-${marker}`;
    let attemptThrottle: Awaited<ReturnType<typeof authService.resetPasswordWithToken>> | undefined;
    for (let i = 0; i < 10; i += 1) {
      attemptThrottle = await authService.resetPasswordWithToken(
        `invalid-limit-${marker}-${i}`,
        'EduTaktis!RateLimitAttempt2026',
        attemptLimitKey,
      );
      if (i < 9) {
        assert(attemptThrottle.success === false, `reset attempt ${i + 1} of 9 is rejected as invalid token`);
        assert(
          typeof attemptThrottle.retryAfterSeconds !== 'number',
          `reset attempt ${i + 1} of 9 is not yet rate-limited`,
        );
      }
    }
    assert(
      attemptThrottle?.success === false &&
      typeof attemptThrottle.retryAfterSeconds === 'number',
      'attempt limiter throttles the tenth attempt (nine attempts are processed)',
    );

    // Explicitly clear test keys from the process-local limiter maps.
    passwordResetRequestRateLimiter.reset(requestLimitKey);
    passwordResetAttemptRateLimiter.reset(attemptLimitKey);

    console.log('\\nAll isolated Password Reset Hardening checks passed.');
  } finally {
    if (databaseIdentityVerified && createdUser) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId, email } });
      console.log('Cleaned up only the uniquely created test user and its dependent records.');
    }
  }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nPassword Reset Hardening test failed:', error);
  process.exitCode = 1;
});
