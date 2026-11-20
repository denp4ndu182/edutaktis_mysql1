import assert from 'node:assert/strict';
import { GeneratorUsageScope } from '@prisma/client';
import type { GeneratorQuotaRepositoryPort } from '../src/services/generatorQuotaService';

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET =
    'session_secret_for_b12_quota_service_test_2026';
  process.env.GENERATOR_QUOTA_SECRET =
    'independent_quota_secret_for_b12_service_test_2026';

  const {
    GeneratorQuotaService,
    GeneratorQuotaServiceError,
  } = await import('../src/services/generatorQuotaService');

  const {
    GeneratorUsageScope: Scope,
  } = await import('@prisma/client');

  class FakeRepository implements GeneratorQuotaRepositoryPort {
    counterCalls: any[][] = [];
    lockCalls: any[] = [];
    releaseCalls: any[] = [];

    ipAllowed = true;
    userAllowed = true;
    lockAcquired = true;
    releaseOk = true;
    failAt: 'ip' | 'user' | 'lock' | 'release' | null = null;

    async incrementCounters(params: any[]) {
      this.counterCalls.push(params);

      const isIp = params[0].scope === Scope.IP;

      if (
        (isIp && this.failAt === 'ip') ||
        (!isIp && this.failAt === 'user')
      ) {
        throw new Error('Simulated repository failure');
      }

      const allowed = isIp ? this.ipAllowed : this.userAllowed;
      const deniedIndex = allowed ? null : 0;

      return {
        allowed,
        deniedIndex,
        results: params.map((item, index) => ({
          allowed: allowed || index !== deniedIndex,
          usageCount: allowed ? 1 : item.limit,
          remaining: allowed ? item.limit - 1 : 0,
          windowStart: new Date(Date.now() - 1000),
          windowEnd: new Date(Date.now() + 60000),
        })),
      };
    }

    async acquireExecutionLock(params: any) {
      this.lockCalls.push(params);

      if (this.failAt === 'lock') {
        throw new Error('Simulated lock failure');
      }

      return {
        acquired: this.lockAcquired,
        expiresAt: this.lockAcquired
          ? new Date(Date.now() + params.leaseSeconds * 1000)
          : new Date(Date.now() + 30000),
      };
    }

    async releaseExecutionLock(userId: string, ownerToken: string) {
      this.releaseCalls.push({ userId, ownerToken });

      if (this.failAt === 'release') {
        throw new Error('Simulated release failure');
      }

      return this.releaseOk;
    }
  }

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL: ${name}`, error);
    }
  }

  function createContext() {
    return {
      userId: 'test-user-123',
      clientIp: '192.168.10.25',
    };
  }

  await test('Sukses: reservasi IP, user, dan release lock', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);
    let executed = false;

    const result = await service.runWithQuota(
      createContext(),
      async () => {
        executed = true;
        return 'generated';
      }
    );

    assert.equal(result, 'generated');
    assert.equal(executed, true);
    assert.equal(repo.counterCalls.length, 2);
    assert.equal(repo.counterCalls[0][0].scope, GeneratorUsageScope.IP);
    assert.equal(repo.counterCalls[1][0].scope, GeneratorUsageScope.USER);
    assert.equal(repo.counterCalls[0].length, 2);
    assert.equal(repo.counterCalls[1].length, 2);
    assert.equal(repo.counterCalls[0][0].windowSeconds, 60);
    assert.equal(repo.counterCalls[0][0].limit, 3);
    assert.equal(repo.counterCalls[0][1].windowSeconds, 900);
    assert.equal(repo.counterCalls[0][1].limit, 10);
    assert.equal(repo.counterCalls[1][0].limit, 5);
    assert.equal(repo.counterCalls[1][1].windowSeconds, 86400);
    assert.equal(repo.counterCalls[1][1].limit, 30);
    assert.equal(repo.lockCalls[0].leaseSeconds, 120);
    assert.equal(repo.releaseCalls.length, 1);
    assert.equal(repo.releaseCalls[0].userId, 'test-user-123');
  });

  await test('IP quota ditolak: user quota dan lock tidak dijalankan', async () => {
    const repo = new FakeRepository();
    repo.ipAllowed = false;
    const service = new GeneratorQuotaService(repo);
    let executed = false;

    await assert.rejects(
      service.runWithQuota(createContext(), async () => {
        executed = true;
      }),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.code === 'IP_RATE_LIMITED' &&
        error.statusCode === 429
    );

    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.lockCalls.length, 0);
    assert.equal(repo.releaseCalls.length, 0);
    assert.equal(executed, false);
  });

  await test('Execution lock aktif: user quota tidak dikonsumsi', async () => {
    const repo = new FakeRepository();
    repo.lockAcquired = false;
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => 'unexpected'),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.code === 'GENERATION_IN_PROGRESS' &&
        error.statusCode === 409
    );

    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.lockCalls.length, 1);
    assert.equal(repo.releaseCalls.length, 0);
  });

  await test('User quota ditolak: execution lock dilepaskan', async () => {
    const repo = new FakeRepository();
    repo.userAllowed = false;
    const service = new GeneratorQuotaService(repo);
    let executed = false;

    await assert.rejects(
      service.runWithQuota(createContext(), async () => {
        executed = true;
      }),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.code === 'USER_QUOTA_EXCEEDED' &&
        error.statusCode === 429
    );

    assert.equal(repo.counterCalls.length, 2);
    assert.equal(repo.releaseCalls.length, 1);
    assert.equal(executed, false);
  });

  await test('IP quota store gagal menghasilkan 503', async () => {
    const repo = new FakeRepository();
    repo.failAt = 'ip';
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => 'unexpected'),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.code === 'QUOTA_SERVICE_UNAVAILABLE' &&
        error.statusCode === 503
    );

    assert.equal(repo.lockCalls.length, 0);
  });

  await test('User quota store gagal: lock tetap dilepaskan', async () => {
    const repo = new FakeRepository();
    repo.failAt = 'user';
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => 'unexpected'),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.statusCode === 503
    );

    assert.equal(repo.releaseCalls.length, 1);
  });

  await test('Lock store gagal menghasilkan 503', async () => {
    const repo = new FakeRepository();
    repo.failAt = 'lock';
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => 'unexpected'),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.statusCode === 503
    );

    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.releaseCalls.length, 0);
  });

  await test('Generator gagal: lock tetap dilepaskan dan error asli dipertahankan', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => {
        throw new Error('GENERATOR_TEST_FAILURE');
      }),
      /GENERATOR_TEST_FAILURE/
    );

    assert.equal(repo.releaseCalls.length, 1);
  });

  await test('Release lock gagal setelah generator sukses menghasilkan 503', async () => {
    const repo = new FakeRepository();
    repo.failAt = 'release';
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.runWithQuota(createContext(), async () => 'generated'),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.statusCode === 503
    );
  });

  await test('Quota hash tidak menyimpan IP mentah', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);

    await service.runWithQuota(createContext(), async () => 'generated');

    const ipHash = repo.counterCalls[0][0].keyHash;

    assert.match(ipHash, /^[a-f0-9]{64}$/);
    assert.notEqual(ipHash, '192.168.10.25');
  });


  await test('consumeIpQuota hanya mengonsumsi kuota IP', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);

    await service.consumeIpQuota(createContext());

    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.counterCalls[0][0].scope, GeneratorUsageScope.IP);
    assert.equal(repo.counterCalls[0].length, 2);
    assert.equal(repo.lockCalls.length, 0);
    assert.equal(repo.releaseCalls.length, 0);
  });

  await test('consumeIpQuota ditolak: tidak membuat lock atau kuota user', async () => {
    const repo = new FakeRepository();
    repo.ipAllowed = false;
    const service = new GeneratorQuotaService(repo);

    await assert.rejects(
      service.consumeIpQuota(createContext()),
      (error: any) =>
        error instanceof GeneratorQuotaServiceError &&
        error.code === 'IP_RATE_LIMITED' &&
        error.statusCode === 429
    );

    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.lockCalls.length, 0);
    assert.equal(repo.releaseCalls.length, 0);
  });

  await test('runWithUserQuota hanya mengonsumsi kuota user dan mengelola lock', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);
    let executed = false;

    const result = await service.runWithUserQuota(
      createContext(),
      async () => {
        executed = true;
        return 'user-generated';
      }
    );

    assert.equal(result, 'user-generated');
    assert.equal(executed, true);
    assert.equal(repo.counterCalls.length, 1);
    assert.equal(repo.counterCalls[0][0].scope, GeneratorUsageScope.USER);
    assert.equal(repo.counterCalls[0].length, 2);
    assert.equal(repo.lockCalls.length, 1);
    assert.equal(repo.releaseCalls.length, 1);
  });

  await test('runWithUserQuota tidak menjalankan IP quota', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);

    await service.runWithUserQuota(
      createContext(),
      async () => 'generated'
    );

    assert.equal(
      repo.counterCalls.some((call) => call[0].scope === GeneratorUsageScope.IP),
      false
    );
  });

  await test('runWithQuota menjalankan IP lalu user secara berurutan', async () => {
    const repo = new FakeRepository();
    const service = new GeneratorQuotaService(repo);
    const sequence: string[] = [];

    const originalIncrement = repo.incrementCounters.bind(repo);
    repo.incrementCounters = async (params: any[]) => {
      sequence.push(params[0].scope === Scope.IP ? 'IP' : 'USER');
      return originalIncrement(params);
    };

    await service.runWithQuota(createContext(), async () => {
      sequence.push('GENERATOR');
      return 'generated';
    });

    assert.deepEqual(sequence, ['IP', 'USER', 'GENERATOR']);
  });

  console.log('');
  console.log(`B12-05G-03 RESULT: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
