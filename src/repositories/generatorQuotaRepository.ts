import { randomUUID } from 'node:crypto';
import { GeneratorUsageScope, PrismaClient } from '@prisma/client';

import { prisma } from '../db/prisma';

export interface IncrementCounterParams {
  scope: GeneratorUsageScope;
  keyHash: string;
  windowSeconds: number;
  limit: number;
}
export interface IncrementCounterResult {
  allowed: boolean;
  usageCount: number;
  remaining: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface IncrementCountersResult {
  allowed: boolean;
  results: IncrementCounterResult[];
  deniedIndex: number | null;
}


export interface AcquireExecutionLockParams {
  userId: string;
  ownerToken: string;
  leaseSeconds: number;
}

export interface AcquireExecutionLockResult {
  acquired: boolean;
  expiresAt: Date | null;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_WINDOW_SECONDS = 31_536_000;
const MAX_LOCK_LEASE_SECONDS = 3600;
const MAX_TRANSACTION_RETRIES = 3;
const TRANSACTION_MAX_WAIT_MS = 15000;
const TRANSACTION_TIMEOUT_MS = 30000;

function validateDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${fieldName} harus berupa Date yang valid.`);
  }
}

function validateHash(value: string, fieldName: string): void {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new TypeError(
      `${fieldName} harus berupa hexadecimal 64 karakter.`
    );
  }
}

function validateWindowSeconds(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_WINDOW_SECONDS
  ) {
    throw new TypeError('windowSeconds tidak valid.');
  }
}

function validateCounterParams(params: IncrementCounterParams): void {
  validateHash(params.keyHash, 'keyHash');
  validateWindowSeconds(params.windowSeconds);

  if (!['IP', 'USER'].includes(params.scope)) {
    throw new TypeError('Scope quota tidak valid.');
  }

  if (!Number.isSafeInteger(params.limit) || params.limit < 1) {
    throw new TypeError('Limit quota harus berupa integer positif.');
  }
}

function validateLockParams(params: AcquireExecutionLockParams): void {
  if (
    typeof params.userId !== 'string' ||
    params.userId.length === 0 ||
    params.userId.length > 36
  ) {
    throw new TypeError('userId tidak valid.');
  }

  validateHash(params.ownerToken, 'ownerToken');

  if (
    !Number.isSafeInteger(params.leaseSeconds) ||
    params.leaseSeconds < 1 ||
    params.leaseSeconds > MAX_LOCK_LEASE_SECONDS
  ) {
    throw new TypeError(
      `leaseSeconds harus antara 1 dan ${MAX_LOCK_LEASE_SECONDS}.`
    );
  }
}

function parseMysqlUtcDateTime(
  value: string,
  fieldName: string
): Date {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\.(\d{1,6})$/.exec(value);

  if (!match) {
    throw new Error(`${fieldName} bukan format DATETIME UTC yang valid.`);
  }

  const milliseconds = match[3].padEnd(3, '0').slice(0, 3);
  const result = new Date(
    `${match[1]}T${match[2]}.${milliseconds}Z`
  );

  validateDate(result, fieldName);
  return result;
}

class QuotaWindowExpiredError extends Error {
  constructor() {
    super('Quota window expired while waiting for its database lock.');
    this.name = 'QuotaWindowExpiredError';
  }
}

class QuotaLimitReachedError extends Error {
  constructor(
    public readonly result: IncrementCountersResult
  ) {
    super('One or more generator quota limits have been reached.');
    this.name = 'QuotaLimitReachedError';
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

export class GeneratorQuotaRepository {
  constructor(
    private readonly db: PrismaClient = prisma
  ) {}
  /**
   * Atomically reserves one quota unit.
   *
   * Fixed windows are calculated from the MySQL UTC clock.
   * The unique index and SELECT FOR UPDATE serialize competing requests.
   * Rejected requests do not increment usage_count.
   */
    /**
   * Atomically reserves one or more quota units.
   *
   * All counters are processed in deterministic order.
   * If any counter reaches its limit, the entire transaction rolls back.
   * Fixed windows are calculated using the MySQL UTC clock.
   */
  async incrementCounters(
    paramsList: IncrementCounterParams[]
  ): Promise<IncrementCountersResult> {
    if (
      !Array.isArray(paramsList) ||
      paramsList.length < 1 ||
      paramsList.length > 10
    ) {
      throw new TypeError(
        'Jumlah counter harus antara 1 dan 10.'
      );
    }

    paramsList.forEach(validateCounterParams);

    const identities = new Set<string>();

    for (const params of paramsList) {
      const identity = [
        params.scope,
        params.keyHash,
        params.windowSeconds,
      ].join(':');

      if (identities.has(identity)) {
        throw new TypeError(
          'Counter yang sama tidak boleh dikirim lebih dari satu kali.'
        );
      }

      identities.add(identity);
    }

    const ordered = paramsList
      .map((params, index) => ({ params, index }))
      .sort((a, b) => {
        const scopeCompare = a.params.scope.localeCompare(
          b.params.scope
        );

        if (scopeCompare !== 0) return scopeCompare;

        const hashCompare = a.params.keyHash.localeCompare(
          b.params.keyHash
        );

        if (hashCompare !== 0) return hashCompare;

        return (
          a.params.windowSeconds - b.params.windowSeconds
        );
      });

    for (
      let attempt = 1;
      attempt <= MAX_TRANSACTION_RETRIES;
      attempt++
    ) {
      try {
        return await this.db.$transaction(async (tx) => {
          const snapshots: Array<{
            index: number;
            params: IncrementCounterParams;
            windowStart: Date;
            windowEnd: Date;
            currentCount: number;
          }> = [];

          // Phase 1: Create and lock every counter in stable order.
          for (const item of ordered) {
            const params = item.params;

            const windowRows = await tx.$queryRaw<
              Array<{
                windowStartUtc: string;
                windowEndUtc: string;
              }>
            >`
              SELECT
                DATE_FORMAT(
                  w.window_start,
                  '%Y-%m-%d %H:%i:%s.%f'
                ) AS windowStartUtc,
                DATE_FORMAT(
                  TIMESTAMPADD(
                    SECOND,
                    ${params.windowSeconds},
                    w.window_start
                  ),
                  '%Y-%m-%d %H:%i:%s.%f'
                ) AS windowEndUtc
              FROM (
                SELECT TIMESTAMPADD(
                  MICROSECOND,
                  FLOOR(
                    TIMESTAMPDIFF(
                      MICROSECOND,
                      CAST(
                        '1970-01-01 00:00:00.000000'
                        AS DATETIME(6)
                      ),
                      UTC_TIMESTAMP(3)
                    ) / (${params.windowSeconds} * 1000000)
                  ) * (${params.windowSeconds} * 1000000),
                  CAST(
                    '1970-01-01 00:00:00.000000'
                    AS DATETIME(6)
                  )
                ) AS window_start
              ) AS w
            `;

            if (windowRows.length !== 1) {
              throw new Error(
                'Tidak dapat menghitung fixed window UTC.'
              );
            }

            const windowStart = parseMysqlUtcDateTime(
              windowRows[0].windowStartUtc,
              'windowStart'
            );

            const windowEnd = parseMysqlUtcDateTime(
              windowRows[0].windowEndUtc,
              'windowEnd'
            );

            await tx.$executeRaw`
              INSERT INTO generator_usage_counters (
                id,
                scope,
                key_hash,
                window_seconds,
                window_start,
                window_end,
                usage_count
              )
              VALUES (
                ${randomUUID()},
                ${params.scope},
                ${params.keyHash},
                ${params.windowSeconds},
                ${windowStart},
                ${windowEnd},
                0
              )
              ON DUPLICATE KEY UPDATE id = id
            `;

            const rows = await tx.$queryRaw<
              Array<{ usageCount: number | bigint }>
            >`
              SELECT usage_count AS usageCount
              FROM generator_usage_counters
              WHERE scope = ${params.scope}
                AND key_hash = ${params.keyHash}
                AND window_seconds = ${params.windowSeconds}
                AND window_start = ${windowStart}
              FOR UPDATE
            `;

            if (rows.length !== 1) {
              throw new Error(
                'Quota counter tidak ditemukan setelah operasi insert.'
              );
            }

            const clockRows = await tx.$queryRaw<
              Array<{ databaseNowUtc: string }>
            >`
              SELECT DATE_FORMAT(
                UTC_TIMESTAMP(3),
                '%Y-%m-%d %H:%i:%s.%f'
              ) AS databaseNowUtc
            `;

            if (clockRows.length !== 1) {
              throw new Error(
                'Tidak dapat membaca waktu UTC database.'
              );
            }

            const databaseNow = parseMysqlUtcDateTime(
              clockRows[0].databaseNowUtc,
              'databaseNow'
            );

            if (databaseNow.getTime() >= windowEnd.getTime()) {
              throw new QuotaWindowExpiredError();
            }

            const currentCount = Number(rows[0].usageCount);

            if (
              !Number.isSafeInteger(currentCount) ||
              currentCount < 0
            ) {
              throw new Error(
                'Nilai quota counter dari database tidak valid.'
              );
            }

            snapshots.push({
              index: item.index,
              params,
              windowStart,
              windowEnd,
              currentCount,
            });
          }

          // Phase 2: Check every limit before incrementing anything.
          const denied = snapshots.find(
            (snapshot) =>
              snapshot.currentCount >= snapshot.params.limit
          );

          if (denied) {
            const results: IncrementCounterResult[] =
              new Array(paramsList.length);

            for (const snapshot of snapshots) {
              results[snapshot.index] = {
                allowed:
                  snapshot.currentCount < snapshot.params.limit,
                usageCount: snapshot.currentCount,
                remaining: Math.max(
                  0,
                  snapshot.params.limit - snapshot.currentCount
                ),
                windowStart: snapshot.windowStart,
                windowEnd: snapshot.windowEnd,
              };
            }

            // Throwing forces Prisma to roll back all inserts
            // and changes made by this transaction.
            throw new QuotaLimitReachedError({
              allowed: false,
              results,
              deniedIndex: denied.index,
            });
          }

          // Phase 3: All counters have capacity. Increment all.
          const results: IncrementCounterResult[] =
            new Array(paramsList.length);

          for (const snapshot of snapshots) {
            const { params, windowStart, windowEnd } = snapshot;

            const updated = await tx.$executeRaw`
              UPDATE generator_usage_counters
              SET
                usage_count = usage_count + 1,
                updated_at = UTC_TIMESTAMP(3)
              WHERE scope = ${params.scope}
                AND key_hash = ${params.keyHash}
                AND window_seconds = ${params.windowSeconds}
                AND window_start = ${windowStart}
                AND window_end > UTC_TIMESTAMP(3)
                AND usage_count < ${params.limit}
            `;

            if (updated !== 1) {
              const freshnessRows = await tx.$queryRaw<
                Array<{ databaseNowUtc: string }>
              >`
                SELECT DATE_FORMAT(
                  UTC_TIMESTAMP(3),
                  '%Y-%m-%d %H:%i:%s.%f'
                ) AS databaseNowUtc
              `;

              if (freshnessRows.length !== 1) {
                throw new Error(
                  'Tidak dapat memverifikasi waktu UTC database.'
                );
              }

              const latestDatabaseTime = parseMysqlUtcDateTime(
                freshnessRows[0].databaseNowUtc,
                'databaseNow'
              );

              if (
                latestDatabaseTime.getTime() >=
                windowEnd.getTime()
              ) {
                throw new QuotaWindowExpiredError();
              }

              throw new Error(
                'Atomic quota increment gagal atau hasilnya tidak sesuai.'
              );
            }

            const nextCount = snapshot.currentCount + 1;

            results[snapshot.index] = {
              allowed: true,
              usageCount: nextCount,
              remaining: Math.max(
                0,
                params.limit - nextCount
              ),
              windowStart,
              windowEnd,
            };
          }

          return {
            allowed: true,
            results,
            deniedIndex: null,
          };
        }, {
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        });
      } catch (error) {
        // A quota denial is an expected result, not a retry.
        if (error instanceof QuotaLimitReachedError) {
          return error.result;
        }

        const retryable =
          error instanceof QuotaWindowExpiredError ||
          isRetryableTransactionError(error);

        if (!retryable || attempt === MAX_TRANSACTION_RETRIES) {
          throw error;
        }
      }
    }

    throw new Error(
      'GENERATOR_QUOTA_TRANSACTION_FAILED: Transaksi quota gagal.'
    );
  }

  /**
   * Backward-compatible single-counter API.
   */
  async incrementCounter(
    params: IncrementCounterParams
  ): Promise<IncrementCounterResult> {
    const result = await this.incrementCounters([params]);

    return result.results[0];
  }

  /**
   * Acquires a per-user execution lock.
   *
   * Acquisition and expiration timestamps use the MySQL UTC clock.
   * An active lock owned by another request cannot be replaced.
   * An expired lock can be reclaimed while holding its row lock.
   */
  async acquireExecutionLock(
    params: AcquireExecutionLockParams
  ): Promise<AcquireExecutionLockResult> {
    validateLockParams(params);

    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO generator_execution_locks (
          id,
          user_id,
          owner_token,
          acquired_at,
          expires_at
        )
        VALUES (
          ${randomUUID()},
          ${params.userId},
          ${params.ownerToken},
          UTC_TIMESTAMP(3),
          TIMESTAMPADD(
            SECOND,
            ${params.leaseSeconds},
            UTC_TIMESTAMP(3)
          )
        )
        ON DUPLICATE KEY UPDATE id = id
      `;

      const rows = await tx.$queryRaw<
        Array<{
          ownerToken: string;
          expiresAtUtc: string;
          isActive: boolean | number;
        }>
      >`
        SELECT
          owner_token AS ownerToken,
          DATE_FORMAT(
            expires_at,
            '%Y-%m-%d %H:%i:%s.%f'
          ) AS expiresAtUtc,
          (expires_at > UTC_TIMESTAMP(3)) AS isActive
        FROM generator_execution_locks
        WHERE user_id = ${params.userId}
        FOR UPDATE
      `;

      if (rows.length !== 1) {
        throw new Error(
          'Execution lock tidak ditemukan setelah operasi insert.'
        );
      }

      const currentLock = rows[0];
      const currentExpiresAt = parseMysqlUtcDateTime(
        currentLock.expiresAtUtc,
        'lock.expiresAt'
      );

      if (Number(currentLock.isActive) === 1) {
        return {
          acquired: currentLock.ownerToken === params.ownerToken,
          expiresAt: currentExpiresAt,
        };
      }

      const updated = await tx.$executeRaw`
        UPDATE generator_execution_locks
        SET
          owner_token = ${params.ownerToken},
          acquired_at = UTC_TIMESTAMP(3),
          expires_at = TIMESTAMPADD(
            SECOND,
            ${params.leaseSeconds},
            UTC_TIMESTAMP(3)
          ),
          updated_at = UTC_TIMESTAMP(3)
        WHERE user_id = ${params.userId}
          AND expires_at <= UTC_TIMESTAMP(3)
      `;

      if (updated !== 1) {
        throw new Error(
          'Pengambilalihan execution lock gagal atau hasilnya tidak sesuai.'
        );
      }

      const refreshedRows = await tx.$queryRaw<
        Array<{ ownerToken: string; expiresAtUtc: string }>
      >`
        SELECT
          owner_token AS ownerToken,
          DATE_FORMAT(
            expires_at,
            '%Y-%m-%d %H:%i:%s.%f'
          ) AS expiresAtUtc
        FROM generator_execution_locks
        WHERE user_id = ${params.userId}
      `;

      if (
        refreshedRows.length !== 1 ||
        refreshedRows[0].ownerToken !== params.ownerToken
      ) {
        throw new Error('Verifikasi kepemilikan execution lock gagal.');
      }

      return {
        acquired: true,
        expiresAt: parseMysqlUtcDateTime(
          refreshedRows[0].expiresAtUtc,
          'lock.expiresAt'
        ),
      };
    });
  }

  /**
   * Releases a lock only when the owner token still matches.
   * A stale request cannot release another request's lock.
   */
  async releaseExecutionLock(
    userId: string,
    ownerToken: string
  ): Promise<boolean> {
    if (
      typeof userId !== 'string' ||
      userId.length === 0 ||
      userId.length > 36
    ) {
      throw new TypeError('userId tidak valid.');
    }

    validateHash(ownerToken, 'ownerToken');

    const deleted = await this.db.generatorExecutionLock.deleteMany({
      where: {
        userId,
        ownerToken,
      },
    });

    return deleted.count === 1;
  }

  /**
   * Removes expired quota rows in bounded batches.
   * Expiration is evaluated using the MySQL UTC clock.
   */
  async cleanupExpiredCounters(batchSize = 500): Promise<number> {
    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 5000
    ) {
      throw new TypeError('batchSize harus antara 1 dan 5000.');
    }

    return this.db.$executeRaw`
      DELETE FROM generator_usage_counters
      WHERE window_end <= UTC_TIMESTAMP(3)
      ORDER BY window_end ASC
      LIMIT ${batchSize}
    `;
  }
}

export const generatorQuotaRepository =
  new GeneratorQuotaRepository();
