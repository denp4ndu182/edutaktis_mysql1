import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const EXPECTED_DATABASE = 'edutaktis_onboarding_test';
const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_PORT = '3307';

const FIXTURE_USERS = [
  {
    email: 'superadmin@onboarding.test',
    namaLengkap: 'Fixture Super Admin',
  },
  {
    email: 'schooladmin@onboarding.test',
    namaLengkap: 'Fixture School Admin',
  },
  {
    email: 'applicant-a@onboarding.test',
    namaLengkap: 'Fixture Applicant A',
  },
  {
    email: 'applicant-b@onboarding.test',
    namaLengkap: 'Fixture Applicant B',
  },
] as const;

const FIXTURE_NPSN = 'TEST-ONB-0001';
const FIXTURE_MARKER = 'EDUTAKTIS_ONBOARDING_TEST_FIXTURE_V1';

function verifyEnvironment(): {
  databaseUrl: string;
  fixturePassword: string;
} {
  if (process.env.ONBOARDING_TEST_SEED !== '1') {
    throw new Error(
      'Ditolak: ONBOARDING_TEST_SEED harus bernilai 1.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Ditolak: DATABASE_URL tidak tersedia.');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('Ditolak: format DATABASE_URL tidak valid.');
  }

  if (
    parsedUrl.protocol !== 'mysql:' ||
    parsedUrl.hostname !== EXPECTED_HOST ||
    parsedUrl.port !== EXPECTED_PORT ||
    parsedUrl.pathname !== `/${EXPECTED_DATABASE}`
  ) {
    throw new Error(
      'Ditolak: target database bukan edutaktis_onboarding_test pada 127.0.0.1:3307.'
    );
  }

  const fixturePassword =
    process.env.ONBOARDING_TEST_FIXTURE_PASSWORD;

  if (
    !fixturePassword ||
    fixturePassword.length < 16 ||
    fixturePassword.length > 128
  ) {
    throw new Error(
      'Ditolak: ONBOARDING_TEST_FIXTURE_PASSWORD wajib berisi 16–128 karakter.'
    );
  }

  return { databaseUrl, fixturePassword };
}

async function verifyDatabaseIdentity(
  prisma: PrismaClient
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ database_name: string | null }>
  >`
    SELECT DATABASE() AS database_name
  `;

  const identity = rows[0];

  if (!identity || identity.database_name !== EXPECTED_DATABASE) {
    throw new Error(
      'Ditolak: database aktif bukan edutaktis_onboarding_test.'
    );
  }

  console.log(
    `Target terverifikasi: ${EXPECTED_DATABASE} pada port ${EXPECTED_PORT}.`
  );
}

async function verifyExistingFixture(
  prisma: PrismaClient
): Promise<boolean> {
  const emails = FIXTURE_USERS.map((user) => user.email);

  const [users, institutions, memberships] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
        isActive: true,
        emailVerified: true,
      },
    }),
    prisma.institution.findMany({
      where: { npsn: FIXTURE_NPSN },
      select: {
        id: true,
        npsn: true,
        namaResmi: true,
      },
    }),
    prisma.institutionMembership.findMany({
      where: {
        user: { email: { in: emails } },
        institution: { npsn: FIXTURE_NPSN },
      },
      select: {
        user: { select: { email: true } },
        role: true,
        status: true,
      },
    }),
  ]);

  if (users.length === 0 && institutions.length === 0 &&
      memberships.length === 0) {
    return false;
  }

  const expectedEmails = new Set(emails);
  const actualEmails = new Set(users.map((user) => user.email));

  const expectedNames = new Map<string, string>(
    FIXTURE_USERS.map((user) => [user.email, user.namaLengkap])
  );

  const usersComplete =
    users.length === FIXTURE_USERS.length &&
    [...expectedEmails].every((email) => actualEmails.has(email)) &&
    users.every(
      (user) =>
        user.isActive &&
        user.emailVerified &&
        user.namaLengkap === expectedNames.get(user.email)
    );

  const institutionComplete =
    institutions.length === 1 &&
    institutions[0].npsn === FIXTURE_NPSN &&
    institutions[0].namaResmi ===
      'Institusi Uji Onboarding EduTaktis';

  const fixtureAudit =
    users.length === FIXTURE_USERS.length && institutions.length === 1
      ? await prisma.auditLog.findFirst({
          where: {
            userId: users.find(
              (user) => user.email === 'superadmin@onboarding.test'
            )?.id,
            institutionId: institutions[0].id,
            action: 'ONBOARDING_TEST_FIXTURE_CREATED',
            resource: 'TestFixture',
          },
          select: { id: true, details: true },
        })
      : null;

  const auditDetails = fixtureAudit?.details;
  const auditMarkerValid =
    typeof auditDetails === 'object' &&
    auditDetails !== null &&
    !Array.isArray(auditDetails) &&
    auditDetails.marker === FIXTURE_MARKER &&
    auditDetails.fixtureVersion === 1 &&
    auditDetails.purpose === 'Isolated onboarding integration tests';

  const membershipByEmail = new Map(
    memberships.map((membership) => [
      membership.user.email,
      `${membership.role}:${membership.status}`,
    ])
  );

  const membershipsComplete =
    memberships.length === 2 &&
    membershipByEmail.get('superadmin@onboarding.test') ===
      'SUPER_ADMIN:ACTIVE' &&
    membershipByEmail.get('schooladmin@onboarding.test') ===
      'SCHOOL_ADMIN:ACTIVE';

  if (
    !usersComplete ||
    !institutionComplete ||
    !membershipsComplete ||
    !fixtureAudit ||
    !auditMarkerValid
  ) {
    throw new Error(
      'Ditemukan data fixture parsial atau tidak sesuai. Tidak ada perubahan dilakukan.'
    );
  }

  console.log(
    'Fixture lengkap dan konsisten telah terverifikasi.'
  );

  return true;
}

async function seed(): Promise<void> {
  const { databaseUrl, fixturePassword } = verifyEnvironment();

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
    log: ['error'],
  });

  try {
    await verifyDatabaseIdentity(prisma);

    if (await verifyExistingFixture(prisma)) {
      return;
    }

    const [userCount, institutionCount, membershipCount,
      requestCount, auditCount, sessionCount, resetTokenCount,
      projectCount] = await Promise.all([
      prisma.user.count(),
      prisma.institution.count(),
      prisma.institutionMembership.count(),
      prisma.institutionRequest.count(),
      prisma.auditLog.count(),
      prisma.userSession.count(),
      prisma.passwordResetToken.count(),
      prisma.project.count(),
    ]);

    const initialCounts = [
      userCount,
      institutionCount,
      membershipCount,
      requestCount,
      auditCount,
      sessionCount,
      resetTokenCount,
      projectCount,
    ];

    if (initialCounts.some((count) => count !== 0)) {
      throw new Error(
        'Database tidak kosong dan fixture belum lengkap. Seed dihentikan tanpa perubahan.'
      );
    }

    const passwordHash = await argon2.hash(fixturePassword, {
      type: argon2.argon2id,
    });

    await prisma.$transaction(
      async (tx) => {
        const institution = await tx.institution.create({
          data: {
            npsn: FIXTURE_NPSN,
            namaResmi: 'Institusi Uji Onboarding EduTaktis',
            namaSingkat: 'Uji Onboarding',
            jenjang: 'MA',
            jenisInstitusi: 'NEGERI',
            kementerianDinas: 'Kementerian Agama',
            alamatLengkap: 'Alamat sintetis untuk pengujian onboarding.',
            kelurahanDesa: 'Desa Uji',
            kecamatan: 'Kecamatan Uji',
            kabupatenKota: 'Kabupaten Uji',
            provinsi: 'Provinsi Uji',
            kodePos: '00000',
            email: 'institusi@onboarding.test',
            website: 'https://onboarding.test',
          },
          select: { id: true },
        });

        const createdUsers = new Map<string, string>();

        for (const fixtureUser of FIXTURE_USERS) {
          const user = await tx.user.create({
            data: {
              email: fixtureUser.email,
              passwordHash,
              namaLengkap: fixtureUser.namaLengkap,
              isActive: true,
              emailVerified: true,
            },
            select: { id: true, email: true },
          });

          createdUsers.set(user.email, user.id);
        }

        const superAdminId = createdUsers.get(
          'superadmin@onboarding.test'
        );
        const schoolAdminId = createdUsers.get(
          'schooladmin@onboarding.test'
        );

        if (!superAdminId || !schoolAdminId) {
          throw new Error('Pembuatan akun fixture tidak lengkap.');
        }

        await tx.institutionMembership.createMany({
          data: [
            {
              userId: superAdminId,
              institutionId: institution.id,
              role: 'SUPER_ADMIN',
              status: 'ACTIVE',
            },
            {
              userId: schoolAdminId,
              institutionId: institution.id,
              role: 'SCHOOL_ADMIN',
              status: 'ACTIVE',
            },
          ],
        });

        // Penanda audit fixture. Tidak menyimpan password atau hash.
        await tx.auditLog.create({
          data: {
            userId: superAdminId,
            institutionId: institution.id,
            action: 'ONBOARDING_TEST_FIXTURE_CREATED',
            resource: 'TestFixture',
            details: {
              marker: FIXTURE_MARKER,
              fixtureVersion: 1,
              purpose: 'Isolated onboarding integration tests',
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15000,
        timeout: 30000,
      }
    );

    const fixtureVerified = await verifyExistingFixture(prisma);

    if (!fixtureVerified) {
      throw new Error(
        'Verifikasi pascatransaksi gagal. Periksa database test secara manual.'
      );
    }

    console.log('Fixture onboarding berhasil dibuat dan diverifikasi.');
    console.log(`Akun fixture: ${FIXTURE_USERS.length}`);
    console.log('Institusi fixture: 1');
    console.log('Membership fixture: 2');
    console.log('Password dan hash tidak ditampilkan.');
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Kesalahan tidak dikenal.';

  console.error('ONBOARDING TEST FIXTURE DITOLAK:', message);
  process.exitCode = 1;
});
