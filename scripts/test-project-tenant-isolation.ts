
import { randomUUID } from 'node:crypto';
import { prisma } from './onboarding-test-prisma';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
};

const expectRejected = async (
  operation: () => Promise<unknown>,
  label: string
): Promise<unknown> => {
  try {
    await operation();
  } catch (error) {
    console.log(`PASS: ${label} ditolak`);
    return error;
  }

  throw new Error(`ASSERTION FAILED: ${label} seharusnya ditolak`);
};

const prefix = `B01-${randomUUID().slice(0, 8)}`;
const ids = {
  institutionA: randomUUID(),
  institutionB: randomUUID(),
  teacherA: randomUUID(),
  teacherB: randomUUID(),
  adminA: randomUUID(),
  projectOwn: randomUUID(),
  projectSameTenant: randomUUID(),
  projectOtherTenant: randomUUID(),
  projectAdminUpdate: randomUUID(),
  projectAdminDelete: randomUUID(),
  projectOcc: randomUUID(),
};

const created = {
  institutions: [] as string[],
  users: [] as string[],
  projects: [] as string[],
};

async function main() {
  // Verifikasi identitas database sebelum membuat data.
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

  // Import setelah DATABASE_URL dari helper sudah disiapkan.
  const { projectRepository } = await import(
    '../src/repositories/projectRepository'
  );

  const institutionData = (suffix: string) => ({
    npsn: `${prefix}-${suffix}`,
    namaResmi: `Institusi Uji B01 ${suffix}`,
    namaSingkat: `B01 ${suffix}`,
    jenjang: 'MA',
    jenisInstitusi: 'NEGERI',
    kementerianDinas: 'Kementerian Agama',
    alamatLengkap: 'Alamat sintetis untuk pengujian B-01',
    kabupatenKota: 'Gunungkidul',
    provinsi: 'DI Yogyakarta',
  });

  try {
    // 1. Membuat dua institusi terpisah.
    await prisma.institution.create({
      data: { id: ids.institutionA, ...institutionData('A') },
    });
    created.institutions.push(ids.institutionA);

    await prisma.institution.create({
      data: { id: ids.institutionB, ...institutionData('B') },
    });
    created.institutions.push(ids.institutionB);

    // 2. Membuat dua guru dan satu administrator sekolah.
    const users = [
      { id: ids.teacherA, email: `${prefix}-teacher-a@test.invalid`, namaLengkap: 'Guru A' },
      { id: ids.teacherB, email: `${prefix}-teacher-b@test.invalid`, namaLengkap: 'Guru B' },
      { id: ids.adminA, email: `${prefix}-admin-a@test.invalid`, namaLengkap: 'Admin A' },
    ];

    for (const user of users) {
      await prisma.user.create({ data: user });
      created.users.push(user.id);
    }

    // Guru A dan Admin A berada di institusi A.
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
      userId: ids.adminA,
      institutionId: ids.institutionA,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    },
    {
      userId: ids.teacherB,
      institutionId: ids.institutionB,
      role: 'TEACHER',
      status: 'ACTIVE',
    },
  ],
});

    // 3. Helper membuat proyek dengan relasi membership yang valid.
    const createProject = async (
      id: string,
      institutionId: string,
      userId: string,
      name: string
    ) => {
      const project = await projectRepository.createProject({
        id,
        institutionId,
        userId,
        name,
        masterInput: { testMarker: prefix },
        documents: {},
      });

      created.projects.push(id);
      return project;
    };

    await createProject(
      ids.projectOwn,
      ids.institutionA,
      ids.teacherA,
      'Proyek milik Guru A'
    );

    await createProject(
      ids.projectSameTenant,
      ids.institutionA,
      ids.teacherB,
      'Proyek Guru B dalam institusi A'
    );

    await createProject(
      ids.projectOtherTenant,
      ids.institutionB,
      ids.teacherB,
      'Proyek institusi B'
    );

    await createProject(
      ids.projectAdminUpdate,
      ids.institutionA,
      ids.teacherA,
      'Proyek untuk update admin'
    );

    await createProject(
      ids.projectAdminDelete,
      ids.institutionA,
      ids.teacherA,
      'Proyek untuk delete admin'
    );

    await createProject(
      ids.projectOcc,
      ids.institutionA,
      ids.teacherA,
      'Proyek untuk OCC'
    );

    // TEST 1: Guru A dapat memperbarui proyek sendiri.
    const ownUpdated = await projectRepository.updateProject(
      ids.projectOwn,
      ids.institutionA,
      { name: 'Proyek Guru A diperbarui' },
      ids.teacherA
    );

    assert(
      ownUpdated.name === 'Proyek Guru A diperbarui',
      'Guru A gagal memperbarui proyek sendiri'
    );
    console.log('PASS: Guru A memperbarui proyek sendiri');

    // TEST 2: Guru A tidak dapat memperbarui proyek Guru B.
    await expectRejected(
      () =>
        projectRepository.updateProject(
          ids.projectSameTenant,
          ids.institutionA,
          { name: 'AKSES TIDAK SAH' },
          ids.teacherA
        ),
      'Guru A mengubah proyek Guru B'
    );

    const sameTenantAfter = await prisma.project.findUniqueOrThrow({
      where: { id: ids.projectSameTenant },
    });
    assert(
      sameTenantAfter.name === 'Proyek Guru B dalam institusi A',
      'Data proyek Guru B berubah setelah update ditolak'
    );

    // TEST 3: Guru A tidak dapat menghapus proyek Guru B.
    await expectRejected(
      () =>
        projectRepository.deleteProject(
          ids.projectSameTenant,
          ids.institutionA,
          ids.teacherA
        ),
      'Guru A menghapus proyek Guru B'
    );

    assert(
      await prisma.project.findUnique({
        where: { id: ids.projectSameTenant },
      }),
      'Proyek Guru B terhapus setelah operasi ditolak'
    );

    // TEST 4: Tenant A tidak dapat mengubah proyek tenant B.
    // userId undefined mensimulasikan jalur administrator sekolah.
    await expectRejected(
      () =>
        projectRepository.updateProject(
          ids.projectOtherTenant,
          ids.institutionA,
          { name: 'CROSS TENANT UPDATE' }
        ),
      'Institusi A mengubah proyek institusi B'
    );

    // TEST 5: Tenant A tidak dapat menghapus proyek tenant B.
    await expectRejected(
      () =>
        projectRepository.deleteProject(
          ids.projectOtherTenant,
          ids.institutionA
        ),
      'Institusi A menghapus proyek institusi B'
    );

    assert(
      await prisma.project.findUnique({
        where: { id: ids.projectOtherTenant },
      }),
      'Proyek institusi B hilang setelah operasi lintas tenant'
    );

    // TEST 6: Admin A dapat memperbarui proyek di institusinya.
    const adminUpdated = await projectRepository.updateProject(
      ids.projectAdminUpdate,
      ids.institutionA,
      { name: 'Diperbarui oleh Admin A' }
    );

    assert(
      adminUpdated.name === 'Diperbarui oleh Admin A',
      'Admin A gagal memperbarui proyek institusinya'
    );
    console.log('PASS: Admin A memperbarui proyek institusinya');

    // TEST 7: Admin A dapat menghapus proyek di institusinya.
    await projectRepository.deleteProject(
      ids.projectAdminDelete,
      ids.institutionA
    );

    assert(
      !(await prisma.project.findUnique({
        where: { id: ids.projectAdminDelete },
      })),
      'Proyek tidak terhapus setelah delete Admin A'
    );
    console.log('PASS: Admin A menghapus proyek institusinya');

    // TEST 8: OCC menolak timestamp kedaluwarsa.
    await expectRejected(
      () =>
        projectRepository.updateProject(
          ids.projectOcc,
          ids.institutionA,
          {
            name: 'UPDATE DENGAN TIMESTAMP KEDALUWARSA',
            expectedProjectUpdatedAt: new Date('2000-01-01T00:00:00.000Z'),
          },
          ids.teacherA
        ),
      'OCC dengan timestamp kedaluwarsa'
    ).then((error: any) => {
      assert(
        error?.code === 'OCC_CONFLICT',
        'Kode error OCC bukan OCC_CONFLICT'
      );
    });

    const occBeforeValid = await prisma.project.findUniqueOrThrow({
      where: { id: ids.projectOcc },
    });

    // TEST 9: OCC menerima timestamp yang sesuai.
    const validOcc = await projectRepository.updateProject(
      ids.projectOcc,
      ids.institutionA,
      {
        name: 'OCC UPDATE BERHASIL',
        expectedProjectUpdatedAt: occBeforeValid.updatedAt,
      },
      ids.teacherA
    );

    assert(
      validOcc.name === 'OCC UPDATE BERHASIL',
      'OCC valid gagal memperbarui proyek'
    );
    console.log('PASS: OCC dengan timestamp valid');

    // TEST 10: Timestamp tidak valid harus ditolak.
    await expectRejected(
      () =>
        projectRepository.updateProject(
          ids.projectOcc,
          ids.institutionA,
          {
            name: 'INVALID TIMESTAMP',
            expectedProjectUpdatedAt: 'bukan-tanggal',
          },
          ids.teacherA
        ),
      'OCC dengan timestamp tidak valid'
    );

    const finalOcc = await prisma.project.findUniqueOrThrow({
      where: { id: ids.projectOcc },
    });

    assert(
      finalOcc.name === 'OCC UPDATE BERHASIL',
      'Data OCC berubah setelah timestamp tidak valid'
    );

    console.log('\nB-01 RUNTIME TEST: ALL ASSERTIONS PASSED');
    } finally {
    console.log('\n========== B-01 FIXTURE CLEANUP ==========');

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

    console.log('B-01 TEST FIXTURE CLEANUP COMPLETED');
  }
} // Penutup async function main()

main()
  .catch((error) => {
    console.error('B-01 RUNTIME TEST FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });