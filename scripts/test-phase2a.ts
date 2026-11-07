/**
 * PHASE 2A — AI GENERATION ENGINE & OCC TEST SUITE
 * EduTaktis SaaS — Modul Ajar KBC & LKPD Generation, Academic Mapping, Schema Validation, OCC
 */

import { projectRepository } from '../src/repositories/projectRepository';
import { modulAjarRepository } from '../src/repositories/modulAjarRepository';
import { academicMappingService } from '../src/services/academicMappingService';
import { schemaValidator } from '../src/services/schemaValidator';
import { modulAjarAiService } from '../src/services/modulAjarAiService';
import { canEditProject, canViewProject } from '../src/security/permissions';

async function runPhase2aTests() {
  console.log('====================================================');
  console.log('🚀 MENJALANKAN TEST SUITE OTOMATIS: PHASE 2A AI ENGINE & OCC');
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
    // TEST SET 1: PREREQUISITE & ACADEMIC MAPPING VALIDATION
    // ----------------------------------------------------
    console.log('\n--- 1. AUDIT & TEST PREREQUISITE DATA ACP, TP, ATP & FAKE TP CODES ---');

    // Project 1: No documents at all
    const emptyProj = await projectRepository.createProject({
      name: 'Proyek Tanpa Dokumen',
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
      documents: {} as any,
    });

    // Test missing ACP
    let acpError: any = null;
    try {
      await academicMappingService.mapAcademicSources(emptyProj.id, instA, userA1, {
        materiPokok: 'Algoritma',
        gayaMengajar: 'Interaktif',
        alokasiWaktu: 4,
        jumlahPertemuan: 2,
        selectedTpCodes: ['TP.7.1'],
      });
    } catch (err: any) {
      acpError = err;
    }
    assert('Tolak generasi jika ACP belum dibuat (PREREQUISITE_ERROR ACP)', acpError && acpError.message && acpError.message.includes('ACP'));

    // Add ACP to project
    const projWithAcp = await projectRepository.updateProject(emptyProj.id, instA, {
      documents: {
        ACP: {
          id: 'doc_acp_test',
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
                kalimatCP: 'Siswa mampu merumuskan algoritma',
                kompetensi: ['Menganalisis', 'Merumuskan'],
                materiEsensial: ['Algoritma Pemrograman'],
                kedalamanKeluasan: 'Menengah',
              },
            ],
          },
        },
      } as any,
    }, userA1);

    // Test missing TP
    let tpError: any = null;
    try {
      await academicMappingService.mapAcademicSources(projWithAcp.id, instA, userA1, {
        materiPokok: 'Algoritma',
        gayaMengajar: 'Interaktif',
        alokasiWaktu: 4,
        jumlahPertemuan: 2,
        selectedTpCodes: ['TP.7.1'],
      });
    } catch (err: any) {
      tpError = err;
    }
    assert('Tolak generasi jika TP belum dibuat (PREREQUISITE_ERROR TP)', tpError && tpError.message && tpError.message.includes('TP'));

    // Add TP to project
    const projWithAcpTp = await projectRepository.updateProject(projWithAcp.id, instA, {
      documents: {
        ...(projWithAcp.documents as any),
        TP: {
          id: 'doc_tp_test',
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
                rumusanTP: 'Menganalisis algoritma pencarian sederhana',
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
                rumusanTP: 'Menerapkan algoritma pengurutan data',
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
    }, userA1);

    // Test missing ATP warning (ATP missing should NOT throw fatal error, but mapping.atpData is null)
    const mappingNoAtp = await academicMappingService.mapAcademicSources(projWithAcpTp.id, instA, userA1, {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Interaktif',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1'],
    });
    assert('ATP opsional: Peringatan/null dicatat tanpa menghentikan proses generasi', mappingNoAtp.atpData === null);
    assert('Mapping ACP berhasil diekstrak dari DB', mappingNoAtp.acpData.analisisElemen.length === 1);
    assert('Mapping TP yang valid berhasil dicocokkan dari DB', mappingNoAtp.matchedTpItems.length === 1 && mappingNoAtp.matchedTpItems[0].kodeTP === 'TP.10.1');

    // Test fake / invalid TP code
    let fakeTpError: any = null;
    try {
      await academicMappingService.mapAcademicSources(projWithAcpTp.id, instA, userA1, {
        materiPokok: 'Algoritma Pencarian',
        gayaMengajar: 'Interaktif',
        alokasiWaktu: 4,
        jumlahPertemuan: 2,
        selectedTpCodes: ['TP.99.999', 'TP.10.1'],
      });
    } catch (err: any) {
      fakeTpError = err;
    }
    assert('Tolak kode TP palsu/direkayasa dari frontend (INVALID_TP_CODE)', fakeTpError && fakeTpError.message && fakeTpError.message.includes('INVALID_TP_CODE'));

    // ----------------------------------------------------
    // TEST SET 2: SCHEMA VALIDATION ENGINE
    // ----------------------------------------------------
    console.log('\n--- 2. AUDIT & TEST SCHEMA VALIDATION ENGINE ---');

    const mappedData = await academicMappingService.mapAcademicSources(projWithAcpTp.id, instA, userA1, {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Interaktif',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1', 'TP.10.2'],
    });

    const modulGen = await modulAjarAiService.generateModulAjarKbc(mappedData, {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Interaktif',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1', 'TP.10.2'],
    });

    const valResult = schemaValidator.validateModulAjarData(modulGen.content);
    assert('Validasi schema Modul Ajar KBC yang valid (valid=true)', valResult.valid === true && valResult.errors.length === 0);

    const invalidModulPayload = { ...modulGen.content, identitas: null };
    const valInvalidResult = schemaValidator.validateModulAjarData(invalidModulPayload);
    assert('Validasi schema Modul Ajar menolak payload cacat (valid=false)', valInvalidResult.valid === false && valInvalidResult.errors.length > 0);

    // ----------------------------------------------------
    // TEST SET 3: AI GENERATION ENGINE & FALLBACK
    // ----------------------------------------------------
    console.log('\n--- 3. AUDIT & TEST AI GENERATION ENGINE & FALLBACK ---');

    assert('Generasi Modul Ajar KBC berhasil menghasilkan konten lengkap', modulGen.content && modulGen.content.identitas !== undefined);
    assert('Jumlah pertemuan Modul Ajar KBC sesuai alokasi (pertemuanList > 0)', modulGen.content.pertemuanList.length > 0);
    assert('Penanaman Panca Cinta & PPRA hadir pada Modul Ajar', 
      modulGen.content.pembuktianKBC.pancaCintaFocus.length > 0 &&
      modulGen.content.pembuktianKBC.ppraValuesFocus.length > 0
    );

    // Test LKPD Generation FROM_MODULE
    const fakeModulRecord: any = {
      id: 'modul_001',
      projectId: projWithAcpTp.id,
      title: 'Modul Ajar Informatika KBC 1',
      version: 1,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTpCodes: ['TP.10.1'],
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Interaktif',
      alokasiWaktuJP: 4,
      jumlahPertemuan: 2,
      content: modulGen.content,
    };

    const lkpdGenModule = await modulAjarAiService.generateLkpd(mappedData, {
      mode: 'FROM_MODULE',
      materiPokok: 'Algoritma Pencarian',
      sourceModule: fakeModulRecord,
    });

    assert('Generasi LKPD dari Modul Ajar berhasil', lkpdGenModule.content && lkpdGenModule.content.materiPokok !== undefined);
    assert('LKPD memuat langkah kerja, pertanyaan/tugas, dan rubrik penilaian',
      lkpdGenModule.content.aktivitasLangkahKerja.length > 0 &&
      lkpdGenModule.content.pertanyaanDanTugas.length > 0 &&
      lkpdGenModule.content.rubrikPenilaian !== undefined
    );

    // Test LKPD Generation FROM_ACADEMIC_DATA
    const lkpdGenAcademic = await modulAjarAiService.generateLkpd(mappedData, {
      mode: 'FROM_ACADEMIC_DATA',
      materiPokok: 'Algoritma Pencarian',
    });
    assert('Generasi LKPD langsung dari data akademis ACP/TP (tanpa Modul Ajar) berhasil', lkpdGenAcademic.content && lkpdGenAcademic.content.materiPokok !== undefined);

    // ----------------------------------------------------
    // TEST SET 4: OPTIMISTIC CONCURRENCY CONTROL (OCC)
    // ----------------------------------------------------
    console.log('\n--- 4. AUDIT & TEST OPTIMISTIC CONCURRENCY CONTROL (OCC) ---');

    // Fetch fresh project timestamp
    const freshProject = await projectRepository.findProjectByIdAndInstitution(projWithAcpTp.id, instA, userA1);
    const validTimestamp = freshProject!.updatedAt;

    const teacherInput = {
      materiPokok: 'Algoritma Pencarian',
      gayaMengajar: 'Diskusi',
      alokasiWaktu: 4,
      jumlahPertemuan: 2,
      selectedTpCodes: ['TP.10.1'],
    };

    // Create Modul Ajar with correct timestamp
    const createdModulRecord = await modulAjarRepository.createModulAjar(
      freshProject!.id,
      instA,
      userA1,
      teacherInput,
      modulGen.content,
      { expectedProjectUpdatedAt: validTimestamp }
    );

    assert('Membuat Modul Ajar dengan timestamp OCC yang valid berhasil', createdModulRecord.id !== undefined);

    // Attempt to update using STALE timestamp
    const staleTimestamp = '2020-01-01T00:00:00.000Z';
    let occError: any = null;
    try {
      await modulAjarRepository.updateModulAjar(
        freshProject!.id,
        createdModulRecord.id,
        instA,
        userA1,
        {
          title: 'Modul Ajar Stale Update',
          content: modulGen.content,
          expectedProjectUpdatedAt: staleTimestamp,
        }
      );
    } catch (err: any) {
      occError = err;
    }
    assert('Pembaruan koleksi dengan timestamp usang ditolak dengan OCC_CONFLICT (409)', occError && (occError.code === 'OCC_CONFLICT' || occError.message?.includes('OCC')));

    // Update with latest timestamp
    const latestProjectState = await projectRepository.findProjectByIdAndInstitution(freshProject!.id, instA, userA1);
    const updatedModulRecord = await modulAjarRepository.updateModulAjar(
      freshProject!.id,
      createdModulRecord.id,
      instA,
      userA1,
      {
        title: 'Modul Ajar KBC Revisi 1',
        content: modulGen.content,
        expectedProjectUpdatedAt: latestProjectState!.updatedAt,
      }
    );
    assert('Pembaruan koleksi dengan timestamp terbaru berhasil', updatedModulRecord.title === 'Modul Ajar KBC Revisi 1');

    // Multi-document collection isolation (Add LKPD without overwriting Modul Ajar)
    const latestStateForLkpd = await projectRepository.findProjectByIdAndInstitution(freshProject!.id, instA, userA1);
    const createdLkpdRecord = await modulAjarRepository.createLkpd(
      freshProject!.id,
      instA,
      userA1,
      {
        mode: 'FROM_MODULE',
        sourceModuleId: createdModulRecord.id,
        materiPokok: 'Algoritma Pencarian',
        teacherInput: { selectedTpCodes: ['TP.10.1'], alokasiWaktu: 4, gayaMengajar: 'Diskusi' },
      },
      lkpdGenModule.content,
      { expectedProjectUpdatedAt: latestStateForLkpd!.updatedAt }
    );

    const finalProjectState = await projectRepository.findProjectByIdAndInstitution(freshProject!.id, instA, userA1);
    const docsAny = (finalProjectState?.documents || {}) as any;
    const modulList = docsAny.collections?.modulAjar || [];
    const lkpdList = docsAny.collections?.lkpd || [];

    assert('Multi-document storage: Koleksi Modul Ajar dan LKPD berdampingan tanpa saling menimpa', modulList.length === 1 && lkpdList.length === 1);
    assert('Setiap dokumen memiliki ID unik', modulList[0].id !== lkpdList[0].id);

    // ----------------------------------------------------
    // TEST SET 5: TENANT ISOLATION & PERMISSION AUDIT
    // ----------------------------------------------------
    console.log('\n--- 5. AUDIT & TEST MULTI-TENANT ISOLATION & SECURITY ---');

    assert('User Guru Pemilik berhak mengedit proyek milik sendiri', canEditProject('TEACHER', true) === true);
    assert('User Guru Non-Pemilik TIDAK berhak mengedit proyek guru lain', canEditProject('TEACHER', false) === false);
    assert('User Guru Non-Pemilik TIDAK berhak melihat proyek guru lain', canViewProject('TEACHER', false) === false);

    // Cleanup test project
    await projectRepository.deleteProject(projWithAcpTp.id, instA, userA1);

    console.log('\n====================================================');
    console.log(`📊 RINGKASAN HASIL TEST PHASE 2A: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FATAL TEST ERROR:', err);
    process.exit(1);
  }
}

runPhase2aTests();
