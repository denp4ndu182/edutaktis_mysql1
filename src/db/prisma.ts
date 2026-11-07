import { PrismaClient } from '@prisma/client';

// Global variable for development HMR / connection reuse
declare global {
  // eslint-disable-next-line no-var
  var __db_prisma: PrismaClient | undefined;
}

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const prisma: PrismaClient =
  global.__db_prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__db_prisma = prisma;
}

/**
 * Checks whether MariaDB / MySQL database is reachable.
 * Returns connection diagnostic status with clear failure messaging.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  timestamp: string;
}> {
  if (!isDatabaseConfigured) {
    return {
      connected: false,
      message: 'DATABASE_URL environment variable is not defined.',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Perform light ping query
    await prisma.$queryRaw`SELECT 1 as ping`;
    return {
      connected: true,
      message: 'MariaDB/MySQL database connection successful.',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('Database connection check error:', error);
    return {
      connected: false,
      message: 'Gagal melakukan verifikasi koneksi ke database server.',
      timestamp: new Date().toISOString(),
    };
  }
}
