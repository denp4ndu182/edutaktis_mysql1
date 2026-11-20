import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.onboarding-test');
const SERVER_PORT = 43104;
const BASE_URL = `http://127.0.0.1:${SERVER_PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;

let fixture: Awaited<
  ReturnType<typeof import('./fixture-b04-tenant').createB04TenantFixture>
> | undefined;

let prisma:
  | (typeof import('./onboarding-test-prisma'))['prisma']
  | undefined;

let child: ChildProcess | undefined;
let childExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;
let cleanupFailed = false;
let passed = 0;

const failures: string[] = [];
let serverOutput = '';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
  passed++;
  console.log(`PASS ${passed}: ${message}`);
}

function recordFailure(message: string): void {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function validateEnvironment(): {
  databaseUrl: string;
  password: string;
} {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error('.env.onboarding-test tidak ditemukan.');
  }

  const config = dotenv.parse(fs.readFileSync(ENV_PATH));

  if (config.MYSQL_DATABASE !== 'edutaktis_onboarding_test') {
    throw new Error('Database pengujian tidak sesuai. Proses dihentikan.');
  }

  if (!config.MYSQL_USER || !config.MYSQL_PASSWORD) {
    throw new Error('Konfigurasi MySQL pengujian tidak lengkap.');
  }

  const password = config.B04_TEST_PASSWORD;

  if (
    !password ||
    password.length < 12 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new Error('B04_TEST_PASSWORD belum memenuhi persyaratan.');
  }

  const credentials =
    `${encodeURIComponent(config.MYSQL_USER)}:${encodeURIComponent(config.MYSQL_PASSWORD)}`;

  const databaseUrl =
    `mysql://${credentials}@127.0.0.1:3307/edutaktis_onboarding_test`;

  return { databaseUrl, password };
}

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => {
      probe.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

function appendServerOutput(chunk: Buffer | string): void {
  serverOutput += chunk.toString();

  if (serverOutput.length > 12_000) {
    serverOutput = serverOutput.slice(-12_000);
  }
}

async function startTestServer(databaseUrl: string): Promise<void> {
  await assertPortAvailable(SERVER_PORT);

  const tsxCli = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');

  if (!fs.existsSync(tsxCli)) {
    throw new Error('tsx CLI tidak ditemukan. Server tidak dijalankan.');
  }

  child = spawn(
    process.execPath,
    [tsxCli, 'server.ts'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'test',
        PORT: String(SERVER_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout?.on('data', appendServerOutput);
  child.stderr?.on('data', appendServerOutput);

  childExit = new Promise((resolve) => {
    child!.once('exit', (code, signal) => resolve({ code, signal }));
  });

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const exited = await Promise.race([
      childExit.then((result) => ({ exited: true as const, result })),
      delay(250).then(() => ({ exited: false as const })),
    ]);

    if (exited.exited) {
      throw new Error(
        `Server berhenti sebelum siap. Exit code: ${exited.result.code}.`
      );
    }

    try {
      const response = await fetch(`${BASE_URL}/api/auth/csrf`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) {
        console.log('SERVER READY: endpoint CSRF merespons.');
        return;
      }
    } catch {
      // Server belum siap. Lanjutkan polling dengan batas waktu.
    }
  }

  throw new Error('Server tidak siap dalam batas waktu 30 detik.');
}

async function stopTestServer(): Promise<void> {
  if (!child || !childExit) return;

  const current = child;

  if (current.exitCode !== null || current.signalCode !== null) {
    await childExit;
    return;
  }

  current.kill('SIGTERM');

  const stopped = await Promise.race([
    childExit.then(() => true),
    delay(15_000).then(() => false),
  ]);

  if (!stopped) {
    console.error('Server tidak berhenti dalam 15 detik. Mengirim SIGKILL.');
    current.kill('SIGKILL');
    await childExit;
  }

  const result = await childExit;

  if (result.code !== 0) {
    throw new Error(
      `Server berhenti dengan exit code ${result.code}, signal ${result.signal}.`
    );
  }

  console.log('SERVER STOPPED: graceful shutdown berhasil.');
}

type JsonResponse = {
  status: number;
  body: any;
  setCookies: string[];
};

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response): void {
    for (const item of response.headers.getSetCookie()) {
      const pair = item.split(';', 1)[0];
      const separator = pair.indexOf('=');

      if (separator < 1) continue;

      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

async function request(
  method: string,
  endpoint: string,
  options: {
    jar?: CookieJar;
    csrfToken?: string;
    institutionId?: string;
    body?: unknown;
    origin?: string;
  } = {}
): Promise<JsonResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'EduTaktis-B04-Integration-Test',
  };

  if (options.jar) {
    headers.Cookie = options.jar.header();
  }

  if (options.csrfToken !== undefined) {
    headers['X-CSRF-Token'] = options.csrfToken;
  }

  if (options.institutionId !== undefined) {
    headers['X-Institution-Id'] = options.institutionId;
  }

  if (options.origin !== undefined) {
    headers.Origin = options.origin;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });

  options.jar?.absorb(response);

  let body: any;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    body,
    setCookies: response.headers.getSetCookie(),
  };
}

async function runTests(
  email: string,
  password: string,
  institutionAId: string,
  institutionBId: string
): Promise<void> {
  const anonymous = await request('GET', '/api/auth/me');

  assert(
    anonymous.status === 401 &&
      anonymous.body?.code === 'UNAUTHENTICATED',
    'Permintaan tanpa sesi ditolak (401).'
  );

  const jar = new CookieJar();

  const csrf = await request('GET', '/api/auth/csrf', { jar });

  assert(
    csrf.status === 200 &&
      csrf.body?.success === true &&
      typeof csrf.body?.csrfToken === 'string' &&
      jar.has('edutaktis_csrf'),
    'Endpoint CSRF menyediakan token dan cookie.'
  );

  let csrfToken = csrf.body.csrfToken as string;

  const login = await request('POST', '/api/auth/login', {
    jar,
    csrfToken,
    origin: BASE_URL,
    body: { email, password },
  });

  assert(
    login.status === 200 && login.body?.success === true,
    'Login fixture berhasil.'
  );

  assert(
    jar.has('edutaktis_session') &&
      jar.has('edutaktis_csrf'),
    'Cookie sesi dan CSRF diterbitkan setelah login.'
  );

  csrfToken = login.body.csrfToken;

  assert(
    typeof csrfToken === 'string' &&
      jar.header().includes(`edutaktis_csrf=${csrfToken}`),
    'Token CSRF respons login cocok dengan cookie.'
  );

  const defaultTenant = await request('GET', '/api/auth/me', { jar });

  assert(
    defaultTenant.status === 200 &&
      defaultTenant.body?.tenantContext?.currentInstitution?.id === institutionAId,
    'Tenant default mengarah ke institusi A.'
  );

  const switchB = await request(
    'POST',
    '/api/tenant/switch-institution',
    {
      jar,
      csrfToken,
      origin: BASE_URL,
      body: { institutionId: institutionBId },
    }
  );

  assert(
    switchB.status === 200 &&
      switchB.body?.success === true &&
      switchB.body?.activeInstitutionId === institutionBId &&
      switchB.body?.currentInstitution?.id === institutionBId,
    'Pergantian tenant ke institusi B berhasil.'
  );

  const tenantB = await request('GET', '/api/auth/me', {
    jar,
    institutionId: institutionBId,
  });

  assert(
    tenantB.status === 200 &&
      tenantB.body?.tenantContext?.currentInstitution?.id === institutionBId,
    'Auth/me memuat tenant B ketika ID B dikirim.'
  );

  const unknownId = randomUUID();

  const unknownTenant = await request('GET', '/api/auth/me', {
    jar,
    institutionId: unknownId,
  });

  assert(
    unknownTenant.status === 403 &&
      unknownTenant.body?.code === 'TENANT_FORBIDDEN',
    'Tenant yang tidak memiliki membership ditolak (403).'
  );

  const blankHeader = await request('GET', '/api/auth/me', {
    jar,
    institutionId: '',
  });

  assert(
    blankHeader.status === 400 &&
      blankHeader.body?.code === 'INVALID_INSTITUTION_ID',
    'Header tenant kosong ditolak (400).'
  );

  const invalidSwitch = await request(
    'POST',
    '/api/tenant/switch-institution',
    {
      jar,
      csrfToken,
      origin: BASE_URL,
      body: { institutionId: unknownId },
    }
  );

  assert(
    invalidSwitch.status === 403 &&
      invalidSwitch.body?.code === 'TENANT_FORBIDDEN',
    'Pergantian ke tenant tanpa membership ditolak (403).'
  );

  const missingCsrf = await request(
    'POST',
    '/api/tenant/switch-institution',
    {
      jar,
      origin: BASE_URL,
      body: { institutionId: institutionAId },
    }
  );

  assert(
    missingCsrf.status === 403 &&
      missingCsrf.body?.code === 'CSRF_TOKEN_MISSING',
    'POST tanpa header CSRF ditolak (403).'
  );

  const contextB = await request('GET', '/api/tenant/context', {
    jar,
    institutionId: institutionBId,
  });

  assert(
    contextB.status === 200 &&
      contextB.body?.context?.currentInstitution?.id === institutionBId,
    'Tenant context menerima membership aktif B.'
  );

  const contextUnknown = await request('GET', '/api/tenant/context', {
    jar,
    institutionId: unknownId,
  });

  assert(
    contextUnknown.status === 403 &&
      contextUnknown.body?.code === 'TENANT_FORBIDDEN',
    'Tenant context menolak membership yang tidak sah.'
  );
}

async function main(): Promise<void> {
  console.log('=== B-04 TENANT HTTP INTEGRATION TEST ===');
  console.log('Database target: edutaktis_onboarding_test');
  console.log(`Test server port: ${SERVER_PORT}`);

  const { databaseUrl, password } = validateEnvironment();

  await assertPortAvailable(SERVER_PORT);

  // The helper independently validates database identity and MySQL port.
  const dbModule = await import('./onboarding-test-prisma');
  prisma = dbModule.prisma;

  const fixtureModule = await import('./fixture-b04-tenant');

  try {
    fixture = await fixtureModule.createB04TenantFixture(
      prisma,
      password
    );

    console.log('FIXTURE CREATED: dua institusi dan dua membership aktif.');

    await startTestServer(databaseUrl);

    await runTests(
      fixture.email,
      password,
      fixture.institutionAId,
      fixture.institutionBId
    );
  } finally {
    try {
      await stopTestServer();
    } catch (error) {
      cleanupFailed = true;
      recordFailure(
        `Server shutdown gagal: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    if (fixture && prisma) {
      try {
        await fixtureModule.cleanupB04TenantFixture(prisma, fixture);
        console.log('FIXTURE CLEANUP: berhasil.');
      } catch (error) {
        cleanupFailed = true;
        recordFailure(
          `Fixture cleanup gagal: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
      }
    }

    if (prisma) {
      try {
        await prisma.$disconnect();
        console.log('TEST DATABASE DISCONNECTED.');
      } catch {
        cleanupFailed = true;
        recordFailure('Prisma disconnect gagal.');
      }
    }
  }

  if (failures.length > 0 || cleanupFailed) {
    throw new Error(
      `B-04 HTTP TEST FAILED. Passed: ${passed}. Failures: ${failures.length}.`
    );
  }

  console.log('');
  console.log('======================================');
  console.log(`B-04 HTTP TEST PASSED: ${passed} assertions.`);
  console.log('Fixture sudah dibersihkan.');
  console.log('Tidak ada perubahan skema database.');
  console.log('======================================');
}

main().catch((error: unknown) => {
  console.error(
    'B-04 HTTP TEST STOPPED:',
    error instanceof Error ? error.message : 'Unknown error'
  );

  if (serverOutput) {
    console.error('SERVER OUTPUT (last lines):');
    console.error(serverOutput.split('\n').slice(-35).join('\n'));
  }

  process.exitCode = 1;
});
