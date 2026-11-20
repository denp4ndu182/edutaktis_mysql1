
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { prisma } from './onboarding-test-prisma';

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

type QuotaHashFactory =
  typeof import('../src/security/generatorQuotaSecurity').createGeneratorQuotaHash;

let createQuotaHashForTest: QuotaHashFactory | undefined;

let child: ChildProcess | undefined;

type CookieJar = Map<string, string>;

type HttpResult = {
  response: Response;
  body: unknown;
};

function updateCookieJar(
  jar: CookieJar,
  headers: Headers
): void {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const cookies = extendedHeaders.getSetCookie
    ? extendedHeaders.getSetCookie()
    : [];

  for (const cookie of cookies) {
    const pair = cookie.split(';', 1)[0];
    const separator = pair.indexOf('=');

    if (separator <= 0) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    jar.set(name, value);
  }
}

function serializeCookies(jar: CookieJar): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function httpRequest(
  path: string,
  options: RequestInit = {},
  jar?: CookieJar
): Promise<HttpResult> {
  const headers = new Headers(options.headers);

  if (jar && jar.size > 0) {
    headers.set('Cookie', serializeCookies(jar));
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });

  if (jar) {
    updateCookieJar(jar, response.headers);
  }

  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  return { response, body };
}

function getJsonObject(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value),
    'HTTP response harus berupa JSON object.'
  );

  return value as Record<string, unknown>;
}

function getCookie(
  jar: CookieJar,
  name: string
): string {
  const value = jar.get(name);

  assert.ok(value, `Cookie ${name} tidak ditemukan.`);

  return value;
}

type TestAccount = {
  id: string;
  email: string;
  password: string;
  jar: CookieJar;
};

const createdTestEmails = new Map<string, string>();

type QuotaFixture = {
  scope: 'IP' | 'USER';
  keyHash: string;
  windowSeconds: number;
  windowStart: Date;
};

const quotaFixtures: QuotaFixture[] = [];
const quotaFixtureHashes = new Set<string>();

function parseMysqlUtcDateTime(value: string): Date {
  const match =
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\.(\d{1,6})$/.exec(value);

  if (!match) {
    throw new Error('Format DATETIME UTC dari MySQL tidak valid.');
  }

  const milliseconds = match[3].padEnd(3, '0').slice(0, 3);

  const result = new Date(
    `${match[1]}T${match[2]}.${milliseconds}Z`
  );

  if (!Number.isFinite(result.getTime())) {
    throw new Error('Waktu UTC dari MySQL tidak valid.');
  }

  return result;
}

async function getQuotaWindowBounds(
  windowSeconds: number
): Promise<{ windowStart: Date; windowEnd: Date }> {
  assert.ok(
    Number.isSafeInteger(windowSeconds) &&
    windowSeconds >= 1 &&
    windowSeconds <= 31_536_000,
    'Durasi fixed window tidak valid.'
  );

  const rows = await prisma.$queryRaw<
    Array<{
      windowStartUtc: string;
      windowEndUtc: string;
    }>
  >`
    SELECT
      DATE_FORMAT(
        w.window_start,
        '%Y-%m-%d %H:%i:%s.%f'
      ) AS windowStartUtc,
      DATE_FORMAT(
        TIMESTAMPADD(
          SECOND,
          ${windowSeconds},
          w.window_start
        ),
        '%Y-%m-%d %H:%i:%s.%f'
      ) AS windowEndUtc
    FROM (
      SELECT TIMESTAMPADD(
        MICROSECOND,
        FLOOR(
          TIMESTAMPDIFF(
            MICROSECOND,
            CAST(
              '1970-01-01 00:00:00.000000'
              AS DATETIME(6)
            ),
            UTC_TIMESTAMP(3)
          ) / (${windowSeconds} * 1000000)
        ) * (${windowSeconds} * 1000000),
        CAST(
          '1970-01-01 00:00:00.000000'
          AS DATETIME(6)
        )
      ) AS window_start
    ) AS w
  `;

  assert.equal(rows.length, 1);

  return {
    windowStart: parseMysqlUtcDateTime(rows[0].windowStartUtc),
    windowEnd: parseMysqlUtcDateTime(rows[0].windowEndUtc),
  };
}

async function seedQuotaCounter(
  scope: 'IP' | 'USER',
  keyHash: string,
  windowSeconds: number,
  usageCount: number
): Promise<void> {
  assert.match(keyHash, /^[a-f0-9]{64}$/i);

  assert.ok(
  createQuotaHashForTest,
  'Quota hash factory belum diinisialisasi.'
);
  assert.ok(
    Number.isSafeInteger(usageCount) && usageCount >= 0,
    'Nilai usageCount fixture tidak valid.'
  );

  const { windowStart, windowEnd } =
    await getQuotaWindowBounds(windowSeconds);

  const existing = await prisma.generatorUsageCounter.findMany({
    where: { keyHash },
    select: { id: true },
  });

  assert.equal(
    existing.length,
    0,
    'STOP: hash fixture sudah memiliki counter.'
  );

  await prisma.$executeRaw`
    INSERT INTO generator_usage_counters (
      id,
      scope,
      key_hash,
      window_seconds,
      window_start,
      window_end,
      usage_count,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${scope},
      ${keyHash},
      ${windowSeconds},
      ${windowStart},
      ${windowEnd},
      ${usageCount},
      UTC_TIMESTAMP(3),
      UTC_TIMESTAMP(3)
    )
  `;

  quotaFixtures.push({
    scope,
    keyHash,
    windowSeconds,
    windowStart,
  });

  quotaFixtureHashes.add(keyHash);

  console.log(
    `[INFO] Seeded ${scope} quota fixture (${windowSeconds}s).`
  );
}

function createIpFixture(ip: string): string {
  assert.ok(
    createQuotaHashForTest,
    'Quota hash factory belum diinisialisasi.'
  );

  const hash = createQuotaHashForTest('ip', ip);

  assert.match(hash, /^[a-f0-9]{64}$/);

  return hash;
}

function createUserFixture(userId: string): string {
  assert.ok(
    createQuotaHashForTest,
    'Quota hash factory belum diinisialisasi.'
  );

  assert.ok(
    userId.trim().length > 0,
    'User ID fixture tidak boleh kosong.'
  );

  const hash = createQuotaHashForTest('user', userId);

  assert.match(hash, /^[a-f0-9]{64}$/);

  return hash;
}

function verifyIpFixtureIsolation(): void {
  const ips = [
    '192.0.2.10',
    '198.51.100.10',
    '203.0.113.10',
  ];

  const hashes = ips.map(createIpFixture);

  assert.equal(
    new Set(hashes).size,
    ips.length,
    'Hash IP fixture harus unik.'
  );

  console.log('[PASS] IP fixture hashes are unique.');
}

async function cleanupQuotaFixtures(): Promise<void> {
  if (quotaFixtures.length === 0) {
    console.log('[INFO] No quota fixtures to clean.');
    return;
  }

  const expectedHashes = new Set(quotaFixtureHashes);

  await prisma.$transaction(async (tx) => {
    for (const fixture of quotaFixtures) {
      if (!expectedHashes.has(fixture.keyHash)) {
        throw new Error(
          'CLEANUP STOP: hash quota bukan bagian dari fixture.'
        );
      }

      const rows = await tx.generatorUsageCounter.findMany({
        where: {
          scope: fixture.scope,
          keyHash: fixture.keyHash,
          windowSeconds: fixture.windowSeconds,
          windowStart: fixture.windowStart,
        },
      });

      if (rows.length > 1) {
        throw new Error(
          'CLEANUP STOP: ditemukan counter fixture duplikat.'
        );
      }

      await tx.generatorUsageCounter.deleteMany({
        where: {
          scope: fixture.scope,
          keyHash: fixture.keyHash,
          windowSeconds: fixture.windowSeconds,
          windowStart: fixture.windowStart,
        },
      });

      const remaining = await tx.generatorUsageCounter.count({
        where: {
          scope: fixture.scope,
          keyHash: fixture.keyHash,
          windowSeconds: fixture.windowSeconds,
          windowStart: fixture.windowStart,
        },
      });

      if (remaining !== 0) {
        throw new Error(
          'CLEANUP FAILED: counter quota fixture masih tersisa.'
        );
      }
    }
  });

  quotaFixtures.length = 0;
  quotaFixtureHashes.clear();

  console.log('[PASS] Quota fixture cleanup verified.');
}

const TEST_PASSWORD = 'B12HttpTest2026!';

async function getCsrfToken(jar: CookieJar): Promise<string> {
  const result = await httpRequest('/api/auth/csrf', {}, jar);

  assert.equal(
    result.response.status,
    200,
    'Endpoint CSRF harus merespons HTTP 200.'
  );

  const body = getJsonObject(result.body);
  const token = body.csrfToken;

  if (typeof token !== 'string' || token.length === 0) {
  throw new Error('csrfToken harus berupa string dan tidak boleh kosong.');
}

assert.ok(
  jar.has('edutaktis_csrf'),
  'Cookie edutaktis_csrf harus diterbitkan.'
);

return token;
}

async function registerTestAccount(
  suffix: string
): Promise<TestAccount> {
  const uniqueId = globalThis.crypto.randomUUID();
  
const email = `b12-http-test-${uniqueId}@example.test`;
const expectedName = `B12 HTTP Test ${suffix}`;

createdTestEmails.set(email, expectedName);

const password = TEST_PASSWORD;

  const jar: CookieJar = new Map();

  const csrfToken = await getCsrfToken(jar);

  const result = await httpRequest(
    '/api/auth/register',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        namaLengkap: expectedName,
        email,
        password,
      }),
    },
    jar
  );

  assert.equal(
    result.response.status,
    201,
    `Registrasi akun ${suffix} gagal: ${JSON.stringify(result.body)}`
  );

  const body = getJsonObject(result.body);
  const user = getJsonObject(body.user);

  assert.equal(body.success, true);
  assert.equal(user.email, email);
  assert.equal(typeof user.id, 'string');

  getCookie(jar, 'edutaktis_session');
  getCookie(jar, 'edutaktis_csrf');

  return {
    id: user.id as string,
    email,
    password,
    jar,
  };
}

async function loginTestAccount(
  account: TestAccount
): Promise<TestAccount> {
  const jar: CookieJar = new Map();
  const csrfToken = await getCsrfToken(jar);

  const result = await httpRequest(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    },
    jar
  );

  assert.equal(
    result.response.status,
    200,
    `Login akun pengujian gagal: ${JSON.stringify(result.body)}`
  );

  const body = getJsonObject(result.body);

  assert.equal(body.success, true);

  const user = getJsonObject(body.user);
  assert.equal(user.id, account.id);

  getCookie(jar, 'edutaktis_session');
  getCookie(jar, 'edutaktis_csrf');

  return {
    ...account,
    jar,
  };
}

async function testUnauthenticatedGenerator(): Promise<void> {
  const result = await httpRequest(
    '/api/generate-document',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  assert.equal(
    result.response.status,
    401,
    'Generator harus menolak request tanpa autentikasi.'
  );

  console.log('[PASS] Unauthenticated generator request rejected.');
}

async function testCsrfProtection(
  account: TestAccount
): Promise<void> {
  const sessionToken = getCookie(
    account.jar,
    'edutaktis_session'
  );

  // Kasus 1: CSRF cookie dan header tidak tersedia.
  const missingCsrfJar: CookieJar = new Map([
    ['edutaktis_session', sessionToken],
  ]);

  const missingResult = await httpRequest(
    '/api/generate-document',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
    missingCsrfJar
  );

  assert.equal(
    missingResult.response.status,
    403,
    'Request tanpa token CSRF harus ditolak.'
  );

  console.log('[PASS] Missing CSRF token rejected.');

  // Kasus 2: CSRF cookie dan header berisi token palsu.
  const invalidCsrfJar: CookieJar = new Map([
    ['edutaktis_session', sessionToken],
    ['edutaktis_csrf', 'invalid.invalid'],
  ]);

  const invalidResult = await httpRequest(
    '/api/generate-document',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'invalid.invalid',
      },
      body: JSON.stringify({}),
    },
    invalidCsrfJar
  );

  assert.equal(
    invalidResult.response.status,
    403,
    'Request dengan signature CSRF tidak valid harus ditolak.'
  );

  console.log('[PASS] Invalid CSRF signature rejected.');

  // Kasus 3: Token valid tetapi Origin tidak sesuai.
  const originJar: CookieJar = new Map(account.jar);

  const validCsrfToken = getCookie(
    originJar,
    'edutaktis_csrf'
  );

  const originResult = await httpRequest(
    '/api/generate-document',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': validCsrfToken,
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({}),
    },
    originJar
  );

  assert.equal(
    originResult.response.status,
    403,
    'Request dari Origin yang tidak sesuai harus ditolak.'
  );

  console.log('[PASS] Invalid Origin rejected.');
}

async function cleanupTestAccounts(): Promise<void> {
  const accounts = Array.from(createdTestEmails.entries());

  if (accounts.length === 0) {
    console.log('[INFO] No test accounts require cleanup.');
    return;
  }

  for (const [email, expectedName] of accounts) {
    assert.match(
      email,
      /^b12-http-test-[0-9a-f-]+@example\.test$/i,
      'Cleanup menolak email di luar pola akun pengujian.'
    );

    assert.match(
      expectedName,
      /^B12 HTTP Test [A-Z0-9_-]{1,32}$/,
      'Cleanup menolak nama akun di luar pola fixture.'
    );
  }

  const emails = accounts.map(([email]) => email);

  await prisma.$transaction(async (tx) => {
    for (const email of emails) {
      const user = await tx.user.findUnique({
        where: { email },
         select: {
        id: true,
        email: true,
        namaLengkap: true,
        },
      });

      if (!user) continue;

      const expectedName = createdTestEmails.get(user.email);

if (
  !expectedName ||
  user.email !== email ||
  user.namaLengkap !== expectedName
) {
  throw new Error(
    'CLEANUP STOP: identitas User tidak cocok dengan fixture.'
  );
}

      await tx.project.deleteMany({
        where: { userId: user.id },
      });

      await tx.institutionRequest.deleteMany({
        where: { requesterUserId: user.id },
      });

      await tx.institutionMembership.deleteMany({
        where: { userId: user.id },
      });

      await tx.auditLog.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.delete({
        where: {
          id: user.id,
          email: user.email,
        },
      });
    }
  });

  const remaining = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });

  assert.equal(
    remaining.length,
    0,
    'Cleanup gagal: masih ditemukan akun pengujian.'
  );

  createdTestEmails.clear();
  console.log(`[PASS] Cleaned ${emails.length} test account(s).`);
}

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

       process.env.SESSION_SECRET = sessionSecret;
      process.env.GENERATOR_QUOTA_SECRET = quotaSecret;

    const quotaSecurity = await import(
    '../src/security/generatorQuotaSecurity'
      );

     quotaSecurity.validateGeneratorQuotaSecret();

     createQuotaHashForTest =
     quotaSecurity.createGeneratorQuotaHash;

    verifyIpFixtureIsolation();

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(PORT),
    SESSION_SECRET: sessionSecret,
    GENERATOR_QUOTA_SECRET: quotaSecret,
    GEMINI_API_KEY: '',
    TRUST_PROXY: '1',
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

  // A. Request tanpa login harus ditolak.
  await testUnauthenticatedGenerator();

  // B. Registrasi dan login akun A.
  const accountA = await registerTestAccount('A');
  const authenticatedA = await loginTestAccount(accountA);

  // C. Uji tiga skenario proteksi CSRF.
  await testCsrfProtection(authenticatedA);

  // D. Registrasi dan login akun B.  
  const accountB = await registerTestAccount('B');
  await loginTestAccount(accountB);

  console.log('[PASS] Two isolated test accounts registered and authenticated.');

  // E. Hentikan server sebelum cleanup database.
  await stopServer(child);


  console.log('');
  console.log('B12 PATCH 02-03B-08B RESULT: PASS');
  console.log('Authentication, CSRF protection, and account cleanup verified.');
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
  let cleanupFailed = false;
  let serverStopped =
    !child ||
    child.exitCode !== null ||
    child.signalCode !== null;

  // 1. Hentikan HTTP test server sebelum membersihkan database.
  if (child && !serverStopped) {
    console.log('[INFO] Cleaning up test server.');

    const serverProcess = child;

    const waitForExit = async (
      timeoutMs: number
    ): Promise<boolean> => {
      if (
        serverProcess.exitCode !== null ||
        serverProcess.signalCode !== null
      ) {
        return true;
      }

      return Promise.race([
        new Promise<boolean>((resolve) => {
          serverProcess.once('exit', () => resolve(true));
        }),
        delay(timeoutMs).then(() => false),
      ]);
    };

    try {
      serverProcess.kill('SIGTERM');

      serverStopped = await waitForExit(5_000);

      if (!serverStopped) {
        console.warn('[WARN] SIGTERM timeout. Sending SIGKILL.');
        serverProcess.kill('SIGKILL');
        serverStopped = await waitForExit(5_000);
      }
    } catch (error) {
      console.error(
        '[ERROR] Server shutdown:',
        error instanceof Error ? error.message : 'Unknown error.'
      );
      cleanupFailed = true;
    }

    serverStopped =
      serverStopped ||
      serverProcess.exitCode !== null ||
      serverProcess.signalCode !== null;

    if (!serverStopped) {
      console.error(
        '[ERROR] Test server masih berjalan. Database cleanup dilewati untuk mencegah race condition.'
      );
      cleanupFailed = true;
    }
  }

  // 2. Cleanup database hanya setelah server berhenti.
  if (serverStopped) {
    try {
      await cleanupQuotaFixtures();
    } catch (error) {
      console.error(
        '[ERROR] Quota fixture cleanup:',
        error instanceof Error ? error.message : 'Unknown error.'
      );
      cleanupFailed = true;
    }

    try {
      if (createdTestEmails.size > 0) {
        await cleanupTestAccounts();
      }
    } catch (error) {
      console.error(
        '[ERROR] Test account cleanup:',
        error instanceof Error ? error.message : 'Unknown error.'
      );
      cleanupFailed = true;
    }
  }

  // 3. Disconnect tetap dicoba meskipun cleanup sebelumnya gagal.
  try {
    await prisma.$disconnect();
    console.log('[PASS] Prisma disconnected.');
  } catch (error) {
    console.error(
      '[ERROR] Prisma disconnect:',
      error instanceof Error ? error.message : 'Unknown error.'
    );
    cleanupFailed = true;
  }

  if (cleanupFailed) {
    process.exitCode = 1;
  }
}
