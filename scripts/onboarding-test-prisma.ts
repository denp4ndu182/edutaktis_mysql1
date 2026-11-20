import fs from 'node:fs';
import dotenv from 'dotenv';

const envPath = '.env.onboarding-test';

if (!fs.existsSync(envPath)) {
  throw new Error('STOP: .env.onboarding-test tidak ditemukan.');
}

const config = dotenv.parse(fs.readFileSync(envPath));

const requiredKeys = [
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
];

for (const key of requiredKeys) {
  if (!config[key]) {
    throw new Error(`STOP: konfigurasi ${key} tidak tersedia.`);
  }
}

if (config.MYSQL_DATABASE !== 'edutaktis_onboarding_test') {
  throw new Error('STOP: database bukan edutaktis_onboarding_test.');
}

const credentials =
  `${encodeURIComponent(config.MYSQL_USER)}:${encodeURIComponent(config.MYSQL_PASSWORD)}`;

process.env.DATABASE_URL =
  `mysql://${credentials}@127.0.0.1:3307/${config.MYSQL_DATABASE}`;

process.env.NODE_ENV = 'test';

const { prisma } = await import('../src/db/prisma');

try {
  const identity = await prisma.$queryRaw<
    { db: string; port: bigint }[]
  >`SELECT DATABASE() AS db, @@port AS port`;

  if (
    identity[0]?.db !== 'edutaktis_onboarding_test' ||
    Number(identity[0]?.port) !== 3306
  ) {
    throw new Error('STOP: identitas database tidak sesuai.');
  }

  console.log(
    'DATABASE VERIFIED:',
    identity[0].db,
    'internal port:',
    Number(identity[0].port)
  );
} catch (error) {
  await prisma.$disconnect();
  throw error;
}

export { prisma };
