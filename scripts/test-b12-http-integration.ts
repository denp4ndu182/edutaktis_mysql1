
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from './onboarding-test-prisma';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

let child: ChildProcess | undefined;

function assertDatabaseUrl(): void {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('STOP: DATABASE_URL tidak tersedia.');
  }

  const url = new URL(rawUrl);

  if (
    url.hostname !== '127.0.0.1' ||
    url.port !== '3307' ||
    url.pathname !== '/edutaktis_onboarding_test'
  ) {
    throw new Error(
      'STOP: Database URL bukan database onboarding test yang diizinkan.'
    );
  }
}

async function verifyDatabaseIdentity(): Promise<void> {
  const rows = await prisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  if (
    rows[0]?.db !== 'edutaktis_onboarding_test' ||
    Number(rows[0]?.port) !== 3306
  ) {
    throw new Error('STOP: Identitas database tidak sesuai.');
  }

  console.log(
    '[PASS] Database verified:',
    rows[0].db,
    'internal port:',
    Number(rows[0].port)
  );
}

async function waitForServer(
  process: ChildProcess
): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let spawnError: Error | undefined;

  process.once('error', (error) => {
    spawnError = error;
  });

  while (Date.now() < deadline) {
    if (spawnError) {
      throw spawnError;
    }

  if (
  process.exitCode !== null ||
  process.signalCode !== null
) {
  throw new Error(
    `Server exited before readiness. Exit code: ${process.exitCode}, signal: ${process.signalCode}`
  );
}

    try {
      const response = await fetch(`${BASE_URL}/api/auth/csrf`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.status === 200) {
        const body = await response.json() as {
          success?: boolean;
          csrfToken?: string;
        };

        if (
          body.success === true &&
          typeof body.csrfToken === 'string' &&
          body.csrfToken.length > 0
        ) {
          console.log('[PASS] HTTP server is ready.');
          console.log('[PASS] CSRF endpoint responds correctly.');
          return;
        }
      }
    } catch {
      // Server may still be starting.
    }

    await delay(500);
  }

  throw new Error(
    `Server startup timeout after ${STARTUP_TIMEOUT_MS} ms.`
  );
}

async function stopServer(
  process: ChildProcess
): Promise<void> {
  if (
    process.exitCode !== null ||
    process.signalCode !== null
  ) {
    if (process.exitCode !== 0) {
      throw new Error(
        `Server exited unexpectedly: ${process.exitCode}`
      );
    }

    return;
  }

  console.log('[INFO] Sending SIGTERM to test server.');

  const exitPromise = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    process.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });

  process.kill('SIGTERM');

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Graceful shutdown timeout.'));
    }, SHUTDOWN_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      exitPromise,
      timeoutPromise,
    ]);

    if (result.code !== 0) {
      throw new Error(
        `Server shutdown failed. Exit code: ${result.code}, signal: ${result.signal}`
      );
    }

    console.log('[PASS] Server stopped gracefully.');
  } catch (error) {
    process.kill('SIGKILL');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  assertDatabaseUrl();
  await verifyDatabaseIdentity();

  const sessionSecret = randomBytes(48).toString('hex');
  const quotaSecret = randomBytes(48).toString('hex');

  if (sessionSecret === quotaSecret) {
    throw new Error('STOP: Test secrets must be independent.');
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(PORT),
    SESSION_SECRET: sessionSecret,
    GENERATOR_QUOTA_SECRET: quotaSecret,
    GEMINI_API_KEY: '',
    TRUST_PROXY: 'false',
    DISABLE_TRUST_PROXY: '1',
    ALLOW_SIMULATED_RESET_TOKEN: 'false',
  };

  console.log('[INFO] Starting isolated HTTP test server.');
  console.log(`[INFO] Test port: ${PORT}`);
  console.log('[INFO] Gemini disabled; deterministic fallback only.');

  child = spawn(
    process.execPath,
    ['--import', 'tsx', 'server.ts'],
    {
      cwd: process.cwd(),
      env: childEnv,
      stdio: 'inherit',
    }
  );

  await waitForServer(child);
  await stopServer(child);

  console.log('');
  console.log('B12 PATCH 01 RESULT: PASS');
  console.log('Database preflight, HTTP readiness, and shutdown verified.');
}

try {
  await main();
} catch (error) {
  console.error('');
  console.error('B12 PATCH 01 RESULT: FAIL');
  console.error(
    error instanceof Error ? error.message : 'Unknown test error.'
  );

  process.exitCode = 1;
} finally {
  if (
    child &&
    child.exitCode === null &&
    child.signalCode === null
  ) {
    console.log('[INFO] Cleaning up test server.');

    const exitPromise = new Promise<void>((resolve) => {
      child!.once('exit', () => resolve());
    });

    child.kill('SIGTERM');

    let exited = await Promise.race([
      exitPromise.then(() => true),
      delay(5_000).then(() => false),
    ]);

    if (!exited) {
      console.warn('[WARN] SIGTERM timeout. Sending SIGKILL.');
      child.kill('SIGKILL');

      exited = await Promise.race([
        exitPromise.then(() => true),
        delay(5_000).then(() => false),
      ]);
    }

    if (!exited) {
      console.error(
        '[ERROR] Test server did not exit after SIGKILL.'
      );
      process.exitCode = 1;
    }
  }

  await prisma.$disconnect();
}
