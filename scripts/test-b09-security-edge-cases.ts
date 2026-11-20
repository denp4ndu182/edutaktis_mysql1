import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import {
  InstitutionRole,
  MembershipStatus,
  InstitutionRequestStatus,
} from '@prisma/client';
import { hashPassword } from '../src/security/password';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.onboarding-test');
const PORT = 43109;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PREFIX = `B09-${randomUUID()}`;

type TestUser = {
  email: string;
  jar: CookieJar;
  csrfToken: string;
};

type HttpResult = {
  status: number;
  body: any;
};

let prisma: any;
let child: ChildProcess | undefined;
let childExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }> | undefined;

let fixtureReady = false;
let serverStopVerified = false;
let passed = 0;
let failed = 0;

const userIds: string[] = [];
const institutionIds: string[] = [];
const membershipIds: string[] = [];
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

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uniqueNpsn(): string {
  return randomInt(0, 10_000_000_000_000).toString().padStart(13, '0');
}

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response): void {
    for (const item of response.headers.getSetCookie()) {
      const pair = item.split(';', 1)[0];
      const index = pair.indexOf('=');
      if (index < 1) continue;

      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);

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
    user?: TestUser;
    institutionId?: string;
    csrf?: boolean;
    origin?: string;
    body?: unknown;
  } = {}
): Promise<HttpResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'EduTaktis-B09-HTTP-Regression',
  };

  if (options.user) headers.Cookie = options.user.jar.header();
  if (options.csrf && options.user) {
    headers['X-CSRF-Token'] = options.user.csrfToken;
  }
  if (options.institutionId) {
    headers['X-Institution-Id'] = options.institutionId;
  }
  if (options.origin !== undefined) headers.Origin = options.origin;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });

  options.user?.jar.absorb(response);

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // Respons bukan JSON.
  }

  return { status: response.status, body };
}

async function loginUser(email: string, password: string): Promise<TestUser> {
  const jar = new CookieJar();

  const bootstrapResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'EduTaktis-B09-HTTP-Regression',
    },
    signal: AbortSignal.timeout(10_000),
  });

  jar.absorb(bootstrapResponse);
  const bootstrapBody = await bootstrapResponse.json().catch(() => null);

  requireCondition(
    bootstrapResponse.status === 200 &&
    typeof bootstrapBody?.csrfToken === 'string' &&
    jar.has('edutaktis_csrf'),
    'Bootstrap CSRF gagal: token atau cookie tidak ditemukan.'
  );

  const bootstrapToken = bootstrapBody.csrfToken;

  requireCondition(
    jar.header().includes(`edutaktis_csrf=${bootstrapToken}`),
    'Token CSRF bootstrap tidak cocok dengan cookie.'
  );

  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      Cookie: jar.header(),
      'X-CSRF-Token': bootstrapToken,
      'User-Agent': 'EduTaktis-B09-HTTP-Regression',
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });

  jar.absorb(loginResponse);
  const loginBody = await loginResponse.json().catch(() => null);

  requireCondition(
    loginResponse.status === 200 &&
    loginBody?.success === true &&
    jar.has('edutaktis_session') &&
    jar.has('edutaktis_csrf'),
    `Login fixture gagal: ${email}`
  );

  requireCondition(
    typeof loginBody.csrfToken === 'string' &&
    jar.header().includes(`edutaktis_csrf=${loginBody.csrfToken}`),
    'Rotasi token CSRF setelah login tidak valid.'
  );

  return { email, jar, csrfToken: loginBody.csrfToken };
}

async function assertPortAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(PORT, '127.0.0.1', () => {
      probe.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function startServer(databaseUrl: string): Promise<void> {
  await assertPortAvailable();

  const cli = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
  requireCondition(fs.existsSync(cli), 'tsx CLI tidak ditemukan.');

  child = spawn(process.execPath, [cli, 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });
  child.stderr?.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });

  childExit = new Promise((resolve) => {
    child!.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await new Promise<void>((resolve, reject) => {
    child!.once('spawn', resolve);
    child!.once('error', reject);
  });

  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const exit = await Promise.race([
      childExit.then((result) => ({ exited: true as const, result })),
      delay(250).then(() => ({ exited: false as const })),
    ]);

    if (exit.exited) {
      throw new Error(`Server berhenti sebelum siap: ${JSON.stringify(exit.result)} ${output}`);
    }

    try {
      const response = await fetch(`${BASE_URL}/api/auth/csrf`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        console.log('SERVER READY.');
        return;
      }
    } catch {
      // Server belum siap.
    }
  }

  throw new Error(`Server tidak siap dalam 30 detik. ${output}`);
}

async function stopServer(): Promise<void> {
  if (!child || !childExit) {
    serverStopVerified = true;
    return;
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
  }

  const result = await Promise.race([
    childExit,
    delay(15_000).then(() => null),
  ]);

  if (!result) {
    child.kill('SIGKILL');
    throw new Error('Server timeout. Cleanup fixture ditahan.');
  }

  if (result.code !== 0 || result.signal !== null) {
    throw new Error(`Server berhenti tidak normal: ${result.code}/${result.signal}.`);
  }

  serverStopVerified = true;
  console.log('SERVER STOPPED.');
}

async function createFixture(password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  const definitions = [
    { key: 'admin-a', role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { key: 'admin-b', role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { key: 'teacher-a', role: InstitutionRole.TEACHER, status: MembershipStatus.ACTIVE },
    { key: 'member-approve', role: InstitutionRole.TEACHER, status: MembershipStatus.PENDING },
    { key: 'member-reject', role: InstitutionRole.OPERATOR, status: MembershipStatus.PENDING },
    { key: 'platform-admin', role: InstitutionRole.SUPER_ADMIN, status: MembershipStatus.ACTIVE },
    { key: 'onboard-approve', role: null, status: null },
    { key: 'onboard-reject', role: null, status: null },
    { key: 'reviewer-inactive', role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { key: 'reviewer-membership-inactive', role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.INACTIVE },
    { key: 'member-rollback', role: InstitutionRole.TEACHER, status: MembershipStatus.PENDING },
    { key: 'onboard-rollback', role: null, status: null },
  ];

  const users = definitions.map((item) => ({
    id: randomUUID(),
    email: `${PREFIX}-${item.key}@b09.invalid`,
    namaLengkap: `${PREFIX} ${item.key}`,
    passwordHash,
    isActive: true,
    emailVerified: true,
  }));

  const institutionA = {
    id: randomUUID(),
    npsn: uniqueNpsn(),
    namaResmi: `${PREFIX} Institution A`,
    namaSingkat: `${PREFIX} A`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis B09 A',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  };

  const institutionB = {
    id: randomUUID(),
    npsn: uniqueNpsn(),
    namaResmi: `${PREFIX} Institution B`,
    namaSingkat: `${PREFIX} B`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis B09 B',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  };

  const memberships = [
    { id: randomUUID(), userId: users[0].id, institutionId: institutionA.id, role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { id: randomUUID(), userId: users[1].id, institutionId: institutionB.id, role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { id: randomUUID(), userId: users[2].id, institutionId: institutionA.id, role: InstitutionRole.TEACHER, status: MembershipStatus.ACTIVE },
    { id: randomUUID(), userId: users[3].id, institutionId: institutionA.id, role: InstitutionRole.TEACHER, status: MembershipStatus.PENDING },
    { id: randomUUID(), userId: users[4].id, institutionId: institutionA.id, role: InstitutionRole.OPERATOR, status: MembershipStatus.PENDING },
    { id: randomUUID(), userId: users[5].id, institutionId: institutionA.id, role: InstitutionRole.SUPER_ADMIN, status: MembershipStatus.ACTIVE },
    { id: randomUUID(), userId: users[8].id, institutionId: institutionA.id, role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.ACTIVE },
    { id: randomUUID(), userId: users[9].id, institutionId: institutionA.id, role: InstitutionRole.SCHOOL_ADMIN, status: MembershipStatus.INACTIVE },
    { id: randomUUID(), userId: users[10].id, institutionId: institutionA.id, role: InstitutionRole.TEACHER, status: MembershipStatus.PENDING },
  ];

  const requests = [6, 7, 11].map((index) => ({
    id: randomUUID(),
    requesterUserId: users[index].id,
    npsn: uniqueNpsn(),
    namaResmi: `${PREFIX} Request ${index}`,
    namaSingkat: `${PREFIX} Req ${index}`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: `Alamat sintetis B09 ${index}`,
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
    status: InstitutionRequestStatus.PENDING_REVIEW,
  }));

  await prisma.$transaction(async (tx: any) => {
    await tx.user.createMany({ data: users });
    await tx.institution.createMany({ data: [institutionA, institutionB] });
    await tx.institutionMembership.createMany({ data: memberships });
    await tx.institutionRequest.createMany({ data: requests });
  });

  users.forEach((item) => userIds.push(item.id));
  [institutionA, institutionB].forEach((item) => institutionIds.push(item.id));
  memberships.forEach((item) => membershipIds.push(item.id));
  requests.forEach((item) => requestIds.push(item.id));

  Object.assign(fixture, {
    users,
    institutions: [institutionA, institutionB],
    memberships,
    requests,
  });

  fixtureReady = true;
  console.log('B09 FIXTURE CREATED.');
}

async function cleanupFixture(): Promise<void> {
  if (!prisma || !fixtureReady) return;
  if (!serverStopVerified) {
    throw new Error('Cleanup ditahan: server belum dipastikan berhenti normal.');
  }

  await prisma.$transaction(async (tx: any) => {
    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, namaLengkap: true },
    });

    if (
      users.length !== userIds.length ||
      users.some((user: any) =>
        !user.email.startsWith(`${PREFIX}-`) ||
        !user.namaLengkap.startsWith(PREFIX)
      )
    ) {
      throw new Error('Cleanup dihentikan: identitas user fixture tidak cocok.');
    }

    const requests = await tx.institutionRequest.findMany({
      where: { id: { in: requestIds } },
      select: {
        id: true,
        requesterUserId: true,
        npsn: true,
        namaResmi: true,
        status: true,
        institutionId: true,
      },
    });

    if (
      requests.length !== requestIds.length ||
      requests.some((item: any) => {
        const expected = fixture.requests.find((entry: any) => entry.id === item.id);
        return (
          !expected ||
          item.requesterUserId !== expected.requesterUserId ||
          item.npsn !== expected.npsn ||
          item.namaResmi !== expected.namaResmi
        );
      })
    ) {
      throw new Error('Cleanup dihentikan: identitas request fixture tidak cocok.');
    }

    const originalInstitutions = await tx.institution.findMany({
      where: { id: { in: institutionIds } },
      select: { id: true, npsn: true, namaResmi: true },
    });

    if (
      originalInstitutions.length !== institutionIds.length ||
      originalInstitutions.some((item: any) => {
        const expected = fixture.institutions.find((entry: any) => entry.id === item.id);
        return (
          !expected ||
          item.npsn !== expected.npsn ||
          item.namaResmi !== expected.namaResmi
        );
      })
    ) {
      throw new Error('Cleanup dihentikan: identitas institusi fixture tidak cocok.');
    }

    const approvedRequest = requests.find(
      (item: any) => item.id === requestIds[0]
    );

    const createdInstitutionIds = [...institutionIds];

    if (approvedRequest?.institutionId) {
      if (approvedRequest.status !== InstitutionRequestStatus.APPROVED) {
        throw new Error('Cleanup dihentikan: request memiliki institutionId tetapi bukan APPROVED.');
      }

      const expectedRequest = fixture.requests.find(
        (item: any) => item.id === requestIds[0]
      );

      const approvedInstitution = await tx.institution.findUnique({
        where: { id: approvedRequest.institutionId },
        select: { id: true, npsn: true, namaResmi: true },
      });

      if (
        !approvedInstitution ||
        approvedInstitution.npsn !== expectedRequest.npsn ||
        approvedInstitution.namaResmi !== expectedRequest.namaResmi
      ) {
        throw new Error('Cleanup dihentikan: institusi hasil approval tidak cocok dengan request B-08.');
      }

      createdInstitutionIds.push(approvedInstitution.id);
    } else if (approvedRequest?.status === InstitutionRequestStatus.APPROVED) {
      throw new Error('Cleanup dihentikan: request APPROVED tidak memiliki institutionId.');
    }

    const fixtureMemberships = await tx.institutionMembership.findMany({
      where: { id: { in: membershipIds } },
      select: {
        id: true,
        userId: true,
        institutionId: true,
        role: true,
      },
    });

    if (
      fixtureMemberships.length !== membershipIds.length ||
      fixtureMemberships.some((item: any) => {
        const expected = fixture.memberships.find((entry: any) => entry.id === item.id);
        return (
          !expected ||
          item.userId !== expected.userId ||
          item.institutionId !== expected.institutionId ||
          item.role !== expected.role
        );
      })
    ) {
      throw new Error('Cleanup dihentikan: membership fixture tidak cocok.');
    }

    const generatedMembershipIds: string[] = [];

    if (approvedRequest?.institutionId) {
      const generatedMemberships = await tx.institutionMembership.findMany({
        where: {
          userId: approvedRequest.requesterUserId,
          institutionId: approvedRequest.institutionId,
        },
        select: { id: true, userId: true, institutionId: true, role: true, status: true },
      });

      if (
        generatedMemberships.length !== 1 ||
        generatedMemberships[0].role !== InstitutionRole.SCHOOL_ADMIN ||
        generatedMemberships[0].status !== MembershipStatus.ACTIVE
      ) {
        throw new Error('Cleanup dihentikan: membership hasil onboarding tidak cocok.');
      }

      generatedMembershipIds.push(generatedMemberships[0].id);
    }

    const allowedMembershipIds = [...membershipIds, ...generatedMembershipIds];

    const allFixtureInstitutionMemberships = await tx.institutionMembership.findMany({
      where: { institutionId: { in: createdInstitutionIds } },
      select: { id: true },
    });

    if (
      allFixtureInstitutionMemberships.some(
        (item: any) => !allowedMembershipIds.includes(item.id)
      )
    ) {
      throw new Error('Cleanup dihentikan: ditemukan membership tak dikenal pada institusi fixture.');
    }

    const auditWhere = {
      OR: [
        { userId: { in: userIds } },
        { institutionId: { in: createdInstitutionIds } },
      ],
    };

    await tx.auditLog.deleteMany({ where: auditWhere });
    await tx.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.institutionRequest.deleteMany({ where: { id: { in: requestIds } } });
    await tx.institutionMembership.deleteMany({
      where: { id: { in: allowedMembershipIds } },
    });
    await tx.institution.deleteMany({
      where: { id: { in: createdInstitutionIds } },
    });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });

    const remaining = await Promise.all([
      tx.user.count({ where: { id: { in: userIds } } }),
      tx.institutionRequest.count({ where: { id: { in: requestIds } } }),
      tx.institutionMembership.count({
        where: { id: { in: allowedMembershipIds } },
      }),
      tx.institution.count({ where: { id: { in: createdInstitutionIds } } }),
    ]);

    if (remaining.some((count: number) => count !== 0)) {
      throw new Error('Cleanup gagal: masih ada record fixture yang tersisa.');
    }
  });

  fixtureReady = false;
  console.log('B09 FIXTURE CLEANUP VERIFIED.');
}

async function runTests(password: string): Promise<void> {
  const users = await Promise.all(
    fixture.users.map((user: any) => loginUser(user.email, password))
  );

  const [adminA, adminB, teacherA, memberApprove, memberReject, platformAdmin] = users;
  const [institutionA, institutionB] = fixture.institutions;
  const [approveMembership, rejectMembership] = fixture.memberships.slice(3, 5);
  const [approveRequest, rejectRequest] = fixture.requests;

  let result = await request('GET', '/api/tenant/membership-requests');
  assert(result.status === 401 && result.body?.code === 'UNAUTHENTICATED', 'GET membership tanpa sesi ditolak.');

  result = await request('GET', '/api/tenant/membership-requests', {
    user: teacherA,
    institutionId: institutionA.id,
  });
  assert(result.status === 403, 'Teacher tidak dapat melihat daftar permintaan membership.');

  result = await request('GET', '/api/tenant/membership-requests', {
    user: adminB,
    institutionId: institutionA.id,
  });
  assert(result.status === 403, 'Admin tenant B tidak dapat mengakses tenant A.');

  result = await request('GET', '/api/tenant/membership-requests', {
    user: adminA,
    institutionId: institutionA.id,
  });
  assert(
    result.status === 200 &&
    result.body?.success === true &&
    Array.isArray(result.body?.requests),
    'School Admin dapat melihat daftar membership tenant sendiri.'
  );

  result = await request('GET', '/api/tenant/membership-requests?take=0', {
    user: adminA,
    institutionId: institutionA.id,
  });
  assert(result.status === 400, 'Pagination tidak valid ditolak.');

  result = await request(
    'POST',
    `/api/tenant/membership-requests/${rejectMembership.id}/reject`,
    { user: adminA, institutionId: institutionA.id, origin: BASE_URL }
  );
  assert(result.status === 403 && result.body?.code === 'CSRF_TOKEN_MISSING', 'POST tanpa token CSRF ditolak.');

  result = await request(
    'POST',
    `/api/tenant/membership-requests/${rejectMembership.id}/reject`,
    {
      user: adminA,
      institutionId: institutionA.id,
      csrf: true,
      origin: 'https://invalid.example',
      body: { rejectionReason: 'Uji B09' },
    }
  );
  assert(result.status === 403 && result.body?.code === 'CSRF_ORIGIN_MISMATCH', 'Origin CSRF yang berbeda ditolak.');

  result = await request(
    'POST',
    `/api/tenant/membership-requests/${approveMembership.id}/approve`,
    {
      user: adminA,
      institutionId: institutionA.id,
      csrf: true,
      origin: BASE_URL,
    }
  );
  assert(result.status === 200 && result.body?.success === true, 'Approve membership melalui HTTP berhasil.');

  const approvedMembership = await prisma.institutionMembership.findUnique({
    where: { id: approveMembership.id },
  });
  assert(
    approvedMembership?.status === MembershipStatus.ACTIVE &&
    approvedMembership?.role === InstitutionRole.TEACHER,
    'Approve membership mengaktifkan status dan mempertahankan role TEACHER.'
  );

  result = await request(
    'POST',
    `/api/tenant/membership-requests/${approveMembership.id}/approve`,
    {
      user: adminA,
      institutionId: institutionA.id,
      csrf: true,
      origin: BASE_URL,
    }
  );
  assert(result.status === 409, 'Approve membership yang sudah diproses menghasilkan konflik.');

  result = await request(
    'POST',
    `/api/tenant/membership-requests/${rejectMembership.id}/reject`,
    {
      user: adminA,
      institutionId: institutionA.id,
      csrf: true,
      origin: BASE_URL,
      body: { rejectionReason: 'Ditolak dalam pengujian B09.' },
    }
  );
  assert(result.status === 200 && result.body?.success === true, 'Reject membership melalui HTTP berhasil.');

  const rejectedMembership = await prisma.institutionMembership.findUnique({
    where: { id: rejectMembership.id },
  });
  assert(rejectedMembership?.status === MembershipStatus.INACTIVE, 'Reject membership mengubah status menjadi INACTIVE.');

  result = await request(
    'POST',
    '/api/platform/institution-requests/not-a-valid-id/approve',
    {
      user: platformAdmin,
      csrf: true,
      origin: BASE_URL,
      body: {},
    }
  );
  assert(result.status === 400, 'ID onboarding tidak valid ditolak.');

  result = await request('GET', '/api/platform/institution-requests');
  assert(result.status === 401, 'Daftar onboarding tanpa sesi ditolak.');

  result = await request('GET', '/api/platform/institution-requests', {
    user: adminA,
  });
  assert(result.status === 403, 'School Admin bukan Platform Super Admin ditolak.');

  result = await request('GET', '/api/platform/institution-requests', {
    user: platformAdmin,
  });
  assert(
    result.status === 200 &&
    result.body?.success === true &&
    Array.isArray(result.body?.requests),
    'Platform Super Admin dapat melihat daftar onboarding.'
  );

  result = await request(
    'POST',
    `/api/platform/institution-requests/${approveRequest.id}/approve`,
    {
      user: platformAdmin,
      csrf: true,
      origin: BASE_URL,
      body: {},
    }
  );
  assert(result.status === 200 && result.body?.success === true, 'Approve onboarding melalui HTTP berhasil.');

  const approvedRequest = await prisma.institutionRequest.findUnique({
    where: { id: approveRequest.id },
  });

  assert(
    approvedRequest?.status === InstitutionRequestStatus.APPROVED &&
    Boolean(approvedRequest?.institutionId),
    'Onboarding berstatus APPROVED dan memiliki institusi hasil approval.'
  );

  const assignedMembership = await prisma.institutionMembership.findUnique({
    where: {
      userId_institutionId: {
        userId: fixture.users[6].id,
        institutionId: approvedRequest.institutionId,
      },
    },
  });

  assert(
    assignedMembership?.role === InstitutionRole.SCHOOL_ADMIN &&
    assignedMembership?.status === MembershipStatus.ACTIVE,
    'Pemohon onboarding memperoleh membership SCHOOL_ADMIN ACTIVE.'
  );

  result = await request(
    'POST',
    `/api/platform/institution-requests/${approveRequest.id}/approve`,
    {
      user: platformAdmin,
      csrf: true,
      origin: BASE_URL,
      body: {},
    }
  );
  assert(result.status === 409, 'Approve onboarding yang sudah diproses menghasilkan konflik.');

  result = await request(
    'POST',
    `/api/platform/institution-requests/${rejectRequest.id}/reject`,
    {
      user: platformAdmin,
      csrf: true,
      origin: BASE_URL,
      body: { rejectionReason: 'Ditolak dalam pengujian B09.' },
    }
  );
  assert(result.status === 200 && result.body?.success === true, 'Reject onboarding melalui HTTP berhasil.');

  const rejectedRequest = await prisma.institutionRequest.findUnique({
    where: { id: rejectRequest.id },
  });
  assert(
    rejectedRequest?.status === InstitutionRequestStatus.REJECTED &&
    rejectedRequest?.rejectionReason === 'Ditolak dalam pengujian B09.',
    'Reject onboarding menyimpan status dan alasan penolakan.'
  );
}


async function runServiceEdgeTests(): Promise<void> {
  const [
    { prisma: servicePrisma },
    { membershipApprovalService },
    { institutionOnboardingService },
    { auditLogRepository },
  ] = await Promise.all([
    import('../src/db/prisma'),
    import('../src/services/membershipApprovalService'),
    import('../src/services/institutionOnboardingService'),
    import('../src/repositories/auditLogRepository'),
  ]);

  assert(
    servicePrisma === prisma,
    'Service menggunakan instance Prisma yang sama dengan fixture database test.'
  );

  const serviceIdentity = await servicePrisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  assert(
    serviceIdentity[0]?.db === 'edutaktis_onboarding_test' &&
    Number(serviceIdentity[0]?.port) === 3306,
    'Koneksi Prisma service terverifikasi menggunakan database test.'
  );

  const users = fixture.users;
  const institutionA = fixture.institutions[0];
  const rollbackMembership = fixture.memberships[8];
  const rollbackRequest = fixture.requests[2];
  const adminA = users[0];
  const platformAdmin = users[5];
  const inactiveReviewer = users[8];
  const inactiveMembershipReviewer = users[9];
  const teacherReviewer = users[2];
  const rollbackApplicant = users[10];
  const rollbackRequester = users[11];

  async function expectError(
    operation: Promise<unknown>,
    expected: string,
    description: string
  ): Promise<void> {
    let actual = '';

    try {
      await operation;
    } catch (error) {
      actual = error instanceof Error ? error.message : String(error);
    }

    assert(actual === expected, `${description} (${expected}).`);
  }

  // 1. Reviewer membership service: akun reviewer tidak aktif.
  await prisma.user.update({
    where: { id: inactiveReviewer.id },
    data: { isActive: false },
  });

  try {
    await expectError(
      membershipApprovalService.approve({
        membershipId: rollbackMembership.id,
        institutionId: institutionA.id,
        actorUserId: inactiveReviewer.id,
      }),
      'REVIEWER_NOT_ACTIVE',
      'Membership service menolak reviewer yang tidak aktif'
    );
  } finally {
    await prisma.user.update({
      where: { id: inactiveReviewer.id },
      data: { isActive: true },
    });
  }

  // 2. Reviewer memiliki membership INACTIVE.
  await expectError(
    membershipApprovalService.approve({
      membershipId: rollbackMembership.id,
      institutionId: institutionA.id,
      actorUserId: inactiveMembershipReviewer.id,
    }),
    'REVIEWER_MEMBERSHIP_NOT_ACTIVE',
    'Membership service menolak reviewer dengan membership INACTIVE'
  );

  // 3. Reviewer aktif tetapi role TEACHER.
  await expectError(
    membershipApprovalService.approve({
      membershipId: rollbackMembership.id,
      institutionId: institutionA.id,
      actorUserId: teacherReviewer.id,
    }),
    'REVIEWER_NOT_AUTHORIZED',
    'Membership service menolak reviewer dengan role TEACHER'
  );

  // 4. Target membership tidak ditemukan.
  await expectError(
    membershipApprovalService.approve({
      membershipId: randomUUID(),
      institutionId: institutionA.id,
      actorUserId: adminA.id,
    }),
    'MEMBERSHIP_REQUEST_NOT_FOUND',
    'Membership service menolak target yang tidak ditemukan'
  );

  // 5. Target membership sudah diproses oleh pengujian HTTP.
  await expectError(
    membershipApprovalService.approve({
      membershipId: fixture.memberships[3].id,
      institutionId: institutionA.id,
      actorUserId: adminA.id,
    }),
    'MEMBERSHIP_REQUEST_STATE_CONFLICT',
    'Membership service menolak target yang sudah diproses'
  );

  // 6. Pemohon membership tidak aktif.
  await prisma.user.update({
    where: { id: rollbackApplicant.id },
    data: { isActive: false },
  });

  try {
    await expectError(
      membershipApprovalService.approve({
        membershipId: rollbackMembership.id,
        institutionId: institutionA.id,
        actorUserId: adminA.id,
      }),
      'APPLICANT_NOT_ACTIVE',
      'Membership service menolak pemohon yang tidak aktif'
    );
  } finally {
    await prisma.user.update({
      where: { id: rollbackApplicant.id },
      data: { isActive: true },
    });
  }

  // 7. Reviewer onboarding tidak aktif: approve dan reject.
  await prisma.user.update({
    where: { id: platformAdmin.id },
    data: { isActive: false },
  });

  try {
    await expectError(
      institutionOnboardingService.approveRequest({
        requestId: rollbackRequest.id,
        reviewerUserId: platformAdmin.id,
      }),
      'REVIEWER_NOT_ACTIVE',
      'Onboarding service menolak approve oleh reviewer tidak aktif'
    );

    await expectError(
      institutionOnboardingService.rejectRequest({
        requestId: rollbackRequest.id,
        reviewerUserId: platformAdmin.id,
        rejectionReason: 'Pengujian reviewer tidak aktif.',
      }),
      'REVIEWER_NOT_ACTIVE',
      'Onboarding service menolak reject oleh reviewer tidak aktif'
    );
  } finally {
    await prisma.user.update({
      where: { id: platformAdmin.id },
      data: { isActive: true },
    });
  }

  // 8. Reviewer aktif tetapi bukan Platform Super Admin.
  await expectError(
    institutionOnboardingService.approveRequest({
      requestId: rollbackRequest.id,
      reviewerUserId: adminA.id,
    }),
    'REVIEWER_NOT_PLATFORM_SUPER_ADMIN',
    'Onboarding service menolak reviewer non-SUPER_ADMIN'
  );

  // 9. Pemohon onboarding tidak aktif.
  await prisma.user.update({
    where: { id: rollbackRequester.id },
    data: { isActive: false },
  });

  try {
    await expectError(
      institutionOnboardingService.approveRequest({
        requestId: rollbackRequest.id,
        reviewerUserId: platformAdmin.id,
      }),
      'REQUESTER_NOT_ACTIVE',
      'Onboarding service menolak pemohon yang tidak aktif'
    );
  } finally {
    await prisma.user.update({
      where: { id: rollbackRequester.id },
      data: { isActive: true },
    });
  }

  // 10. Target onboarding tidak ditemukan.
  await expectError(
    institutionOnboardingService.approveRequest({
      requestId: randomUUID(),
      reviewerUserId: platformAdmin.id,
    }),
    'INSTITUTION_REQUEST_NOT_FOUND',
    'Onboarding service menolak request yang tidak ditemukan'
  );

  // 11. Target onboarding sudah diproses.
  await expectError(
    institutionOnboardingService.approveRequest({
      requestId: fixture.requests[0].id,
      reviewerUserId: platformAdmin.id,
    }),
    'INSTITUTION_REQUEST_NOT_PENDING',
    'Onboarding service menolak request yang sudah diproses'
  );

  // 12. Audit log dari empat operasi HTTP yang berhasil.
  const successfulAuditCounts = await Promise.all([
    prisma.auditLog.count({
      where: {
        userId: adminA.id,
        action: 'MEMBERSHIP_REQUEST_APPROVED',
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: adminA.id,
        action: 'MEMBERSHIP_REQUEST_REJECTED',
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: platformAdmin.id,
        action: 'INSTITUTION_REQUEST_APPROVED',
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: platformAdmin.id,
        action: 'INSTITUTION_REQUEST_REJECTED',
      },
    }),
  ]);

  assert(
    successfulAuditCounts.every((count: number) => count >= 1),
    'Approve dan reject membership serta onboarding menghasilkan audit log.'
  );

  // 13. Rollback membership jika pencatatan audit gagal.
  const membershipAuditBefore = await prisma.auditLog.count({
    where: {
      userId: adminA.id,
      action: 'MEMBERSHIP_REQUEST_APPROVED',
    },
  });

  const originalCreate = auditLogRepository.createInTransaction;
  const auditRepo = auditLogRepository as any;

  try {
    auditRepo.createInTransaction = async () => {
      throw new Error('B09_FORCED_AUDIT_FAILURE');
    };

    await expectError(
      membershipApprovalService.approve({
        membershipId: rollbackMembership.id,
        institutionId: institutionA.id,
        actorUserId: adminA.id,
      }),
      'B09_FORCED_AUDIT_FAILURE',
      'Kegagalan audit menyebabkan approval membership gagal'
    );
  } finally {
    auditRepo.createInTransaction = originalCreate;
  }

  const [membershipAfterRollback, membershipAuditAfter] = await Promise.all([
    prisma.institutionMembership.findUnique({
      where: { id: rollbackMembership.id },
      select: { status: true },
    }),
    prisma.auditLog.count({
      where: {
        userId: adminA.id,
        action: 'MEMBERSHIP_REQUEST_APPROVED',
      },
    }),
  ]);

  assert(
    membershipAfterRollback?.status === MembershipStatus.PENDING &&
    membershipAuditAfter === membershipAuditBefore,
    'Rollback membership mempertahankan status PENDING dan tidak menyisakan audit log.'
  );

  // 14. Rollback onboarding jika pencatatan audit gagal.
  const onboardingAuditBefore = await prisma.auditLog.count({
    where: {
      userId: platformAdmin.id,
      action: 'INSTITUTION_REQUEST_APPROVED',
    },
  });

  const originalOnboardingCreate = auditLogRepository.createInTransaction;

  try {
    auditRepo.createInTransaction = async () => {
      throw new Error('B09_FORCED_AUDIT_FAILURE');
    };

    await expectError(
      institutionOnboardingService.approveRequest({
        requestId: rollbackRequest.id,
        reviewerUserId: platformAdmin.id,
      }),
      'B09_FORCED_AUDIT_FAILURE',
      'Kegagalan audit menyebabkan approval onboarding gagal'
    );
  } finally {
    auditRepo.createInTransaction = originalOnboardingCreate;
  }

  const [
    requestAfterRollback,
    generatedInstitution,
    generatedMembership,
    onboardingAuditAfter,
  ] = await Promise.all([
    prisma.institutionRequest.findUnique({
      where: { id: rollbackRequest.id },
      select: { status: true, institutionId: true },
    }),
    prisma.institution.findUnique({
      where: { npsn: rollbackRequest.npsn },
      select: { id: true },
    }),
    prisma.institutionMembership.findFirst({
      where: { userId: rollbackRequester.id },
      select: { id: true },
    }),
    prisma.auditLog.count({
      where: {
        userId: platformAdmin.id,
        action: 'INSTITUTION_REQUEST_APPROVED',
      },
    }),
  ]);

  assert(
    requestAfterRollback?.status === InstitutionRequestStatus.PENDING_REVIEW &&
    requestAfterRollback?.institutionId === null &&
    generatedInstitution === null &&
    generatedMembership === null &&
    onboardingAuditAfter === onboardingAuditBefore,
    'Rollback onboarding membatalkan request, institusi, membership, dan audit log.'
  );

  console.log('B09 SERVICE EDGE CASES COMPLETED.');
}

async function main(): Promise<void> {
  let password = '';

  try {
    requireCondition(fs.existsSync(ENV_PATH), '.env.onboarding-test tidak ditemukan.');
    const config = dotenv.parse(fs.readFileSync(ENV_PATH));

    requireCondition(
      config.MYSQL_DATABASE === 'edutaktis_onboarding_test',
      'STOP: database bukan edutaktis_onboarding_test.'
    );
    requireCondition(
      Boolean(config.MYSQL_USER && config.MYSQL_PASSWORD),
      'Konfigurasi MySQL test tidak lengkap.'
    );

    password = config.B05_TEST_PASSWORD || '';
    requireCondition(
      password.length >= 12 &&
      password.length <= 128 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password),
      'B05_TEST_PASSWORD tidak memenuhi persyaratan.'
    );

    const credentials =
      `${encodeURIComponent(config.MYSQL_USER)}:` +
      `${encodeURIComponent(config.MYSQL_PASSWORD)}`;

    const databaseUrl =
      `mysql://${credentials}@127.0.0.1:3307/edutaktis_onboarding_test`;

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

    console.log('DATABASE VERIFIED: edutaktis_onboarding_test; internal port 3306.');

    await createFixture(password);
    await startServer(databaseUrl);
    await runTests(password);
    await runServiceEdgeTests();
  } finally {
    let stopError: unknown;

    try {
      await stopServer();
    } catch (error) {
      stopError = error;
      console.error('SERVER STOP ERROR:', error);
    }

    if (serverStopVerified) {
      try {
        await cleanupFixture();
      } catch (error) {
        console.error('FIXTURE CLEANUP ERROR:', error);
        throw error;
      }
    } else if (fixtureReady) {
      console.error('FIXTURE DIPERTAHANKAN: server belum dipastikan berhenti normal.');
    }

    if (prisma) await prisma.$disconnect();

    if (stopError) throw stopError;
  }

  console.log(`\nB09 RESULT: ${passed} passed, ${failed} failed.`);
}

main().catch((error) => {
  console.error('\nB09 FAILED:', error);
  process.exitCode = 1;
});
