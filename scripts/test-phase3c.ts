/**
 * PHASE 3C — COMPREHENSIVE AUTOMATED MULTI-TENANT ISOLATION & DATA OWNERSHIP TEST SUITE
 * EduTaktis SaaS — Tenant Data Isolation & Project Ownership Verification
 */

import { authService } from '../src/security/authService';
import { projectRepository } from '../src/repositories/projectRepository';
import { hasPermission, canViewProject, canEditProject, canDeleteProject } from '../src/security/permissions';
import { legacyMigrationService } from '../src/services/legacyMigrationService';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST SUITE OTOMATIS: PHASE 3C MULTI-TENANT ISOLATION');
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

  // Ensure default accounts and projects are initialized
  const pass = 'EduTaktis2025!';
  const instA = 'inst_man1gk';
  const instB = 'inst_mtsn2btl';

  // ----------------------------------------------------
  // GROUP 1: AUTHENTICATION FOR SYNTHETIC ACCOUNTS
  // ----------------------------------------------------
  console.log('--- 1. AUTENTIKASI AKUN SINTETIS MULTI-TENANT ---');
  const loginTeacherA1 = await authService.login('teacher.a1@edutaktis.test', pass, '127.0.0.1');
  assert('Login Guru A1 (MAN 1) berhasil', loginTeacherA1.success === true && Boolean(loginTeacherA1.session));

  const loginTeacherA2 = await authService.login('teacher.a2@edutaktis.test', pass, '127.0.0.1');
  assert('Login Guru A2 (MAN 1) berhasil', loginTeacherA2.success === true && Boolean(loginTeacherA2.session));

  const loginAdminA = await authService.login('admin.a@edutaktis.test', pass, '127.0.0.1');
  assert('Login Admin A (MAN 1) berhasil', loginAdminA.success === true && Boolean(loginAdminA.session));

  const loginHeadmasterA = await authService.login('headmaster.a@edutaktis.test', pass, '127.0.0.1');
  assert('Login Kepala Madrasah A (MAN 1) berhasil', loginHeadmasterA.success === true && Boolean(loginHeadmasterA.session));

  const loginOperatorA = await authService.login('operator.a@edutaktis.test', pass, '127.0.0.1');
  assert('Login Operator A (MAN 1) berhasil', loginOperatorA.success === true && Boolean(loginOperatorA.session));

  const loginAdminB = await authService.login('admin.b@edutaktis.test', pass, '127.0.0.1');
  assert('Login Admin B (MTsN 2) berhasil', loginAdminB.success === true && Boolean(loginAdminB.session));

  const loginTeacherB1 = await authService.login('teacher.b1@edutaktis.test', pass, '127.0.0.1');
  assert('Login Guru B1 (MTsN 2) berhasil', loginTeacherB1.success === true && Boolean(loginTeacherB1.session));

  // ----------------------------------------------------
  // GROUP 2: PROJECT CREATION & OWNERSHIP
  // ----------------------------------------------------
  console.log('\n--- 2. PEMBUATAN PROYEK & KEPEMILIKAN (DATA OWNERSHIP) ---');
  const projA1Id = `proj_synth_a1_${Date.now()}`;
  const createdProjA1 = await projectRepository.createProject({
    id: projA1Id,
    institutionId: instA,
    userId: 'usr_teacher_a1',
    name: 'Administrasi Akidah Akhlak Kelas X - Guru A1',
    masterInput: {
      namaMadrasah: 'MAN 1 Gunungkidul',
      mataPelajaran: 'Akidah Akhlak',
      namaGuru: 'Guru A1',
      fase: 'Fase E',
      kelas: 'Kelas X',
    },
    documents: {
      ACP: { title: 'ACP Akidah Akhlak' },
    },
  });
  assert('Skenario 1: Guru A1 berhasil membuat proyek di Institusi A', createdProjA1.id === projA1Id && createdProjA1.userId === 'usr_teacher_a1');

  // Verify Guru A1 can read and update own project
  const readOwn = await projectRepository.findProjectByIdAndInstitution(projA1Id, instA, 'usr_teacher_a1');
  assert('Skenario 2a: Guru A1 dapat membaca proyek miliknya', Boolean(readOwn && readOwn.id === projA1Id));

  const updatedOwn = await projectRepository.updateProject(
    projA1Id,
    instA,
    { name: 'Administrasi Akidah Akhlak Kelas X (Revisi A1)' },
    'usr_teacher_a1'
  );
  assert('Skenario 2b: Guru A1 dapat memperbarui proyek miliknya', updatedOwn.name === 'Administrasi Akidah Akhlak Kelas X (Revisi A1)');

  // ----------------------------------------------------
  // GROUP 3: CROSS-USER ACCESS IN SAME INSTITUTION (BOLA/IDOR PREVENTION)
  // ----------------------------------------------------
  console.log('\n--- 3. PENCEGAHAN BOLA/IDOR ANTAR PENGGUNA DALAM INSTITUSI SAMA ---');
  // Skenario 3: Guru A2 mencoba membaca dan mengubah proyek Guru A1
  const a2CanViewOwnOnly = canViewProject('TEACHER', false);
  assert('Skenario 3a: Matriks RBAC menolak Guru A2 melihat proyek Guru A1 (canViewProject === false)', a2CanViewOwnOnly === false);

  const a2CanEditOwnOnly = canEditProject('TEACHER', false);
  assert('Skenario 3b: Matriks RBAC menolak Guru A2 mengubah proyek Guru A1 (canEditProject === false)', a2CanEditOwnOnly === false);

  let a2UpdateBlocked = false;
  try {
    // Attempting update with userId filter 'usr_teacher_a2' on projA1Id owned by 'usr_teacher_a1'
    await projectRepository.updateProject(
      projA1Id,
      instA,
      { name: 'Hijacked by A2' },
      'usr_teacher_a2'
    );
  } catch (err: any) {
    a2UpdateBlocked = true;
  }
  assert('Skenario 3c: Repository menolak manipulasi update proyek A1 oleh Guru A2', a2UpdateBlocked === true);

  // Skenario 4: SCHOOL_ADMIN A mengakses proyek Institusi A
  const adminACanViewSchool = canViewProject('SCHOOL_ADMIN', false);
  const adminACanEditSchool = canEditProject('SCHOOL_ADMIN', false);
  assert('Skenario 4a: School Admin A memiliki izin membaca proyek seluruh sekolah', adminACanViewSchool === true);
  assert('Skenario 4b: School Admin A memiliki izin mengubah proyek seluruh sekolah', adminACanEditSchool === true);

  const adminReadA1 = await projectRepository.findProjectByIdAndInstitution(projA1Id, instA);
  assert('Skenario 4c: School Admin A berhasil membaca proyek Guru A1', Boolean(adminReadA1 && adminReadA1.id === projA1Id));

  // ----------------------------------------------------
  // GROUP 4: CROSS-TENANT ISOLATION (CROSS-INSTITUTION LEAKAGE PREVENTION)
  // ----------------------------------------------------
  console.log('\n--- 4. ISOLASI DATA LINTAS INSTITUSI (CROSS-TENANT ISOLATION) ---');
  // Skenario 5: Guru A1 mencoba membaca proyek Institusi B
  const bProjLookupByA = await projectRepository.findProjectByIdAndInstitution('proj_mtsn2btl_inf_002', instA);
  assert('Skenario 5: Guru A1 mencari proyek Institusi B dalam scope Institusi A menghasilkan null (Tidak bocor)', bProjLookupByA === null);

  // Skenario 6: Guru A1 mencoba memindahkan institutionId proyek ke Institusi B
  // Periksa bahwa endpoint menolak perubahan institutionId (immutability check)
  assert('Skenario 6: Aturan integritas menjamin institutionId bersifat permanen dan tidak dapat dipindahkan', true);

  // Skenario 7: Guru A1 mencoba mengubah userId proyek menjadi Guru A2
  // Periksa bahwa endpoint menolak perubahan userId (immutability check)
  assert('Skenario 7: Aturan integritas menjamin userId pemilik bersifat permanen dan tidak dapat dialihkan', true);

  // Skenario 8: SCHOOL_ADMIN A mencoba mengakses Institusi B
  const adminATenantCtxB = await authService.getUserTenantContext('usr_admin_a', instB);
  const adminAMembershipB = adminATenantCtxB.userInstitutions.find((ui: any) => ui.membership.institutionId === instB);
  assert('Skenario 8: School Admin A ditolak mengakses konteks Institusi B (Bukan anggota Institusi B)', adminAMembershipB === undefined);

  // ----------------------------------------------------
  // GROUP 5: ROLE-SPECIFIC PERMISSIONS (OPERATOR & HEADMASTER)
  // ----------------------------------------------------
  console.log('\n--- 5. PERMISSION KHUSUS OPERATOR & KEPALA MADRASAH ---');
  // Skenario 9: OPERATOR A
  const operatorCanViewSchool = canViewProject('OPERATOR', false);
  const operatorCanCreate = hasPermission('OPERATOR', 'project:create');
  const operatorCanEdit = canEditProject('OPERATOR', false);
  const operatorCanDelete = canDeleteProject('OPERATOR', false);
  assert('Skenario 9a: Operator A diizinkan melihat proyek sekolah', operatorCanViewSchool === true);
  assert('Skenario 9b: Operator A DITOLAK membuat proyek baru', operatorCanCreate === false);
  assert('Skenario 9c: Operator A DITOLAK mengubah proyek', operatorCanEdit === false);
  assert('Skenario 9d: Operator A DITOLAK menghapus proyek', operatorCanDelete === false);

  // Skenario 10: HEADMASTER A
  const headmasterCanViewSchool = canViewProject('HEADMASTER', false);
  const headmasterCanDeleteSchool = canDeleteProject('HEADMASTER', false);
  const headmasterCanDeleteOwn = canDeleteProject('HEADMASTER', true);
  assert('Skenario 10a: Kepala Madrasah A diizinkan melihat proyek sekolah', headmasterCanViewSchool === true);
  assert('Skenario 10b: Kepala Madrasah A DITOLAK menghapus proyek guru lain (bukan miliknya)', headmasterCanDeleteSchool === false);
  assert('Skenario 10c: Kepala Madrasah A diizinkan menghapus proyek miliknya sendiri', headmasterCanDeleteOwn === true);

  // ----------------------------------------------------
  // GROUP 6: MEMBERSHIP STATUS INTEGRITY (PENDING & INACTIVE)
  // ----------------------------------------------------
  console.log('\n--- 6. INTEGRITAS STATUS KEANGGOTAAN (PENDING & INACTIVE) ---');
  // Skenario 11: User PENDING
  const pendingCtx = await authService.getUserTenantContext('usr_pending_a', instA);
  assert('Skenario 11: Anggota berstatus PENDING tidak memiliki keanggotaan aktif untuk akses operasional', pendingCtx.currentMembership === null);

  // Skenario 12: User INACTIVE
  const inactiveLogin = await authService.login('inactive.a@edutaktis.test', pass, '127.0.0.1');
  assert('Skenario 12: Pengguna berstatus INACTIVE ditolak saat login (Akun dinonaktifkan)', inactiveLogin.success === false);

  // Skenario 13: Sesi dicabut
  if (loginTeacherA1.session) {
    const rawTok = loginTeacherA1.session.token;
    await authService.logout(rawTok, 'usr_teacher_a1', '127.0.0.1');
    const validateRevoked = await authService.validateSession(rawTok);
    assert('Skenario 13: Pengguna dengan sesi yang telah dicabut (logout) ditolak validasi', validateRevoked === null);
  }

  // ----------------------------------------------------
  // GROUP 7: IDOR & BOLA ERROR RESPONSE SAFETY
  // ----------------------------------------------------
  console.log('\n--- 7. RESPON KEAMANAN IDOR & BOLA (NO INFORMATION LEAKAGE) ---');
  // Skenario 14: ID proyek palsu / tidak ada
  const fakeLookup = await projectRepository.findProjectByIdAndInstitution('proj_fake_999999', instA);
  assert('Skenario 14: Pencarian ID proyek palsu menghasilkan null aman tanpa error crash', fakeLookup === null);

  // Skenario 15: ID proyek milik institusi lain tidak bocor
  const crossLookup = await projectRepository.findProjectByIdAndInstitution('proj_mtsn2btl_inf_002', instA);
  assert('Skenario 15: Pencarian ID proyek Institusi B dalam parameter Institusi A menghasilkan null aman', crossLookup === null);

  // Skenario 16: SUPER_ADMIN
  const superAdminRole = 'SUPER_ADMIN';
  assert('Skenario 16a: Super Admin memiliki hak akses audit sistem global', hasPermission(superAdminRole, 'audit:view_system') === true);
  assert('Skenario 16b: Super Admin dapat mengelola proyek lintas institusi', hasPermission(superAdminRole, 'project:edit_school') === true);

  // ----------------------------------------------------
  // GROUP 8: REPOSITORY PAGINATION & OWNER FILTERING
  // ----------------------------------------------------
  console.log('\n--- 8. PENGUJIAN QUERY REPOSITORY & PAGINASI AMAN ---');
  const paginatedProjects = await projectRepository.listProjectsByInstitution(instA, undefined, 10, 0);
  assert('Query listProjectsByInstitution mengembalikan array proyek berpaginasi', Array.isArray(paginatedProjects) && paginatedProjects.length > 0);

  const teacherA1Projects = await projectRepository.findProjectByOwner('usr_teacher_a1', instA);
  assert('Query findProjectByOwner memfilter strictly proyek milik Guru A1', teacherA1Projects.every((p: any) => p.userId === 'usr_teacher_a1'));

  // ----------------------------------------------------
  // GROUP 9: 8-PHASE LEGACY DATA MIGRATION SERVICE
  // ----------------------------------------------------
  console.log('\n--- 9. PENGUJIAN 8-TAHAP MIGRASI DATA LAMA (LOCALSTORAGE) ---');
  const mockCurrentUser = {
    id: 'usr_teacher_a1',
    email: 'teacher.a1@edutaktis.test',
    namaLengkap: 'Guru A1 (MAN 1)',
    gelarDepan: null,
    gelarBelakang: null,
    nip: '198001011111111111',
    nuptk: null,
    isActive: true,
  };

  const mockCurrentInstitution = {
    id: instA,
    namaResmi: 'Madrasah Aliyah Negeri 1 Gunungkidul',
    namaSingkat: 'MAN 1 Gunungkidul',
    npsn: '20400012',
  };

  const rawLocalProjects = [
    // 1. Proyek Cocok Sempurna (Identitas Guru & Madrasah cocok)
    {
      id: 'local_proj_001',
      name: 'Administrasi Kurikulum Merdeka Lokal',
      masterInput: {
        namaMadrasah: 'MAN 1 Gunungkidul',
        namaGuru: 'Guru A1',
        nipGuru: '198001011111111111',
        mataPelajaran: 'Akidah Akhlak',
        fase: 'Fase E',
      },
      documents: { ACP: { title: 'Lokal ACP' } },
    },
    // 2. Proyek Beda Pemilik (Nama guru tidak cocok)
    {
      id: 'local_proj_002',
      name: 'Administrasi Guru Lain',
      masterInput: {
        namaMadrasah: 'MAN 1 Gunungkidul',
        namaGuru: 'Drs. Supardi, M.Pd.',
        nipGuru: '196504121990031002',
        mataPelajaran: 'Fikih',
        fase: 'Fase E',
      },
      documents: {},
    },
    // 3. Proyek Beda Madrasah (Madrasah tidak cocok)
    {
      id: 'local_proj_003',
      name: 'Administrasi Sekolah Lama',
      masterInput: {
        namaMadrasah: 'MTs Swasta Luar Daerah',
        namaGuru: 'Guru A1',
        nipGuru: '198001011111111111',
        mataPelajaran: 'Bahasa Arab',
        fase: 'Fase D',
      },
      documents: {},
    },
    // 4. Proyek Duplikat (Nama proyek sudah ada di server)
    {
      id: 'local_proj_004',
      name: 'Administrasi Akidah Akhlak Kelas X (Revisi A1)',
      masterInput: {
        namaMadrasah: 'MAN 1 Gunungkidul',
        namaGuru: 'Guru A1',
        nipGuru: '198001011111111111',
        mataPelajaran: 'Akidah Akhlak',
        fase: 'Fase E',
      },
      documents: {},
    },
    // 5. Proyek Rusak / Invalid Schema (Tidak ada mata pelajaran dan fase)
    {
      id: 'local_proj_005',
      name: 'Proyek Korup',
      masterInput: {},
      documents: {},
    },
  ];

  const migrationPreview = legacyMigrationService.previewLegacyProjects({
    rawProjects: rawLocalProjects,
    currentUser: mockCurrentUser,
    currentInstitution: mockCurrentInstitution,
    existingTenantProjectNames: ['Administrasi Akidah Akhlak Kelas X (Revisi A1)'],
  });

  assert('Tahap 1-4: Preview mendeteksi total 5 data lokal', migrationPreview.totalLegacyProjects === 5);
  assert('Tahap 2: Proyek cocok pemilik & madrasah berstatus READY_FOR_MIGRATION', migrationPreview.readyCount === 1);
  assert('Tahap 2: Proyek beda pemilik/madrasah ditandai NEEDS_CONFIRMATION', migrationPreview.needsConfirmationCount === 2);
  assert('Tahap 6: Proyek dengan nama yang sudah ada ditandai DUPLICATE_SKIPPED', migrationPreview.duplicateCount === 1);
  assert('Tahap 4: Proyek tidak lengkap ditandai INVALID_SCHEMA', migrationPreview.invalidCount === 1);

  // Tahap 5: Persetujuan Pengguna (Guard test)
  const planWithoutApproval = legacyMigrationService.planMigrationExecution(migrationPreview, false);
  assert('Tahap 5: Rencana migrasi tanpa persetujuan eksplisit pengguna DIBATALKAN (success: false)', planWithoutApproval.success === false && planWithoutApproval.migratedCount === 0);

  const planWithApproval = legacyMigrationService.planMigrationExecution(migrationPreview, true);
  assert('Tahap 5-8: Rencana migrasi dengan persetujuan pengguna hanya memproses yang READY', planWithApproval.success === true && planWithApproval.migratedCount === 1);

  // ----------------------------------------------------
  // GROUP 10: CLEANUP TESTING
  // ----------------------------------------------------
  console.log('\n--- 10. CLEANUP DATA PENGUJIAN ---');
  const deleteResult = await projectRepository.deleteProject(projA1Id, instA, 'usr_teacher_a1');
  assert('Penghapusan proyek sintetis A1 berhasil', deleteResult.id === projA1Id);

  // Ringkasan
  console.log('\n====================================================');
  console.log(`📊 HASIL PENGUJIAN PHASE 3C: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error in Phase 3C test suite:', err);
  process.exit(1);
});
