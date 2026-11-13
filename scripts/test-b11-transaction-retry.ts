import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma';
import {
  withOnboardingTransaction,
} from '../src/security/onboardingTransaction';
import {
  withSuperAdminGuard,
} from '../src/security/superAdminGuard';

type TransactionOperation = (tx: any) => Promise<any>;

type TransactionWrapper = (
  operation: TransactionOperation
) => Promise<any>;

const wrappers: {
  name: string;
  run: TransactionWrapper;
}[] = [
  {
    name: 'ONBOARDING',
    run: withOnboardingTransaction,
  },
  {
    name: 'SUPER_ADMIN',
    run: withSuperAdminGuard,
  },
];

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${message}`);
    return;
  }

  passed++;
  console.log(`PASS ${passed}: ${message}`);
}

function makeError(message: string, code?: string): Error {
  const error = new Error(message);

  if (code) {
    (error as any).code = code;
  }

  return error;
}

function verifyOptions(
  options: any,
  label: string
): void {
  assert(
    options?.isolationLevel ===
      Prisma.TransactionIsolationLevel.Serializable,
    `${label}: isolation level Serializable`
  );

  assert(
    options?.maxWait === 15000,
    `${label}: maxWait 15000 ms`
  );

  assert(
    options?.timeout === 30000,
    `${label}: timeout 30000 ms`
  );
}

async function withTransactionMock(
  mock: (...args: any[]) => Promise<any>,
  operation: () => Promise<void>
): Promise<void> {
  const client = prisma as any;
  const originalTransaction = client.$transaction;

  try {
    client.$transaction = mock;
    await operation();
  } finally {
    client.$transaction = originalTransaction;
  }
}

async function testRetryOnce(
  wrapper: typeof wrappers[number]
): Promise<void> {
  let attempts = 0;
  let callbackCalls = 0;
  const optionsSeen: any[] = [];

  const mock = async (
    callback: TransactionOperation,
    options: any
  ) => {
    attempts++;
    optionsSeen.push(options);

    if (attempts === 1) {
      throw makeError('Simulated write conflict', 'P2034');
    }

    return callback({ mockTransaction: true });
  };

  await withTransactionMock(mock, async () => {
    const result = await wrapper.run(async (tx) => {
      callbackCalls++;
      return tx.mockTransaction ? 'SUCCESS' : 'INVALID';
    });

    assert(
      result === 'SUCCESS',
      `${wrapper.name}: retry menghasilkan keberhasilan`
    );
  });

  assert(
    attempts === 2,
    `${wrapper.name}: P2034 menghasilkan 2 percobaan`
  );

  assert(
    callbackCalls === 1,
    `${wrapper.name}: callback hanya berhasil dieksekusi sekali`
  );

  assert(
    optionsSeen.length === 2,
    `${wrapper.name}: opsi transaksi dikirim pada setiap percobaan`
  );

  for (const options of optionsSeen) {
    verifyOptions(options, wrapper.name);
  }
}


async function testRetryAfterCallback(
  wrapper: typeof wrappers[number]
): Promise<void> {
  let attempts = 0;
  let callbackCalls = 0;
  const optionsSeen: any[] = [];

  const mock = async (
    callback: TransactionOperation,
    options: any
  ) => {
    attempts++;
    optionsSeen.push(options);

    // Simulasi callback berhasil, tetapi commit gagal dengan P2034.
    const result = await callback({ mockTransaction: true });

    if (attempts === 1) {
      throw makeError(
        'Simulated commit conflict',
        'P2034'
      );
    }

    return result;
  };

  let result: unknown;

  await withTransactionMock(mock, async () => {
    result = await wrapper.run(async (tx) => {
      callbackCalls++;
      return tx.mockTransaction ? 'SUCCESS' : 'INVALID';
    });
  });

  assert(
    result === 'SUCCESS',
    `${wrapper.name}: retry setelah callback menghasilkan keberhasilan`
  );

  assert(
    attempts === 2,
    `${wrapper.name}: konflik setelah callback menghasilkan 2 percobaan`
  );

  assert(
    callbackCalls === 2,
    `${wrapper.name}: callback dijalankan ulang setelah simulasi commit conflict`
  );

  assert(
    optionsSeen.length === 2,
    `${wrapper.name}: opsi transaksi tersedia pada kedua percobaan`
  );

  for (const options of optionsSeen) {
    verifyOptions(options, wrapper.name);
  }
}

async function testRetryExhausted(
  wrapper: typeof wrappers[number]
): Promise<void> {
  let attempts = 0;
  let callbackCalls = 0;
  let finalError: unknown;
  const optionsSeen: any[] = [];

  const mock = async (
    _callback: TransactionOperation,
    options: any
  ) => {
    attempts++;
    optionsSeen.push(options);

    const error = makeError(
      `Simulated conflict ${attempts}`,
      'P2034'
    );

    finalError = error;
    throw error;
  };

  let caught: unknown;

  await withTransactionMock(mock, async () => {
    try {
      await wrapper.run(async () => {
        callbackCalls++;
        return null;
      });
    } catch (error) {
      caught = error;
    }
  });

  assert(
    attempts === 3,
    `${wrapper.name}: berhenti setelah 3 percobaan`
  );

  assert(
    callbackCalls === 0,
    `${wrapper.name}: callback tidak dijalankan ketika transaksi gagal sebelum callback`
  );

  assert(
    caught === finalError,
    `${wrapper.name}: error terakhir diteruskan kepada pemanggil`
  );

  assert(
    optionsSeen.length === 3,
    `${wrapper.name}: konfigurasi dikirim pada ketiga percobaan`
  );

  for (const options of optionsSeen) {
    verifyOptions(options, wrapper.name);
  }
}

async function testP2002(
  wrapper: typeof wrappers[number]
): Promise<void> {
  let attempts = 0;
  let callbackCalls = 0;

  const expectedError = makeError(
    'Simulated unique constraint violation',
    'P2002'
  );

  const mock = async (
    callback: TransactionOperation
  ) => {
    attempts++;

    return callback({ mockTransaction: true });
  };

  let caught: unknown;

  await withTransactionMock(mock, async () => {
    try {
      await wrapper.run(async () => {
        callbackCalls++;
        throw expectedError;
      });
    } catch (error) {
      caught = error;
    }
  });

  assert(
    attempts === 1,
    `${wrapper.name}: P2002 tidak di-retry`
  );

  assert(
    callbackCalls === 1,
    `${wrapper.name}: callback P2002 dijalankan sekali`
  );

  assert(
    caught === expectedError,
    `${wrapper.name}: error P2002 diteruskan tanpa perubahan`
  );
}

async function testBusinessError(
  wrapper: typeof wrappers[number]
): Promise<void> {
  let attempts = 0;
  let callbackCalls = 0;

  const expectedError = makeError(
    'SIMULATED_BUSINESS_VALIDATION_ERROR'
  );

  const mock = async (
    callback: TransactionOperation
  ) => {
    attempts++;
    return callback({ mockTransaction: true });
  };

  let caught: unknown;

  await withTransactionMock(mock, async () => {
    try {
      await wrapper.run(async () => {
        callbackCalls++;
        throw expectedError;
      });
    } catch (error) {
      caught = error;
    }
  });

  assert(
    attempts === 1,
    `${wrapper.name}: error bisnis tidak di-retry`
  );

  assert(
    callbackCalls === 1,
    `${wrapper.name}: callback error bisnis dijalankan sekali`
  );

  assert(
    caught === expectedError,
    `${wrapper.name}: error bisnis diteruskan kepada pemanggil`
  );
}

async function runWrapperSuite(
  wrapper: typeof wrappers[number]
): Promise<void> {
  console.log(`\n========== ${wrapper.name} ==========`);

  await testRetryOnce(wrapper);
  await testRetryAfterCallback(wrapper);
  await testRetryExhausted(wrapper);
  await testP2002(wrapper);
  await testBusinessError(wrapper);
}

async function main(): Promise<void> {
  const client = prisma as any;

  const descriptor = Object.getOwnPropertyDescriptor(
    client,
    '$transaction'
  );

  if (descriptor && descriptor.writable === false) {
    throw new Error(
      'STOP: Prisma $transaction tidak dapat di-mock.'
    );
  }

  console.log('B11-05 MOCK TEST');
  console.log('Mode: No database transaction');
  console.log('Production code: Tidak diubah');

  for (const wrapper of wrappers) {
    await runWrapperSuite(wrapper);
  }

  console.log('\n========== B11-05 SUMMARY ==========');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('B11-05 MOCK TEST: ALL PASSED');
  }
}

main().catch((error) => {
  console.error('\nB11-05 MOCK TEST FAILED:', error);
  process.exitCode = 1;
});
