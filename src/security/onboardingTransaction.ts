import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

const MAX_TRANSACTION_RETRIES = 3;
const TRANSACTION_MAX_WAIT_MS = 15000;
const TRANSACTION_TIMEOUT_MS = 30000;

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

/**
 * Menjalankan operasi onboarding dalam transaksi Serializable.
 *
 * Seluruh query yang berhubungan dengan satu operasi onboarding
 * wajib menggunakan tx yang diterima callback.
 *
 * Retry hanya dilakukan untuk konflik transaksi Prisma P2034.
 * Error validasi, unique constraint, dan error bisnis tidak diulang.
 */
export async function withOnboardingTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_RETRIES;
    attempt++
  ) {
    try {
      return await prisma.$transaction(
        async (tx) => operation(tx),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        }
      );
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_RETRIES
      ) {
        throw error;
      }

      console.warn(
        `[ONBOARDING_TRANSACTION] Konflik transaksi. Percobaan ${attempt}/${MAX_TRANSACTION_RETRIES}.`
      );
    }
  }

  throw new Error(
    'ONBOARDING_TRANSACTION_FAILED: Transaksi onboarding gagal.'
  );
}
