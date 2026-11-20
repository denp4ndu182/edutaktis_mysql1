import assert from 'node:assert/strict';
import { sanitizeAuditDetails } from '../src/repositories/auditLogRepository';

const input = {
  action: 'USER_UPDATED',
  targetUserId: 'user-test-001',
  apiKey: 'should-not-appear',
  privateKey: 'should-not-appear',
  accessKey: 'should-not-appear',
  clientSecret: 'should-not-appear',
  credential: 'should-not-appear',
  refreshToken: 'should-not-appear',
  passwordHash: 'should-not-appear',
  email: 'should-not-appear',
  phone: 'should-not-appear',
  safeMetadata: {
    source: 'platform-admin',
    count: 3,
  },
};

const result = sanitizeAuditDetails(input) as Record<string, unknown>;

assert.equal(result.action, 'USER_UPDATED');
assert.equal(result.targetUserId, 'user-test-001');
assert.deepEqual(result.safeMetadata, {
  source: 'platform-admin',
  count: 3,
});

for (const key of [
  'apiKey',
  'privateKey',
  'accessKey',
  'clientSecret',
  'credential',
  'refreshToken',
  'passwordHash',
  'email',
  'phone',
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, key),
    false,
    `Field sensitif tidak terhapus: ${key}`
  );
}

const longString = 'x'.repeat(600);
const longResult = sanitizeAuditDetails({ description: longString }) as {
  description: string;
};

assert.equal(longResult.description.length, 501);
assert.ok(longResult.description.endsWith('…'));

const nestedResult = sanitizeAuditDetails({
  level1: {
    level2: {
      level3: {
        level4: {
          level5: {
            value: 'too-deep',
          },
        },
      },
    },
  },
}) as Record<string, any>;

assert.equal(
  nestedResult.level1.level2.level3.level4.level5,
  '[DEPTH_LIMIT]'
);

console.log('PASS: FT-09A audit sanitizer tests.');
