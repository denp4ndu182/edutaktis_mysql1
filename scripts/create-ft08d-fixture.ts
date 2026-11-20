import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/security/password';

const EXPECTED_DATABASE = 'edutaktis_onboarding_test';
const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_PORT = '3307';

const EMAIL = 'inactive-admin@onboarding.test';
const NAME = 'Fixture Inactive Admin FT-08D';

async function main() {
  if (process.env.ONBOARDING_TEST_FIXTURE_CREATE !== '1') {
    throw new Error('Ditolak: ONBOARDING_TEST_FIXTURE_CREATE harus bernilai 1.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const password = process.env.ONBOARDING_TEST_FIXTURE_PASSWORD;

  if (!databaseUrl || !password) {
    throw new Error('DATABASE_URL atau password fixture tidak tersedia.');
  }

  const parsed = new URL(databaseUrl);

  if (
    parsed.protocol !== 'mysql:' ||
    parsed.hostname !== EXPECTED_HOST ||
    parsed.port !== EXPECTED_PORT ||
    parsed.pathname !== `/${EXPECTED_DATABASE}`
  ) {
    throw new Error('Ditolak: target bukan database onboarding port 3307.');
  }

  if (password.length < 16 || password.length > 128) {
    throw new Error('Password fixture harus memiliki 16–128 karakter.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const identity = await prisma.$queryRaw<
      Array<{ database_name: string | null }>
    >`SELECT DATABASE() AS database_name`;

    if (identity[0]?.database_name !== EXPECTED_DATABASE) {
      throw new Error('Identitas database tidak sesuai.');
    }

    const existing = await prisma.user.findUnique({
      where: { email: EMAIL },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
        isActive: true,
        emailVerified: true,
        memberships: { select: { id: true } },
      },
    });

    if (existing) {
      if (
        existing.namaLengkap !== NAME ||
        existing.isActive !== false ||
        existing.emailVerified !== true ||
        existing.memberships.length !== 0
      ) {
        throw new Error(
          'Fixture dengan email tersebut sudah ada tetapi kondisinya tidak sesuai. Tidak ada perubahan dilakukan.'
        );
      }

      console.log('Fixture sudah tersedia dan kondisinya sesuai.');
      console.log({
        id: existing.id,
        email: existing.email,
        isActive: existing.isActive,
        emailVerified: existing.emailVerified,
        membershipCount: existing.memberships.length,
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        namaLengkap: NAME,
        passwordHash,
        isActive: false,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
        isActive: true,
        emailVerified: true,
      },
    });

    const membershipCount = await prisma.institutionMembership.count({
      where: { userId: created.id },
    });

    const passed =
      created.isActive === false &&
      created.emailVerified === true &&
      membershipCount === 0;

    console.log('===== FT-08D FIXTURE CREATION =====');
    console.log('Database:', EXPECTED_DATABASE);
    console.log('Fixture:', created);
    console.log('Membership count:', membershipCount);
    console.log('RESULT:', passed ? 'PASSED' : 'FAILED');

    if (!passed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('FIXTURE ERROR:', error.message);
  process.exitCode = 1;
});
