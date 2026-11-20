import { randomBytes } from 'node:crypto';
import { GeneratorUsageScope } from '@prisma/client';

import {
  generatorQuotaRepository,
  type IncrementCounterParams,
  type IncrementCountersResult,
  type AcquireExecutionLockParams,
  type AcquireExecutionLockResult,
} from '../repositories/generatorQuotaRepository';

import { createGeneratorQuotaHash } from '../security/generatorQuotaSecurity';

const IP_BURST_WINDOW_SECONDS = 60;
const IP_BURST_LIMIT = 3;

const IP_WINDOW_SECONDS = 900;
const IP_LIMIT = 10;

const USER_WINDOW_SECONDS = 900;
const USER_LIMIT = 5;

const USER_DAILY_WINDOW_SECONDS = 86400;
const USER_DAILY_LIMIT = 30;

const EXECUTION_LOCK_LEASE_SECONDS = 120;

export interface GeneratorQuotaRepositoryPort {
  incrementCounters(
    params: IncrementCounterParams[]
  ): Promise<IncrementCountersResult>;

  acquireExecutionLock(
    params: AcquireExecutionLockParams
  ): Promise<AcquireExecutionLockResult>;

  releaseExecutionLock(
    userId: string,
    ownerToken: string
  ): Promise<boolean>;
}

export interface GeneratorQuotaContext {
  userId: string;
  clientIp: string;
}

export class GeneratorQuotaServiceError extends Error {
  constructor(
    public readonly code:
      | 'IP_RATE_LIMITED'
      | 'USER_QUOTA_EXCEEDED'
      | 'GENERATION_IN_PROGRESS'
      | 'QUOTA_SERVICE_UNAVAILABLE',
    public readonly statusCode: 409 | 429 | 503,
    public readonly retryAfterSeconds?: number
  ) {
    super(code);
    this.name = 'GeneratorQuotaServiceError';
  }
}

function getRetryAfterSeconds(windowEnd: Date): number {
  return Math.max(
    1,
    Math.ceil((windowEnd.getTime() - Date.now()) / 1000)
  );
}

function getDeniedRetryAfter(
  result: IncrementCountersResult
): number {
  const deniedIndex = result.deniedIndex;

  if (
    deniedIndex === null ||
    !result.results[deniedIndex]
  ) {
    throw new GeneratorQuotaServiceError(
      'QUOTA_SERVICE_UNAVAILABLE',
      503
    );
  }

  return getRetryAfterSeconds(result.results[deniedIndex].windowEnd);
}

export class GeneratorQuotaService {
  constructor(
    private readonly repository: GeneratorQuotaRepositoryPort =
      generatorQuotaRepository
  ) {}

  private validateContext(context: GeneratorQuotaContext): void {
    if (
      !context ||
      typeof context.userId !== 'string' ||
      context.userId.length === 0 ||
      context.userId.length > 36 ||
      typeof context.clientIp !== 'string'
    ) {
      throw new TypeError('Generator quota context tidak valid.');
    }
  }

  async consumeIpQuota(
    context: GeneratorQuotaContext
  ): Promise<void> {
    this.validateContext(context);
    const ipHash = createGeneratorQuotaHash('ip', context.clientIp);
    const ipCounters: IncrementCounterParams[] = [
      { scope: GeneratorUsageScope.IP, keyHash: ipHash, windowSeconds: IP_BURST_WINDOW_SECONDS, limit: IP_BURST_LIMIT },
      { scope: GeneratorUsageScope.IP, keyHash: ipHash, windowSeconds: IP_WINDOW_SECONDS, limit: IP_LIMIT },
    ];
    let result: IncrementCountersResult;
    try {
      result = await this.repository.incrementCounters(ipCounters);
    } catch {
      throw new GeneratorQuotaServiceError('QUOTA_SERVICE_UNAVAILABLE', 503);
    }
    if (!result.allowed) {
      throw new GeneratorQuotaServiceError('IP_RATE_LIMITED', 429, getDeniedRetryAfter(result));
    }
  }

  async runWithUserQuota<T>(
    context: GeneratorQuotaContext,
    operation: () => Promise<T>
  ): Promise<T> {
    this.validateContext(context);
    if (typeof operation !== 'function') {
      throw new TypeError('Generator operation tidak valid.');
    }
    const ownerToken = randomBytes(32).toString('hex');
    let lock: AcquireExecutionLockResult;
    try {
      lock = await this.repository.acquireExecutionLock({
        userId: context.userId,
        ownerToken,
        leaseSeconds: EXECUTION_LOCK_LEASE_SECONDS,
      });
    } catch {
      throw new GeneratorQuotaServiceError('QUOTA_SERVICE_UNAVAILABLE', 503);
    }
    if (!lock.acquired) {
      throw new GeneratorQuotaServiceError(
        'GENERATION_IN_PROGRESS',
        409,
        lock.expiresAt ? getRetryAfterSeconds(lock.expiresAt) : undefined
      );
    }
    let primaryErrorOccurred = false;
    try {
      const userHash = createGeneratorQuotaHash('user', context.userId);
      const userCounters: IncrementCounterParams[] = [
        { scope: GeneratorUsageScope.USER, keyHash: userHash, windowSeconds: USER_WINDOW_SECONDS, limit: USER_LIMIT },
        { scope: GeneratorUsageScope.USER, keyHash: userHash, windowSeconds: USER_DAILY_WINDOW_SECONDS, limit: USER_DAILY_LIMIT },
      ];
      let userResult: IncrementCountersResult;
      try {
        userResult = await this.repository.incrementCounters(userCounters);
      } catch {
        throw new GeneratorQuotaServiceError('QUOTA_SERVICE_UNAVAILABLE', 503);
      }
      if (!userResult.allowed) {
        throw new GeneratorQuotaServiceError(
          'USER_QUOTA_EXCEEDED',
          429,
          getDeniedRetryAfter(userResult)
        );
      }
      return await operation();
    } catch (error) {
      primaryErrorOccurred = true;
      throw error;
    } finally {
      try {
        const released = await this.repository.releaseExecutionLock(
          context.userId,
          ownerToken
        );
        if (!released) {
          throw new Error('Execution lock release was not confirmed.');
        }
      } catch {
        if (!primaryErrorOccurred) {
          throw new GeneratorQuotaServiceError('QUOTA_SERVICE_UNAVAILABLE', 503);
        }
      }
    }
  }

  async runWithQuota<T>(
    context: GeneratorQuotaContext,
    operation: () => Promise<T>
  ): Promise<T> {
    this.validateContext(context);
    if (typeof operation !== 'function') {
      throw new TypeError('Generator operation tidak valid.');
    }
    await this.consumeIpQuota(context);
    return this.runWithUserQuota(context, operation);
  }
}

export const generatorQuotaService = new GeneratorQuotaService();
