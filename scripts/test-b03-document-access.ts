import { randomUUID } from 'node:crypto';
import { InstitutionRole } from '@prisma/client';
import { prisma } from './onboarding-test-prisma';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const prefix = `B03-${randomUUID().slice(0, 8)}`;

const ids = {
  institutionA: randomUUID(),
  institutionB: randomUUID(),
  teacherA: randomUUID(),
  teacherB: randomUUID(),
  schoolAdmin: randomUUID(),
  headmaster: randomUUID(),
  operator: randomUUID(),
  superAdmin: randomUUID(),
  projectA: randomUUID(),
  projectB: randomUUID(),
  projectOtherTenant: randomUUID(),
};

const created = {
  institutions: [] as string[],
  users: [] as string[],
  projects: [] as string[],
};

let passed = 0;

function check(label: string, condition: unknown): void {
  assert(condition, label);
  passed++;
  console.log(`PASS: ${label}`);
}

async function main() {
  // Verifikasi database sebelum membuat fixture.
  const identity = await prisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  assert(
    identity[0]?.db === 'edutaktis_onboarding_test',
    'Database bukan edutaktis_onboarding_test'
  );
  assert(
    Number(identity[0]?.port) === 3306,
    'Port internal MySQL bukan 3306'
  );

  console.log('DATABASE VERIFIED:', identity[0].db);

  const { projectRepository } = await import(
    '../src/repositories/projectRepository'
  );
  const { modulAjarRepository } = await import(
    '../src/repositories/modulAjarRepository'
  );
  const {
    canViewProject,
    canEditProject,
  } = await import('../src/security/permissions');

  const institutionData = (suffix: string) => ({
    npsn: `${prefix}-${suffix}`,
    namaResmi: `Institusi Uji B03 ${suffix}`,
    namaSingkat: `B03 ${suffix}`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis pengujian B03',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  });

  try {
    // 1. Dua institusi sementara.
    for (const [id, suffix] of [
      [ids.institutionA, 'A'],
      [ids.institutionB, 'B'],
    ] as const) {
      await prisma.institution.create({
        data: { id, ...institutionData(suffix) },
      });
      created.institutions.push(id);
    }

    // 2. Pengguna sementara.
    const users = [
      { id: ids.teacherA, email: `${prefix}-teacher-a@test.invalid`, namaLengkap: 'Guru A' },
      { id: ids.teacherB, email: `${prefix}-teacher-b@test.invalid`, namaLengkap: 'Guru B' },
      { id: ids.schoolAdmin, email: `${prefix}-admin@test.invalid`, namaLengkap: 'Admin Sekolah' },
      { id: ids.headmaster, email: `${prefix}-headmaster@test.invalid`, namaLengkap: 'Kepala Madrasah' },
      { id: ids.operator, email: `${prefix}-operator@test.invalid`, namaLengkap: 'Operator' },
      { id: ids.superAdmin, email: `${prefix}-superadmin@test.invalid`, namaLengkap: 'Super Admin' },
    ];

    for (const user of users) {
      await prisma.user.create({ data: user });
      created.users.push(user.id);
    }

    // 3. Membership aktif.
    await prisma.institutionMembership.createMany({
      data: [
        { userId: ids.teacherA, institutionId: ids.institutionA, role: 'TEACHER', status: 'ACTIVE' },
        { userId: ids.teacherB, institutionId: ids.institutionA, role: 'TEACHER', status: 'ACTIVE' },
        { userId: ids.teacherB, institutionId: ids.institutionB, role: 'TEACHER', status: 'ACTIVE' },
        { userId: ids.schoolAdmin, institutionId: ids.institutionA, role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
        { userId: ids.headmaster, institutionId: ids.institutionA, role: 'HEADMASTER', status: 'ACTIVE' },
        { userId: ids.operator, institutionId: ids.institutionA, role: 'OPERATOR', status: 'ACTIVE' },
        { userId: ids.superAdmin, institutionId: ids.institutionA, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      ],
    });

    // 4. Dokumen sintetis di JSON Project.documents.
    const now = new Date().toISOString();

    const documents = {
      collections: {
        modulAjar: [{
          id: `${prefix}-modul`,
          title: 'Modul Ajar Uji B03',
          version: 1,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          teacherInput: {},
          sourceReferences: {},
          content: null,
        }],
        lkpd: [{
          id: `${prefix}-lkpd`,
          title: 'LKPD Uji B03',
          version: 1,
          status: 'draft',
          mode: 'FROM_ACADEMIC_DATA',
          createdAt: now,
          updatedAt: now,
          teacherInput: {},
          sourceReferences: {},
          content: null,
        }],
      },
    };

    const createProject = async (
      id: string,
      institutionId: string,
      userId: string,
      name: string,
      projectDocuments: unknown
    ) => {
      await projectRepository.createProject({
        id,
        institutionId,
        userId,
        name,
        masterInput: { testMarker: prefix },
        documents: projectDocuments,
      });
      created.projects.push(id);
    };

    await createProject(
      ids.projectA,
      ids.institutionA,
      ids.teacherA,
      'Proyek Guru A',
      documents
    );

    await createProject(
      ids.projectB,
      ids.institutionA,
      ids.teacherB,
      'Proyek Guru B',
      documents
    );

    await createProject(
      ids.projectOtherTenant,
      ids.institutionB,
      ids.teacherB,
      'Proyek Institusi B',
      documents
    );

    // 5. Matriks RBAC untuk proyek milik pengguna lain.
    const otherOwnerCases = [
      { role: InstitutionRole.TEACHER, view: false, edit: false },
      { role: InstitutionRole.SCHOOL_ADMIN, view: true, edit: true },
      { role: InstitutionRole.HEADMASTER, view: true, edit: false },
      { role: InstitutionRole.OPERATOR, view: true, edit: false },
      { role: InstitutionRole.SUPER_ADMIN, view: true, edit: true },
    ];

    for (const item of otherOwnerCases) {
      check(
        `RBAC ${item.role}: view proyek pengguna lain = ${item.view}`,
        canViewProject(item.role, false) === item.view
      );

      check(
        `RBAC ${item.role}: edit proyek pengguna lain = ${item.edit}`,
        canEditProject(item.role, false) === item.edit
      );
    }

    // 6. Matriks RBAC untuk proyek milik sendiri.
    // OPERATOR hanya memiliki project:view_school, bukan project:view_own.
    const ownProjectCases = [
      { role: InstitutionRole.SUPER_ADMIN, allowed: true },
      { role: InstitutionRole.SCHOOL_ADMIN, allowed: true },
      { role: InstitutionRole.HEADMASTER, allowed: true },
      { role: InstitutionRole.TEACHER, allowed: true },
      { role: InstitutionRole.OPERATOR, allowed: false },
    ];

    for (const item of ownProjectCases) {
      check(
        `RBAC ${item.role}: view proyek sendiri = ${item.allowed}`,
        canViewProject(item.role, true) === item.allowed
      );
    }

    // 7. Repository: pemilik dapat membaca dokumen sendiri.
    const ownModul = await modulAjarRepository.getModulAjarById(
      ids.projectA,
      `${prefix}-modul`,
      ids.institutionA,
      ids.teacherA
    );

    check('Guru A membaca Modul Ajar miliknya', ownModul?.id === `${prefix}-modul`);

    const ownLkpd = await modulAjarRepository.getLkpdById(
      ids.projectA,
      `${prefix}-lkpd`,
      ids.institutionA,
      ids.teacherA
    );

    check('Guru A membaca LKPD miliknya', ownLkpd?.id === `${prefix}-lkpd`);

    // 8. Repository: guru lain tidak dapat membaca dokumen proyek Guru A.
    const deniedModul = await modulAjarRepository.getModulAjarById(
      ids.projectB,
      `${prefix}-modul`,
      ids.institutionA,
      ids.teacherA
    );

    check('Guru A tidak dapat membaca Modul Ajar Guru B', deniedModul === null);

    const deniedLkpd = await modulAjarRepository.getLkpdById(
      ids.projectB,
      `${prefix}-lkpd`,
      ids.institutionA,
      ids.teacherA
    );

    check('Guru A tidak dapat membaca LKPD Guru B', deniedLkpd === null);

    // 9. Akses school-wide setelah RBAC mengizinkan.
    const adminCanView = canViewProject(InstitutionRole.SCHOOL_ADMIN, false);
    const adminCanEdit = canEditProject(InstitutionRole.SCHOOL_ADMIN, false);

    check('SCHOOL_ADMIN memiliki izin view school-wide', adminCanView);
    check('SCHOOL_ADMIN memiliki izin edit school-wide', adminCanEdit);

    const adminModul = adminCanView
      ? await modulAjarRepository.getModulAjarById(
          ids.projectB,
          `${prefix}-modul`,
          ids.institutionA,
          undefined
        )
      : null;

    check('SCHOOL_ADMIN membaca Modul Ajar guru lain dalam institusi', adminModul?.id === `${prefix}-modul`);

    const adminLkpd = adminCanView
      ? await modulAjarRepository.getLkpdById(
          ids.projectB,
          `${prefix}-lkpd`,
          ids.institutionA,
          undefined
        )
      : null;

    check('SCHOOL_ADMIN membaca LKPD guru lain dalam institusi', adminLkpd?.id === `${prefix}-lkpd`);

    // HEADMASTER dan OPERATOR hanya memiliki izin baca proyek pengguna lain.
    for (const role of [InstitutionRole.HEADMASTER, InstitutionRole.OPERATOR]) {
      const canView = canViewProject(role, false);
      const canEdit = canEditProject(role, false);

      check(`${role} boleh melihat proyek guru lain`, canView);
      check(`${role} tidak boleh mengubah proyek guru lain`, !canEdit);
    }

    // 10. Isolasi lintas institusi, termasuk jalur tanpa owner filter.
    const crossTenantModul = await modulAjarRepository.getModulAjarById(
      ids.projectOtherTenant,
      `${prefix}-modul`,
      ids.institutionA,
      undefined
    );

    check('Institusi A tidak dapat membaca Modul Ajar institusi B', crossTenantModul === null);

    const crossTenantLkpd = await modulAjarRepository.getLkpdById(
      ids.projectOtherTenant,
      `${prefix}-lkpd`,
      ids.institutionA,
      undefined
    );

    check('Institusi A tidak dapat membaca LKPD institusi B', crossTenantLkpd === null);

    // 11. Pastikan tenant B dapat membaca proyeknya sendiri.
    const tenantBOwn = await modulAjarRepository.getModulAjarById(
      ids.projectOtherTenant,
      `${prefix}-modul`,
      ids.institutionB,
      ids.teacherB
    );

    check('Guru B dapat membaca dokumen proyeknya di institusi B', tenantBOwn?.id === `${prefix}-modul`);

    console.log(`\nB-03 TEST PASSED: ${passed} ASSERTIONS`);
  } finally {
    console.log('\n========== B-03 FIXTURE CLEANUP ==========');

    if (created.projects.length) {
      await prisma.project.deleteMany({
        where: { id: { in: created.projects } },
      });
      console.log('CLEANUP: projects');
    }

    if (created.users.length) {
      await prisma.institutionMembership.deleteMany({
        where: { userId: { in: created.users } },
      });
      console.log('CLEANUP: memberships');

      await prisma.user.deleteMany({
        where: { id: { in: created.users } },
      });
      console.log('CLEANUP: users');
    }

    if (created.institutions.length) {
      await prisma.institution.deleteMany({
        where: { id: { in: created.institutions } },
      });
      console.log('CLEANUP: institutions');
    }

    console.log('B-03 FIXTURE CLEANUP COMPLETED');
  }
}

main()
  .catch((error) => {
    console.error('\nB-03 TEST FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
