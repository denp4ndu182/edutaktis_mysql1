import assert from 'node:assert/strict';

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET =
    'session_secret_for_b12_quota_security_test_2026';
  process.env.GENERATOR_QUOTA_SECRET =
    'independent_quota_secret_for_b12_test_2026';

  const security = await import('../src/security/generatorQuotaSecurity');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL: ${name}`, error);
    }
  }

  test('Valid quota secret diterima', () => {
    security.validateGeneratorQuotaSecret();
  });

  test('Secret kosong ditolak saat membuat hash', () => {
    process.env.GENERATOR_QUOTA_SECRET = '';
    assert.throws(() =>
      security.createGeneratorQuotaHash('ip', '192.168.1.1')
    );
  });

  test('Secret pendek ditolak', () => {
    process.env.GENERATOR_QUOTA_SECRET = 'short-secret';
    assert.throws(() => security.validateGeneratorQuotaSecret());
  });

  test('Secret sama dengan SESSION_SECRET ditolak', () => {
    process.env.GENERATOR_QUOTA_SECRET =
      process.env.SESSION_SECRET!;
    assert.throws(() => security.validateGeneratorQuotaSecret());
  });

  test('Secret development yang dikenal ditolak', () => {
    process.env.GENERATOR_QUOTA_SECRET =
      'edutaktis_dev_secret_key_32_characters_minimum_entropy_salt_2025';
    assert.throws(() => security.validateGeneratorQuotaSecret());
  });

  process.env.GENERATOR_QUOTA_SECRET =
    'independent_quota_secret_for_b12_test_2026';

  test('IP IPv4 valid diterima', () => {
    assert.equal(
      security.normalizeClientIp('192.168.1.1'),
      '192.168.1.1'
    );
  });

  test('IP IPv4 dengan leading zero ditolak', () => {
    assert.throws(() =>
      security.normalizeClientIp('192.168.001.001')
    );
  });

  test('IPv6 dinormalisasi', () => {
    assert.equal(
      security.normalizeClientIp('2001:0db8:0:0:0:0:0:1'),
      '2001:db8::1'
    );
  });

  test('IPv4-mapped IPv6 dinormalisasi menjadi IPv4', () => {
    assert.equal(
      security.normalizeClientIp('::ffff:192.168.1.1'),
      '192.168.1.1'
    );
  });

  test('IP tidak valid ditolak', () => {
    assert.throws(() => security.normalizeClientIp('not-an-ip'));
  });

  test('Hash IP menghasilkan HMAC-SHA256 64 karakter', () => {
    const hash = security.createGeneratorQuotaHash('ip', '192.168.1.1');
    assert.match(hash, /^[a-f0-9]{64}$/);
  });

  test('Hash IP konsisten untuk input yang sama', () => {
    const first = security.createGeneratorQuotaHash('ip', '192.168.1.1');
    const second = security.createGeneratorQuotaHash('ip', '192.168.1.1');
    assert.equal(first, second);
  });

  test('Namespace IP dan user menghasilkan hash berbeda', () => {
    const ipHash = security.createGeneratorQuotaHash('ip', '192.168.1.1');
    const userHash = security.createGeneratorQuotaHash('user', '192.168.1.1');
    assert.notEqual(ipHash, userHash);
  });

  test('Representasi IPv6 setara menghasilkan hash sama', () => {
    const first = security.createGeneratorQuotaHash(
      'ip',
      '2001:0db8:0:0:0:0:0:1'
    );
    const second = security.createGeneratorQuotaHash(
      'ip',
      '2001:db8::1'
    );
    assert.equal(first, second);
  });

  test('Secret berbeda menghasilkan hash berbeda', () => {
    const first = security.createGeneratorQuotaHash('ip', '192.168.1.1');

    process.env.GENERATOR_QUOTA_SECRET =
      'another_independent_quota_secret_for_test_2026';

    const second = security.createGeneratorQuotaHash('ip', '192.168.1.1');
    assert.notEqual(first, second);
  });

  test('Production menolak secret yang tidak tersedia', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GENERATOR_QUOTA_SECRET;
    assert.throws(() => security.validateGeneratorQuotaSecret());
  });

  test('Production menerima secret valid yang terpisah', () => {
    process.env.GENERATOR_QUOTA_SECRET =
      'production_quota_secret_for_b12_test_2026';
    assert.doesNotThrow(() => security.validateGeneratorQuotaSecret());
  });

  console.log('');
  console.log(`B12-05G-02 RESULT: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
