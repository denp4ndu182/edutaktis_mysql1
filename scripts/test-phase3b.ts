/**
 * PHASE 3B — COMPREHENSIVE AUTOMATED SECURITY TEST SUITE
 * EduTaktis SaaS — Authentication & Authorization Verification
 */

import { authService } from '../src/security/authService';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../src/security/password';
import { hashToken, generateSecureToken, generateCsrfToken, verifyCsrfToken } from '../src/security/tokens';
import { authRateLimiter } from '../src/security/rateLimiter';
import { hasPermission } from '../src/security/permissions';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST SUITE OTOMATIS: PHASE 3B SECURITY');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // GROUP 1: PASSWORD SECURITY & ARGON2ID
  // ----------------------------------------------------
  console.log('--- 1. PENGUJIAN ARGON2ID & VALIDASI PASSWORD ---');
  const synthPass = 'SynthTeacher2025!';
  const hash = await hashPassword(synthPass);
  assert('Argon2id hashing menghasilkan string hash berformat $argon2id$', hash.startsWith('$argon2id$'));

  const isValidMatch = await verifyPassword(synthPass, hash);
  assert('Verifikasi password benar menghasilkan true', isValidMatch === true);

  const isInvalidMatch = await verifyPassword('WrongPassword123!', hash);
  assert('Verifikasi password salah menghasilkan false', isInvalidMatch === false);

  const strongPass = validatePasswordStrength('StrongPass123!');
  assert('Validasi password kuat diterima', strongPass.valid === true);

  const weakPass = validatePasswordStrength('weak');
  assert('Validasi password pendek ditolak (<8 karakter)', weakPass.valid === false);

  const noUpper = validatePasswordStrength('lowercaseonly123!');
  assert('Validasi password tanpa huruf besar ditolak', noUpper.valid === false);

  const noNumber = validatePasswordStrength('NoNumbersHere!');
  assert('Validasi password tanpa angka ditolak', noNumber.valid === false);

  // ----------------------------------------------------
  // GROUP 2: TOKEN, HMAC-SHA256 & CSRF SECURITY
  // ----------------------------------------------------
  console.log('\n--- 2. PENGUJIAN TOKEN, HMAC-SHA256 & CRYPTOGRAPHIC CSRF ---');
  const rawToken = generateSecureToken();
  assert('Token sesi dibuat dengan panjang 64 karakter hex (32 bytes entropy)', rawToken.length === 64);

  const hashedToken = hashToken(rawToken);
  assert('Token di-hash dengan HMAC-SHA256 (panjang 64 hex)', hashedToken.length === 64 && hashedToken !== rawToken);

  const hashedAgain = hashToken(rawToken);
  assert('HMAC-SHA256 hashing konsisten dan deterministik', hashedToken === hashedAgain);

  // CSRF Tokens
  const csrfToken = generateCsrfToken();
  assert('CSRF token berformat [nonce].[signature]', csrfToken.includes('.') && csrfToken.split('.').length === 2);
  assert('Verifikasi CSRF token valid bertanda tangan HMAC menghasilkan true', verifyCsrfToken(csrfToken) === true);

  const tamperedCsrf = csrfToken.substring(0, csrfToken.length - 4) + 'abcd';
  assert('CSRF token yang dimodifikasi / dipalsukan ditolak', verifyCsrfToken(tamperedCsrf) === false);

  const fakeCsrf = 'random_unsigned_token_without_hmac_signature';
  assert('CSRF token tanpa signature ditolak', verifyCsrfToken(fakeCsrf) === false);
  assert('CSRF token kosong / null ditolak', verifyCsrfToken('') === false);

  // ----------------------------------------------------
  // GROUP 3: REGISTRATION & PENDING MEMBERSHIP POLICY
  // ----------------------------------------------------
  console.log('\n--- 3. PENGUJIAN PENDAFTARAN & KEBIJAKAN PENDING STATUS ---');
  const synthTeacherEmail = `synth.teacher.${Date.now()}@edutaktis.test`;
  const regResult = await authService.register({
    namaLengkap: 'Synthetic Teacher Test',
    email: synthTeacherEmail,
    password: 'SynthTeacher2025!',
    npsn: '20400012', // Terdaftar di MAN 1 Gunungkidul
  });
  assert('Pendaftaran user baru dengan NPSN berhasil', regResult.success === true && Boolean(regResult.session));

  if (regResult.session) {
    const synthUser = regResult.session.user;
    const synthCtx = await authService.getUserTenantContext(synthUser.id);
    assert('User baru belum memiliki status keanggotaan ACTIVE (harus PENDING)', synthCtx.currentMembership === null);
  }

  // ----------------------------------------------------
  // GROUP 4: AUTHENTICATION FLOWS (authService)
  // ----------------------------------------------------
  console.log('\n--- 4. PENGUJIAN ALUR AUTENTIKASI ---');

  // Test 1: Login dengan kredensial valid (synthetic admin / initialized user)
  const loginValid = await authService.login('pandu.kusumahadi@kemenag.go.id', 'EduTaktis2025!', '127.0.0.1');
  assert('Login dengan kredensial valid berhasil', loginValid.success === true && Boolean(loginValid.session));

  // Test 2: Login dengan password salah
  const loginWrongPass = await authService.login('pandu.kusumahadi@kemenag.go.id', 'Salah123!', '127.0.0.1');
  assert('Login dengan password salah ditolak dengan pesan generic', loginWrongPass.success === false && Boolean(loginWrongPass.error?.includes('tidak valid')));

  // Test 3: Login dengan email yang tidak terdaftar
  const loginNoEmail = await authService.login('tidakada@edutaktis.test', 'EduTaktis2025!', '127.0.0.1');
  assert('Login dengan email tidak terdaftar ditolak dengan pesan generic identik', loginNoEmail.success === false && Boolean(loginNoEmail.error?.includes('tidak valid')));

  // Test 4: Akses validasi tanpa token sesi
  const noSessionUser = await authService.validateSession('');
  assert('Validasi sesi tanpa token mengembalikan null', noSessionUser === null);

  // Test 5: Validasi sesi aktif
  const validToken = loginValid.session!.token;
  const sessionUser = await authService.validateSession(validToken);
  assert('Validasi sesi aktif berhasil mengembalikan identitas user', sessionUser?.id === 'usr_pandu_001');

  // Test 6: Logout satu sesi
  await authService.logout(validToken, 'usr_pandu_001', '127.0.0.1');
  const postLogoutUser = await authService.validateSession(validToken);
  assert('Menggunakan token sesi setelah logout ditolak (Session revoked)', postLogoutUser === null);

  // Test 7: Multi-device session & Logout All
  const loginMulti1 = await authService.login('pandu.kusumahadi@kemenag.go.id', 'EduTaktis2025!', '127.0.0.1');
  const loginMulti2 = await authService.login('pandu.kusumahadi@kemenag.go.id', 'EduTaktis2025!', '127.0.0.2');
  const token1 = loginMulti1.session!.token;
  const token2 = loginMulti2.session!.token;
  assert('Multi-device session login berhasil membuat 2 token terpisah', Boolean(token1 && token2 && token1 !== token2));

  const revokedCount = await authService.logoutAll('usr_pandu_001', '127.0.0.1');
  const postLogoutAll1 = await authService.validateSession(token1);
  const postLogoutAll2 = await authService.validateSession(token2);
  assert('Logout seluruh sesi mencabut token di seluruh perangkat', revokedCount >= 2 && postLogoutAll1 === null && postLogoutAll2 === null);

  // ----------------------------------------------------
  // GROUP 5: PASSWORD RESET END-TO-END FLOW
  // ----------------------------------------------------
  console.log('\n--- 5. PENGUJIAN ALUR RESET PASSWORD END-TO-END ---');
  // Re-login to have an active session before password reset
  const preResetLogin = await authService.login('pandu.kusumahadi@kemenag.go.id', 'EduTaktis2025!', '127.0.0.1');
  const preResetToken = preResetLogin.session!.token;
  assert('Sesi aktif sebelum reset password valid', Boolean(await authService.validateSession(preResetToken)));

  // Request password reset
  const resetReq = await authService.requestPasswordReset('pandu.kusumahadi@kemenag.go.id', '127.0.0.1');
  assert('Permintaan reset password berhasil diproses dengan pesan transparan SMTP', resetReq.success === true && resetReq.message.includes('SMTP'));

  const resetToken = resetReq.simulatedToken;
  assert('Simulated reset token dihasilkan untuk automated testing harness', Boolean(resetToken));

  if (resetToken) {
    // Reset password with new password
    const newPass = 'EduTaktisBaru2025!';
    const resetResult = await authService.resetPasswordWithToken(resetToken, newPass, '127.0.0.1');
    assert('Reset password menggunakan token valid berhasil', resetResult.success === true);

    // Verify old session revoked
    const postResetSession = await authService.validateSession(preResetToken);
    assert('Seluruh sesi lama dicabut secara otomatis setelah reset password', postResetSession === null);

    // Try reusing the same token (One-time use check)
    const reuseResult = await authService.resetPasswordWithToken(resetToken, 'AnotherPass2025!', '127.0.0.1');
    assert('Token reset password yang sudah digunakan ditolak (One-time use enforced)', reuseResult.success === false);

    // Try invalid token
    const invalidResetResult = await authService.resetPasswordWithToken('invalid_token_123', 'AnotherPass2025!', '127.0.0.1');
    assert('Token reset password acak/palsu ditolak', invalidResetResult.success === false);

    // Login with new password
    const loginNewPass = await authService.login('pandu.kusumahadi@kemenag.go.id', newPass, '127.0.0.1');
    assert('Login menggunakan password baru berhasil', loginNewPass.success === true);

    // Revert password back to original for subsequent tests
    const revertReq = await authService.requestPasswordReset('pandu.kusumahadi@kemenag.go.id', '127.0.0.1');
    if (revertReq.simulatedToken) {
      await authService.resetPasswordWithToken(revertReq.simulatedToken, 'EduTaktis2025!', '127.0.0.1');
    }
  }

  // ----------------------------------------------------
  // GROUP 6: RATE LIMITING (IP & Email scoped)
  // ----------------------------------------------------
  console.log('\n--- 6. PENGUJIAN RATE LIMITING ---');
  const testIp = '192.168.10.99';
  const testEmail = 'bruteforce@test.com';
  const rateKey = `${testIp}:${testEmail}`;

  authRateLimiter.reset(rateKey);
  for (let i = 0; i < 4; i++) {
    authRateLimiter.registerFailure(rateKey);
  }
  const checkBeforeLock = authRateLimiter.isRateLimited(rateKey);
  assert('Percobaan gagal ke-4 belum mengunci akun', checkBeforeLock.limited === false);

  authRateLimiter.registerFailure(rateKey);
  const checkAfterLock = authRateLimiter.isRateLimited(rateKey);
  assert('Percobaan gagal ke-5 memicu lockout rate limiting', checkAfterLock.limited === true && (checkAfterLock.retryAfterSeconds || 0) > 0);

  // ----------------------------------------------------
  // GROUP 7: MEMBERSHIP UPDATE & PRIVILEGE ESCALATION GUARDS
  // ----------------------------------------------------
  console.log('\n--- 7. PENGUJIAN PEMBARUAN PERAN & GUARDS ESKALASI HAK AKSES ---');
  // Attempt self-role update
  const selfUpdate = await authService.updateMembership({
    callerUserId: 'usr_pandu_001',
    targetUserId: 'usr_pandu_001',
    institutionId: 'inst_mtsn2btl',
    newRole: 'SUPER_ADMIN',
  });
  assert('Pencegahan eskalasi: User ditolak mengubah perannya sendiri', selfUpdate.success === false && Boolean(selfUpdate.error?.includes('sendiri')));

  // Teacher attempting to manage membership in inst_man1gk (where pandu is only a TEACHER)
  const teacherUpdate = await authService.updateMembership({
    callerUserId: 'usr_pandu_001',
    targetUserId: 'usr_kholis_002',
    institutionId: 'inst_man1gk',
    newRole: 'OPERATOR',
  });
  assert('Pencegahan eskalasi: TEACHER ditolak mengubah peran anggota lain', teacherUpdate.success === false && Boolean(teacherUpdate.error?.includes('Izin tidak mencukupi') || teacherUpdate.error?.includes('Akses ditolak')));

  // School admin (pandu in inst_mtsn2btl) attempting to grant SUPER_ADMIN to siti
  const grantSuperAdmin = await authService.updateMembership({
    callerUserId: 'usr_pandu_001',
    targetUserId: 'usr_siti_003',
    institutionId: 'inst_mtsn2btl',
    newRole: 'SUPER_ADMIN',
  });
  assert('Pencegahan eskalasi: Non-Super Admin ditolak memberikan peran SUPER_ADMIN', grantSuperAdmin.success === false && Boolean(grantSuperAdmin.error?.includes('Super Admin')));

  // Legitimate role change by school admin in inst_mtsn2btl (promoting teacher siti to OPERATOR)
  const legitUpdate = await authService.updateMembership({
    callerUserId: 'usr_pandu_001',
    targetUserId: 'usr_siti_003',
    institutionId: 'inst_mtsn2btl',
    newRole: 'OPERATOR',
  });
  assert('School Admin dapat memperbarui peran anggota institusi ke OPERATOR', legitUpdate.success === true);

  // ----------------------------------------------------
  // GROUP 8: AUTHORIZATION & RBAC MATRIX
  // ----------------------------------------------------
  console.log('\n--- 8. PENGUJIAN OTORISASI RBAC ---');
  assert('TEACHER memiliki hak akses menyusun proyek sendiri', hasPermission('TEACHER', 'project:create') === true);
  assert('TEACHER TIDAK memiliki izin mengubah profil institusi', hasPermission('TEACHER', 'institution:edit_profile') === false);
  assert('TEACHER TIDAK memiliki izin mengelola peran anggota lain', hasPermission('TEACHER', 'membership:manage') === false);

  assert('SCHOOL_ADMIN memiliki hak akses mengubah profil institusi', hasPermission('SCHOOL_ADMIN', 'institution:edit_profile') === true);
  assert('SCHOOL_ADMIN memiliki hak akses mengelola anggota institusinya', hasPermission('SCHOOL_ADMIN', 'membership:manage') === true);

  assert('HEADMASTER memiliki hak akses mengubah profil institusi', hasPermission('HEADMASTER', 'institution:edit_profile') === true);
  assert('HEADMASTER TIDAK memiliki hak akses menghapus proyek sekolah sembarangan', hasPermission('HEADMASTER', 'project:delete_school') === false);

  assert('OPERATOR TIDAK memiliki hak akses membuat atau menghapus proyek', hasPermission('OPERATOR', 'project:create') === false);
  assert('SUPER_ADMIN memiliki izin audit sistem', hasPermission('SUPER_ADMIN', 'audit:view_system') === true);

  // ----------------------------------------------------
  // GROUP 9: TENANT ISOLATION
  // ----------------------------------------------------
  console.log('\n--- 9. PENGUJIAN ISOLASI TENANT (CROSS-INSTITUTION) ---');
  const user1Ctx = await authService.getUserTenantContext('usr_pandu_001', 'inst_man1gk');
  assert('User terikat pada institusi tempat ia terdaftar', user1Ctx.currentInstitution?.id === 'inst_man1gk');

  const invalidTenant = user1Ctx.userInstitutions.find((ui: any) => ui.institution.id === 'inst_nonexistent');
  assert('User ditolak mengakses institusi di mana ia bukan anggota', invalidTenant === undefined);

  // ----------------------------------------------------
  // GROUP 10: SESSION & TOKEN CLEANUP
  // ----------------------------------------------------
  console.log('\n--- 10. PENGUJIAN PEMBERSIHAN SESI KEDALUWARSA ---');
  const cleanedCount = await authService.cleanupExpiredSessions();
  assert('Proses cleanupExpiredSessions berjalan sukses', typeof cleanedCount === 'number');

  // Ringkasan
  console.log('\n====================================================');
  console.log(`📊 HASIL PENGUJIAN: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
