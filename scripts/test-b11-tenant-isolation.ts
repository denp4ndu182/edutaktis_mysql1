import { randomUUID } from 'node:crypto';

import { prisma } from './onboarding-test-prisma';

let projectRepository: typeof import('../src/repositories/projectRepository').projectRepository;

import {
  canViewProject,
  canEditProject,
  canDeleteProject,
} from '../src/security/permissions';

const PREFIX = `B11-TENANT-${randomUUID()}`;

// NPSN dibatasi VARCHAR(20): prefix 17 karakter + suffix 2 karakter.
const NPSN_PREFIX = `B11${randomUUID().replace(/-/g, '').slice(0, 14)}`;

const ids = {
  institutionA: randomUUID(),
  institutionB: randomUUID(),
  teacherA: randomUUID(),
  teacherB: randomUUID(),
  adminA: randomUUID(),
  headmasterA: randomUUID(),
  operatorA: randomUUID(),
  projectA: randomUUID(),
  projectB: randomUUID(),
  invalidProject: randomUUID(),
};

const created = {
  institutions: [] as string[],
  users: [] as string[],
  projects: [] as string[],
};

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

async function expectRejected(
  operation: () => Promise<unknown>,
  label: string,
): Promise<any> {
  try {
    await operation();
  } catch (error) {
    assert(true, label);
    return error;
  }

  assert(false, `${label} — operasi seharusnya ditolak`);
  return null;
}

function institutionData(suffix: string) {
  return {
    id: suffix === 'A' ? ids.institutionA : ids.institutionB,
    npsn: `${NPSN_PREFIX}-${suffix}`,
    namaResmi: `${PREFIX} Institusi ${suffix}`,
    namaSingkat: `${PREFIX} ${suffix}`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis pengujian B11',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  };
}

async function createFixtures(): Promise<void> {
  const institutions = [
    institutionData('A'),
    institutionData('B'),
  ];

  for (const institution of institutions) {
    await prisma.institution.create({ data: institution });
    created.institutions.push(institution.id);
  }

  const users = [
    { id: ids.teacherA, suffix: 'teacher-a', name: 'Teacher A' },
    { id: ids.teacherB, suffix: 'teacher-b', name: 'Teacher B' },
    { id: ids.adminA, suffix: 'admin-a', name: 'Admin A' },
    { id: ids.headmasterA, suffix: 'headmaster-a', name: 'Headmaster A' },
    { id: ids.operatorA, suffix: 'operator-a', name: 'Operator A' },
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: `${PREFIX}-${user.suffix}@b11.invalid`,
        namaLengkap: `${PREFIX} ${user.name}`,
        isActive: true,
        emailVerified: true,
      },
    });

    created.users.push(user.id);
  }

  await prisma.institutionMembership.createMany({
    data: [
      {
        userId: ids.teacherA,
        institutionId: ids.institutionA,
        role: 'TEACHER',
        status: 'ACTIVE',
      },
      {
        userId: ids.teacherB,
        institutionId: ids.institutionA,
        role: 'TEACHER',
        status: 'ACTIVE',
      },
      {
        userId: ids.teacherB,
        institutionId: ids.institutionB,
        role: 'TEACHER',
        status: 'ACTIVE',
      },
      {
        userId: ids.adminA,
        institutionId: ids.institutionA,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      },
      {
        userId: ids.headmasterA,
        institutionId: ids.institutionA,
        role: 'HEADMASTER',
        status: 'ACTIVE',
      },
      {
        userId: ids.operatorA,
        institutionId: ids.institutionA,
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
    ],
  });

  const projectA = await projectRepository.createProject({
    id: ids.projectA,
    institutionId: ids.institutionA,
    userId: ids.teacherB,
    name: `${PREFIX} Project Tenant A`,
    masterInput: { marker: PREFIX, tenant: 'A' },
    documents: {},
  });

  created.projects.push(projectA.id);

  const projectB = await projectRepository.createProject({
    id: ids.projectB,
    institutionId: ids.institutionB,
    userId: ids.teacherB,
    name: `${PREFIX} Project Tenant B`,
    masterInput: { marker: PREFIX, tenant: 'B' },
    documents: {},
  });

  created.projects.push(projectB.id);
}

async function testRepositoryIsolation(): Promise<void> {
  console.log('\n=== REPOSITORY TENANT ISOLATION ===');

  const ownTenant = await projectRepository.findProjectByIdAndInstitution(
    ids.projectA,
    ids.institutionA,
  );

  assert(
    ownTenant?.id === ids.projectA,
    'Tenant A dapat menemukan proyek milik institusinya',
  );

  const crossTenant = await projectRepository.findProjectByIdAndInstitution(
    ids.projectB,
    ids.institutionA,
  );

  assert(
    crossTenant === null,
    'Tenant A tidak dapat menemukan proyek Tenant B',
  );

  const wrongOwner = await projectRepository.findProjectByIdAndInstitution(
    ids.projectA,
    ids.institutionA,
    ids.teacherA,
  );

  assert(
    wrongOwner === null,
    'Guru A tidak dapat menemukan proyek milik Guru B',
  );

  const correctOwner = await projectRepository.findProjectByIdAndInstitution(
    ids.projectA,
    ids.institutionA,
    ids.teacherB,
  );

  assert(
    correctOwner?.id === ids.projectA,
    'Guru B dapat menemukan proyek miliknya',
  );
}

async function testUpdateDeleteIsolation(): Promise<void> {
  console.log('\n=== UPDATE AND DELETE ISOLATION ===');

  await expectRejected(
    () =>
      projectRepository.updateProject(
        ids.projectB,
        ids.institutionA,
        { name: `${PREFIX} ILLEGAL UPDATE` },
      ),
    'Tenant A tidak dapat mengubah proyek Tenant B',
  );

  await expectRejected(
    () =>
      projectRepository.deleteProject(
        ids.projectB,
        ids.institutionA,
      ),
    'Tenant A tidak dapat menghapus proyek Tenant B',
  );

  await expectRejected(
    () =>
      projectRepository.updateProject(
        ids.projectA,
        ids.institutionA,
        { name: `${PREFIX} ILLEGAL OWNER UPDATE` },
        ids.teacherA,
      ),
    'Guru A tidak dapat mengubah proyek Guru B',
  );

  await expectRejected(
    () =>
      projectRepository.deleteProject(
        ids.projectA,
        ids.institutionA,
        ids.teacherA,
      ),
    'Guru A tidak dapat menghapus proyek Guru B',
  );

  const projectAAfter = await prisma.project.findUnique({
    where: { id: ids.projectA },
  });

  const projectBAfter = await prisma.project.findUnique({
    where: { id: ids.projectB },
  });

  assert(
    projectAAfter?.name === `${PREFIX} Project Tenant A`,
    'Proyek Tenant A tetap utuh setelah akses ditolak',
  );

  assert(
    projectBAfter?.name === `${PREFIX} Project Tenant B`,
    'Proyek Tenant B tetap utuh setelah akses ditolak',
  );

  assert(
    projectAAfter !== null && projectBAfter !== null,
    'Kedua proyek masih ada setelah percobaan lintas-tenant',
  );
}

async function testDatabaseConstraint(): Promise<void> {
  console.log('\n=== DATABASE COMPOSITE RELATION ===');

  let rejected = false;
  let errorCode = '';

  try {
    // Teacher A hanya memiliki membership di Institution A.
    // Percobaan membuat proyek Teacher A di Institution B
    // harus ditolak oleh relasi membership komposit.
    await prisma.project.create({
      data: {
        id: ids.invalidProject,
        institutionId: ids.institutionB,
        userId: ids.teacherA,
        name: `${PREFIX} INVALID PROJECT`,
        masterInput: { marker: PREFIX },
        documents: {},
      },
    });

    created.projects.push(ids.invalidProject);
  } catch (error: any) {
    rejected = true;
    errorCode = String(error?.code ?? 'UNKNOWN');
  }

  assert(
    rejected,
    'Database menolak proyek tanpa pasangan user-institution membership yang valid',
  );

  if (rejected) {
    console.log(`Database rejection code: ${errorCode}`);
  }

  const invalidProject = await prisma.project.findUnique({
    where: { id: ids.invalidProject },
  });

  assert(
    invalidProject === null,
    'Proyek dengan relasi membership tidak valid tidak tersimpan',
  );
}

async function testRolePermissions(): Promise<void> {
  console.log('\n=== ROLE PERMISSION MATRIX ===');

  // TEACHER
  assert(
    canViewProject('TEACHER', true),
    'TEACHER dapat melihat proyek sendiri',
  );
  assert(
    !canViewProject('TEACHER', false),
    'TEACHER tidak dapat melihat proyek guru lain',
  );
  assert(
    canEditProject('TEACHER', true),
    'TEACHER dapat mengedit proyek sendiri',
  );
  assert(
    !canEditProject('TEACHER', false),
    'TEACHER tidak dapat mengedit proyek guru lain',
  );
  assert(
    !canDeleteProject('TEACHER', false),
    'TEACHER tidak dapat menghapus proyek guru lain',
  );

  // HEADMASTER
  assert(
    canViewProject('HEADMASTER', false),
    'HEADMASTER dapat melihat proyek guru lain di sekolahnya',
  );
  assert(
    !canEditProject('HEADMASTER', false),
    'HEADMASTER tidak dapat mengedit proyek guru lain',
  );
  assert(
    !canDeleteProject('HEADMASTER', false),
    'HEADMASTER tidak dapat menghapus proyek guru lain',
  );

  // OPERATOR
  assert(
    canViewProject('OPERATOR', false),
    'OPERATOR dapat melihat proyek sekolah',
  );
  assert(
    !canEditProject('OPERATOR', true),
    'OPERATOR tidak dapat mengedit proyek',
  );
  assert(
    !canDeleteProject('OPERATOR', true),
    'OPERATOR tidak dapat menghapus proyek',
  );

  // SCHOOL_ADMIN
  assert(
    canViewProject('SCHOOL_ADMIN', false),
    'SCHOOL_ADMIN dapat melihat proyek sekolah',
  );
  assert(
    canEditProject('SCHOOL_ADMIN', false),
    'SCHOOL_ADMIN dapat mengedit proyek guru lain',
  );
  assert(
    canDeleteProject('SCHOOL_ADMIN', false),
    'SCHOOL_ADMIN dapat menghapus proyek guru lain',
  );
}

async function cleanupFixtures(): Promise<void> {
  console.log('\n=== FIXTURE CLEANUP ===');

  // Verifikasi semua proyek sebelum penghapusan.
  for (const id of created.projects) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        institutionId: true,
        userId: true,
      },
    });

    if (
      project &&
      (
        !project.name.startsWith(PREFIX) ||
        !created.institutions.includes(project.institutionId) ||
        !created.users.includes(project.userId)
      )
    ) {
      throw new Error(
        `STOP CLEANUP: Identitas proyek tidak cocok: ${id}`,
      );
    }
  }

  // Verifikasi institusi sebelum penghapusan.
  for (const id of created.institutions) {
    const institution = await prisma.institution.findUnique({
      where: { id },
      select: { id: true, npsn: true },
    });

    if (institution && !institution.npsn.startsWith(NPSN_PREFIX)) {
      throw new Error(
        `STOP CLEANUP: Identitas institusi tidak cocok: ${id}`,
      );
    }
  }

  // Verifikasi pengguna sebelum penghapusan.
  for (const id of created.users) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (user && !user.email.startsWith(PREFIX)) {
      throw new Error(
        `STOP CLEANUP: Identitas pengguna tidak cocok: ${id}`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.deleteMany({
      where: {
        id: { in: created.projects },
      },
    });

    await tx.institutionMembership.deleteMany({
      where: {
        userId: { in: created.users },
      },
    });

    await tx.auditLog.deleteMany({
      where: {
        userId: { in: created.users },
      },
    });

    await tx.userSession.deleteMany({
      where: {
        userId: { in: created.users },
      },
    });

    await tx.passwordResetToken.deleteMany({
      where: {
        userId: { in: created.users },
      },
    });

    await tx.user.deleteMany({
      where: {
        id: { in: created.users },
      },
    });

    await tx.institution.deleteMany({
      where: {
        id: { in: created.institutions },
      },
    });
  });

  const remainingProjects = await prisma.project.count({
    where: { id: { in: created.projects } },
  });

  const remainingUsers = await prisma.user.count({
    where: { id: { in: created.users } },
  });

  const remainingInstitutions = await prisma.institution.count({
    where: { id: { in: created.institutions } },
  });

  if (remainingProjects || remainingUsers || remainingInstitutions) {
    throw new Error('CLEANUP VERIFICATION FAILED');
  }

  console.log('CLEANUP VERIFIED: all fixtures removed.');
}

async function main(): Promise<void> {
  const identity = await prisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  if (
    identity[0]?.db !== 'edutaktis_onboarding_test' ||
    Number(identity[0]?.port) !== 3306
  ) {
    throw new Error('STOP: Database identity verification failed.');
  }

  console.log(
    'DATABASE VERIFIED:',
    identity[0].db,
    'internal port:',
    Number(identity[0].port),
  );

  // Import repository hanya setelah database test terverifikasi.
  const repositoryModule = await import(
    '../src/repositories/projectRepository'
  );
  projectRepository = repositoryModule.projectRepository;

  try {
    await createFixtures();

    await testRepositoryIsolation();
    await testUpdateDeleteIsolation();
    await testDatabaseConstraint();
    await testRolePermissions();
  } catch (error) {
    failed++;
    console.error('TEST EXECUTION ERROR:', error);
  } finally {
    try {
      await cleanupFixtures();
    } catch (error) {
      failed++;
      console.error('CLEANUP ERROR:', error);
    }
  }

  console.log('\n========== B11-07 RESULT ==========');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('B11-07 TESTS PASSED');
  }
}

main()
  .catch((error) => {
    console.error('FATAL TEST ERROR:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
