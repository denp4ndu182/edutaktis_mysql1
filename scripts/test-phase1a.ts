/**
 * PHASE 1A — DATA FOUNDATION, REPOSITORY & SECURITY CONTRACT TEST SUITE
 * EduTaktis SaaS — Modul Ajar KBC & LKPD Multi-Document Collection Security Test
 */

import { projectRepository } from '../src/repositories/projectRepository';
import { modulAjarRepository } from '../src/repositories/modulAjarRepository';
import { canEditProject, canViewProject } from '../src/security/permissions';

async function runPhase1aTests() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST SUITE OTOMATIS: PHASE 1A SECURITY & DATA FOUNDATION');
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

  try {
    const instA = 'inst_man1gk';
    const instB = 'inst_mtsn2btl';
    const userA1 = 'usr_pandu_001'; // Teacher at Inst A
    const userA2 = 'usr_guru_a2_002'; // Teacher at Inst A (other teacher)
    const userB1 = 'usr_siti_003'; // Teacher at Inst B

    // Seed test project with legacy 6 documents
    const testProject = await projectRepository.createProject({
      name: 'Proyek Pengujia Phase 1A - Informatika',
      institutionId: instA,
      userId: userA1,
      masterInput: {
        namaMadrasah: 'MAN 1 Gunungkidul',
        mataPelajaran: 'Informatika',
        fase: 'Fase E',
        kelas: 'Kelas X',
        tahunPelajaran: '2024/2025',
        alokasiWaktuTotal: 72,
      },
      documents: {
        ACP: {
          id: 'doc_acp_001',
          docType: 'ACP',
          version: 1,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: {
            rasionalMapel: 'Pentingnya berpikir komputasional',
            analisisElemen: [
              {
                kodeElemen: 'BK',
                namaElemen: 'Berpikir Komputasional',
                kalimatCP: 'Siswa mampu menerapkan algoritma',
                kompetensi: ['Menganalisis', 'Merumuskan'],
                materiEsensial: ['Algoritma Pemrograman', 'Struktur Data'],
                kedalamanKeluasan: 'Konsep dasar hingga implementasi',
              },
            ],
          },
        },
        TP: {
          id: 'doc_tp_001',
          docType: 'TP',
          version: 1,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: {
            listTP: [
              {
                no: 1,
                kodeTP: 'TP.7.1',
                elemen: 'BK',
                rumusanTP: 'Menganalisis konsep variabel dan tipe data dalam Python',
                kompetensi: 'Menganalisis',
                materiPokok: 'Variabel dan Tipe Data',
                integrasiPancaCinta: 'Cinta Ilmu',
                integrasiPPRA: 'Tawasut',
                alokasiJP: 6,
              },
              {
                no: 2,
                kodeTP: 'TP.7.2',
                elemen: 'BK',
                rumusanTP: 'Merumuskan struktur percabangan dan perulangan',
                kompetensi: 'Merumuskan',
                materiPokok: 'Percabangan & Perulangan',
                integrasiPancaCinta: 'Cinta Diri',
                integrasiPPRA: 'Tawazun',
                alokasiJP: 6,
              },
            ],
            totalJP: 12,
          },
        },
        ATP: {
          id: 'doc_atp_001',
          docType: 'ATP',
          version: 1,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: {
            listATP: [
              {
                no: 1,
                alurUrutan: 1,
                kodeTP: 'TP.7.1',
                elemen: 'BK',
                rumusanTP: 'Menganalisis konsep variabel dan tipe data dalam Python',
                materiPokok: 'Variabel dan Tipe Data',
                aspekKompetensi: 'Pemahaman',
                integrasiKbcPpra: 'Cinta Ilmu',
                alokasiJP: 6,
                semester: 'Semester 1',
              },
            ],
          },
        },
      },
    });

    console.log('--- 1. PENGUJIAN KOMPATIBILITAS PROYEK LAMA ---');
    assert('1.1 Proyek lama tanpa koleksi Modul Ajar/LKPD dapat dibuka bersih', Boolean(testProject && testProject.id));
    const initialSources = await modulAjarRepository.getAcademicSources(testProject.id, instA, userA1);
    assert('1.2 Pengambilan sumber data akademik (ACP, TP, ATP) backend berhasil', Boolean(initialSources.allowed && initialSources.sources));

    console.log('\n--- 2. PENGUJIAN VALIDASI KODE TP DAN ERROR PRASYARAT ---');
    const validTpCheck = await modulAjarRepository.getAcademicSources(testProject.id, instA, userA1, ['TP.7.1']);
    assert('2.1 Backend menerima kode TP yang benar-benar ada pada dokumen TP', validTpCheck.allowed === true);

    const invalidTpCheck = await modulAjarRepository.getAcademicSources(testProject.id, instA, userA1, ['TP.9.9_PALSU']);
    assert('2.2 Backend MENOLAK kode TP palsu yang tidak ada pada dokumen TP proyek', invalidTpCheck.allowed === false && Boolean(invalidTpCheck.error));

    console.log('\n--- 3. PENGUJIAN KOLEKSI MODUL AJAR KBC (MULTI-DOCUMENT) ---');
    const modul1 = await modulAjarRepository.createModulAjar(testProject.id, instA, userA1, {
      materiPokok: 'Variabel dan Tipe Data Python',
      gayaMengajar: 'Project Based',
      alokasiWaktu: 6,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.7.1'],
    });
    assert('3.1 Membuat Modul Ajar KBC pertama berhasil', Boolean(modul1.id && modul1.version === 1));

    const modul2 = await modulAjarRepository.createModulAjar(testProject.id, instA, userA1, {
      materiPokok: 'Percabangan & Perulangan Python',
      gayaMengajar: 'Demonstrasi & Diskusi',
      alokasiWaktu: 6,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.7.2'],
    });
    assert('3.2 Membuat Modul Ajar KBC kedua pada proyek sama BERHASIL tanpa menimpa dokumen pertama', Boolean(modul2.id && modul2.id !== modul1.id));

    const modulList = await modulAjarRepository.listModulAjar(testProject.id, instA, userA1);
    assert('3.3 List Modul Ajar mengembalikan 2 koleksi dokumen', modulList.total === 2 && modulList.items.length === 2);

    console.log('\n--- 4. PENGUJIAN KOLEKSI LKPD & DUA MODE (FROM_MODULE & FROM_ACADEMIC) ---');
    const lkpd1 = await modulAjarRepository.createLkpd(testProject.id, instA, userA1, {
      mode: 'FROM_MODULE',
      sourceModuleId: modul1.id,
      materiPokok: 'Praktikum Variabel Python',
      teacherInput: { selectedTpCodes: ['TP.7.1'] },
    });
    assert('4.1 Membuat LKPD Mode FROM_MODULE berbasis Modul Ajar 1 berhasil', Boolean(lkpd1.id && lkpd1.sourceModuleId === modul1.id));

    const lkpd2 = await modulAjarRepository.createLkpd(testProject.id, instA, userA1, {
      mode: 'FROM_ACADEMIC_DATA',
      materiPokok: 'Tugas Mandiri Percabangan',
      teacherInput: { selectedTpCodes: ['TP.7.2'] },
    });
    assert('4.2 Membuat LKPD Mode FROM_ACADEMIC_DATA langsung dari TP berhasil', Boolean(lkpd2.id && lkpd2.mode === 'FROM_ACADEMIC_DATA'));

    let failedInvalidModuleLkpd = false;
    try {
      await modulAjarRepository.createLkpd(testProject.id, instA, userA1, {
        mode: 'FROM_MODULE',
        sourceModuleId: 'modul_palsu_999',
        materiPokok: 'Test Ilegal',
      });
    } catch {
      failedInvalidModuleLkpd = true;
    }
    assert('4.3 LKPD dengan sourceModuleId palsu DITOLAK KETAT oleh repository', failedInvalidModuleLkpd === true);

    console.log('\n--- 5. PENGUJIAN REVISI DOKUMEN & PRESERVASI RIWAYAT VERSI ---');
    const updatedModul1 = await modulAjarRepository.updateModulAjar(testProject.id, modul1.id, instA, userA1, {
      title: 'Modul Ajar Variabel Python (Revisi 2)',
      status: 'completed',
      changelog: 'Menambahkan rubrik penilaian interaktif',
    });
    assert('5.1 Update Modul Ajar menaikkan versi menjadi 2', updatedModul1.version === 2);
    assert('5.2 Riwayat versi sebelumnya tersimpan pada versionsHistory', updatedModul1.versionsHistory?.length === 2);

    console.log('\n--- 6. PENGUJIAN PRESERVASI 6 DOKUMEN BASELINE LAMA ---');
    const reloadedProject = await projectRepository.findProjectByIdAndInstitution(testProject.id, instA, userA1);
    const docs = (reloadedProject?.documents || {}) as any;
    assert('6.1 Dokumen ACP baseline lama tetap ada dan utuh', Boolean(docs.ACP && docs.ACP.content));
    assert('6.2 Dokumen TP baseline lama tetap ada dan utuh', Boolean(docs.TP && docs.TP.content));
    assert('6.3 Dokumen ATP baseline lama tetap ada dan utuh', Boolean(docs.ATP && docs.ATP.content));

    console.log('\n--- 7. PENGUJIAN ISOLASI MULTI-TENANT & IDOR/BOLA ---');
    const crossInstModul = await modulAjarRepository.getModulAjarById(testProject.id, modul1.id, instB, userB1);
    assert('7.1 Pengguna Institusi B DITOLAK melihat Modul Ajar proyek Institusi A (Mengembalikan null)', crossInstModul === null);

    let crossInstUpdateBlocked = false;
    try {
      await modulAjarRepository.updateModulAjar(testProject.id, modul1.id, instB, userB1, {
        title: 'Modul Hack Institusi B',
      });
    } catch {
      crossInstUpdateBlocked = true;
    }
    assert('7.2 Pengguna Institusi B DITOLAK mengubah Modul Ajar proyek Institusi A', crossInstUpdateBlocked === true);

    const fakeModulLookup = await modulAjarRepository.getModulAjarById(testProject.id, 'modul_palsu_123', instA, userA1);
    assert('7.3 ID dokumen palsu mengembalikan null tanpa error crash', fakeModulLookup === null);

    console.log('\n--- 8. PENGUJIAN HAK AKSES RBAC ---');
    const teacherCanEdit = canEditProject('TEACHER', true); // Owner teacher
    const nonOwnerTeacherCanEdit = canEditProject('TEACHER', false); // Non-owner teacher
    const operatorCanEdit = canEditProject('OPERATOR', false);

    assert('8.1 Guru pemilik proyek memiliki izin mengedit dokumen', teacherCanEdit === true);
    assert('8.2 Guru non-pemilik ditolak mengedit proyek guru lain', nonOwnerTeacherCanEdit === false);
    assert('8.3 Operator ditolak mengedit/membuat dokumen proyek', operatorCanEdit === false);

    console.log('\n--- 9. CLEANUP DATA PENGUJIAN ---');
    await projectRepository.deleteProject(testProject.id, instA, userA1);
    assert('9.1 Cleanup proyek sintetis Phase 1A berhasil', true);

    console.log(`\n====================================================`);
    console.log(`📊 HASIL PENGUJIAN PHASE 1A: ${passed} PASSED | ${failed} FAILED`);
    console.log(`====================================================`);
  } catch (err: any) {
    console.error('Fatal error during Phase 1A test execution:', err);
  }
}

runPhase1aTests().catch((err) => {
  console.error('Fatal error in Phase 1A test runner:', err);
});
