/**
 * PHASE 2B — UI & WORKFLOW INTEGRATION TEST SUITE
 * EduTaktis SaaS — Generator Modul Ajar KBC, LKPD, Form Validations, OCC, RBAC, Multi-Document Collections
 */

import { projectRepository } from '../src/repositories/projectRepository';
import { modulAjarRepository } from '../src/repositories/modulAjarRepository';
import { academicMappingService } from '../src/services/academicMappingService';
import { modulAjarAiService } from '../src/services/modulAjarAiService';
import { canEditProject, canViewProject } from '../src/security/permissions';

async function runPhase2bTests() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST SUITE OTOMATIS: PHASE 2B UI & WORKFLOW');
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
    const userA1 = 'usr_pandu_001';
    const userB1 = 'usr_siti_003';

    // ----------------------------------------------------
    // TEST SET 1: PROJECT SEEDING & ACADEMIC DATA INTEGRITY
    // ----------------------------------------------------
    console.log('--- 1. PROJECT SEEDING & ACADEMIC DATA INTEGRITY ---');

    const testProj = await projectRepository.createProject({
      name: 'Proyek Pengujian Phase 2B - Informatika KBC',
      institutionId: instA,
      userId: userA1,
      masterInput: {
        namaMadrasah: 'MAN 1 Gunungkidul',
        mataPelajaran: 'Informatika',
        fase: 'Fase E',
        kelas: 'Kelas X',
        tahunPelajaran: '2024/2025',
        alokasiWaktuTotal: 72,
        namaGuru: 'Pandu Guru, S.Kom.',
      },
      documents: {
        ACP: {
          id: 'doc_acp_p2b',
          docType: 'ACP',
          version: 1,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: {
            rasionalMapel: 'Rasional Informatika KBC',
            analisisElemen: [
              {
                kodeElemen: 'BK',
                namaElemen: 'Berpikir Komputasional',
                kalimatCP: 'Peserta didik mampu menerapkan algoritma pencarian dan pengurutan',
                kompetensi: ['Menganalisis', 'Merumuskan'],
                materiEsensial: ['Algoritma Pemrograman'],
                kedalamanKeluasan: 'Menengah',
              },
            ],
          },
        },
        TP: {
          id: 'doc_tp_p2b',
          docType: 'TP',
          version: 1,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          content: {
            listTP: [
              {
                no: 1,
                kodeTP: 'TP.10.1',
                elemen: 'BK',
                rumusanTP: 'Menganalisis algoritma pencarian biner dan linier',
                kompetensi: 'Menganalisis',
                materiPokok: 'Algoritma Pencarian',
                integrasiPancaCinta: 'Cinta Ilmu',
                integrasiPPRA: 'Tawasut',
                alokasiJP: 4,
              },
              {
                no: 2,
                kodeTP: 'TP.10.2',
                elemen: 'BK',
                rumusanTP: 'Menerapkan algoritma pengurutan gelembung (bubble sort)',
                kompetensi: 'Menerapkan',
                materiPokok: 'Algoritma Pengurutan',
                integrasiPancaCinta: 'Cinta Diri',
                integrasiPPRA: 'Tawazun',
                alokasiJP: 4,
              },
            ],
          },
        },
      } as any,
    });

    const testDocs = (testProj.documents || {}) as any;
    assert('Proyek uji Phase 2B berhasil dibuat', testProj.id !== undefined);
    assert('Data ACP dan TP baseline hadir utuh pada proyek', testDocs.ACP?.content !== null && testDocs.TP?.content !== null);

    // ----------------------------------------------------
    // TEST SET 2: GENERATOR MODUL AJAR KBC WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- 2. WORKFLOW GENERATOR MODUL AJAR KBC ---');

    const mappedAcademic = await academicMappingService.mapAcademicSources(testProj.id, instA, userA1, {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Diskusi kelompok, Project Based Learning',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1'],
    });

    assert('Academic Source Mapping berhasil memetakan TP.10.1', mappedAcademic.matchedTpItems.length === 1 && mappedAcademic.matchedTpItems[0].kodeTP === 'TP.10.1');

    const generatedModul = await modulAjarAiService.generateModulAjarKbc(mappedAcademic, {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Diskusi kelompok, Project Based Learning',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1'],
    });

    const modulRecord = await modulAjarRepository.createModulAjar(
      testProj.id,
      instA,
      userA1,
      {
        materiPokok: 'Algoritma Pencarian',
        gayaMengajar: 'Diskusi kelompok, Project Based Learning',
        modelPembelajaran: 'Project-Based Learning (PjBL)',
        alokasiWaktu: 4,
        jumlahPertemuan: 2,
        selectedTpCodes: ['TP.10.1'],
      },
      generatedModul.content,
      { expectedProjectUpdatedAt: testProj.updatedAt }
    );

    assert('Penyimpanan Modul Ajar KBC pertama ke koleksi berhasil', modulRecord.id !== undefined && modulRecord.title.includes('Algoritma'));

    // ----------------------------------------------------
    // TEST SET 3: GENERATOR LKPD (MODE 1 & MODE 2)
    // ----------------------------------------------------
    console.log('\n--- 3. WORKFLOW GENERATOR LKPD (MODE 1 & MODE 2) ---');

    // Mode 1: FROM_MODULE
    const generatedLkpdMode1 = await modulAjarAiService.generateLkpd(mappedAcademic, {
      mode: 'FROM_MODULE',
      materiPokok: 'Algoritma Pencarian',
      sourceModule: modulRecord,
    });

    const currentProjState1 = await projectRepository.findProjectByIdAndInstitution(testProj.id, instA, userA1);
    const lkpdRecordMode1 = await modulAjarRepository.createLkpd(
      testProj.id,
      instA,
      userA1,
      {
        mode: 'FROM_MODULE',
        sourceModuleId: modulRecord.id,
        materiPokok: 'Algoritma Pencarian',
        teacherInput: { selectedTpCodes: ['TP.10.1'], alokasiWaktu: 4, jumlahPertemuan: 2, gayaMengajar: 'Diskusi' },
      },
      generatedLkpdMode1.content,
      { expectedProjectUpdatedAt: currentProjState1!.updatedAt }
    );

    assert('Pembuatan LKPD Mode 1 (FROM_MODULE) berhasil', lkpdRecordMode1.id !== undefined && lkpdRecordMode1.mode === 'FROM_MODULE');
    assert('LKPD Mode 1 terhubung dengan sourceModuleId', lkpdRecordMode1.sourceModuleId === modulRecord.id);

    // Mode 2: FROM_ACADEMIC_DATA
    const currentProjState2 = await projectRepository.findProjectByIdAndInstitution(testProj.id, instA, userA1);
    const generatedLkpdMode2 = await modulAjarAiService.generateLkpd(mappedAcademic, {
      mode: 'FROM_ACADEMIC_DATA',
      materiPokok: 'Algoritma Pengurutan',
    });

    const lkpdRecordMode2 = await modulAjarRepository.createLkpd(
      testProj.id,
      instA,
      userA1,
      {
        mode: 'FROM_ACADEMIC_DATA',
        materiPokok: 'Algoritma Pengurutan',
        teacherInput: { selectedTpCodes: ['TP.10.2'], alokasiWaktu: 4, jumlahPertemuan: 2, gayaMengajar: 'Praktik' },
      },
      generatedLkpdMode2.content,
      { expectedProjectUpdatedAt: currentProjState2!.updatedAt }
    );

    assert('Pembuatan LKPD Mode 2 (FROM_ACADEMIC_DATA) berhasil', lkpdRecordMode2.id !== undefined && lkpdRecordMode2.mode === 'FROM_ACADEMIC_DATA');

    // ----------------------------------------------------
    // TEST SET 4: OCC CONFLICT HANDLING & CONCURRENCY
    // ----------------------------------------------------
    console.log('\n--- 4. OPTIMISTIC CONCURRENCY CONTROL (OCC) ---');

    const staleTimestamp = '2020-01-01T00:00:00.000Z';
    let occError: any = null;
    try {
      await modulAjarRepository.updateModulAjar(
        testProj.id,
        modulRecord.id,
        instA,
        userA1,
        {
          title: 'Modul Ajar Revisi Stale',
          expectedProjectUpdatedAt: staleTimestamp,
        }
      );
    } catch (err: any) {
      occError = err;
    }
    assert('Pembaruan dokumen dengan timestamp usang ditolak dengan OCC_CONFLICT (409)', occError && (occError.code === 'OCC_CONFLICT' || occError.message?.includes('OCC')));

    // ----------------------------------------------------
    // TEST SET 5: MULTI-DOCUMENT COLLECTION INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- 5. INTEGRITAS MULTI-DOCUMENT COLLECTION ---');

    const finalProject = await projectRepository.findProjectByIdAndInstitution(testProj.id, instA, userA1);
    const docsAny = (finalProject?.documents || {}) as any;
    const modulList = docsAny.collections?.modulAjar || [];
    const lkpdList = docsAny.collections?.lkpd || [];

    assert('Koleksi Modul Ajar menyimpan 1 entri', modulList.length === 1);
    assert('Koleksi LKPD menyimpan 2 entri (Mode 1 & Mode 2)', lkpdList.length === 2);
    assert('Enam dokumen baseline lama (ACP & TP) tetap utuh', docsAny.ACP !== undefined && docsAny.TP !== undefined);

    // ----------------------------------------------------
    // TEST SET 6: RBAC PERMISSIONS AUDIT
    // ----------------------------------------------------
    console.log('\n--- 6. AUDIT PERMISI RBAC UNTUK MODUL AJAR & LKPD ---');

    assert('Guru Pemilik (TEACHER, owner) diizinkan mengedit dokumen', canEditProject('TEACHER', true) === true);
    assert('Guru Non-Pemilik (TEACHER, non-owner) DITOLAK mengedit dokumen', canEditProject('TEACHER', false) === false);
    assert('Operator DITOLAK mengedit dokumen proyek', canEditProject('OPERATOR', false) === false);

    // Cleanup test project
    await projectRepository.deleteProject(testProj.id, instA, userA1);

    console.log('\n====================================================');
    console.log(`📊 RINGKASAN HASIL TEST PHASE 2B: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FATAL TEST ERROR PHASE 2B:', err);
    process.exit(1);
  }
}

runPhase2bTests();
