import { ModulAjarKbcData, LkpdData } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class SchemaValidator {
  /**
   * Validates Modul Ajar KBC output JSON structure
   */
  validateModulAjarData(
    data: any,
    expectedMeetingsCount?: number
  ): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Output Modul Ajar bukan objek JSON valid.'] };
    }

    // 1. Identitas & Informasi Umum check
    if (!data.identitas || typeof data.identitas !== 'object') {
      errors.push('Identitas dokumen tidak ditemukan.');
    }
    if (!data.informasiUmum || typeof data.informasiUmum !== 'object') {
      errors.push('Informasi Umum tidak ditemukan.');
    } else {
      if (!data.informasiUmum.materiPokok) errors.push('Informasi Umum: materiPokok wajib diisi.');
      if (!data.informasiUmum.gayaMengajar) errors.push('Informasi Umum: gayaMengajar wajib diisi.');
    }

    // 2. KBC Integration check
    if (!data.pembuktianKBC || typeof data.pembuktianKBC !== 'object') {
      errors.push('Komponen pembuktianKBC tidak ditemukan.');
    } else if (!Array.isArray(data.pembuktianKBC.pancaCintaFocus)) {
      errors.push('pembuktianKBC.pancaCintaFocus wajib berupa array.');
    }

    // 3. Capaian & Tujuan check
    if (!data.capaianDanTujuan || typeof data.capaianDanTujuan !== 'object') {
      errors.push('Komponen capaianDanTujuan tidak ditemukan.');
    } else if (!Array.isArray(data.capaianDanTujuan.tujuanPembelajaran)) {
      errors.push('capaianDanTujuan.tujuanPembelajaran wajib berupa array.');
    }

    // 4. Pertemuan List check (Scenario per meeting)
    if (!Array.isArray(data.pertemuanList) || data.pertemuanList.length === 0) {
      errors.push('pertemuanList wajib berupa array non-kosong.');
    } else {
      if (expectedMeetingsCount && data.pertemuanList.length !== expectedMeetingsCount) {
        errors.push(
          `Jumlah pertemuan (${data.pertemuanList.length}) tidak sesuai dengan input guru (${expectedMeetingsCount}).`
        );
      }
      data.pertemuanList.forEach((p: any, index: number) => {
        if (!p.topik) errors.push(`Pertemuan ke-${index + 1}: topik tidak boleh kosong.`);
        if (!p.kegiatanInti) errors.push(`Pertemuan ke-${index + 1}: kegiatanInti tidak boleh kosong.`);
        if (!p.pemahamanBermakna) errors.push(`Pertemuan ke-${index + 1}: pemahamanBermakna wajib diisi.`);
      });
    }

    // 5. Asesmen & Rubrik check
    if (!data.asesmenDanRubrik || typeof data.asesmenDanRubrik !== 'object') {
      errors.push('Komponen asesmenDanRubrik tidak ditemukan.');
    }

    // 6. Diferensiasi & Pengayaan check
    if (!data.diferensiasiDanPengayaan || typeof data.diferensiasiDanPengayaan !== 'object') {
      errors.push('Komponen diferensiasiDanPengayaan tidak ditemukan.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates LKPD output JSON structure
   */
  validateLkpdData(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Output LKPD bukan objek JSON valid.'] };
    }

    if (!data.identitas || typeof data.identitas !== 'object') {
      errors.push('Identitas LKPD tidak ditemukan.');
    }
    if (!data.materiPokok) errors.push('LKPD: materiPokok wajib diisi.');

    if (!Array.isArray(data.tujuanPembelajaran) || data.tujuanPembelajaran.length === 0) {
      errors.push('LKPD: tujuanPembelajaran wajib berupa array non-kosong.');
    }

    if (!data.ringkasanMateri) errors.push('LKPD: ringkasanMateri wajib diisi.');
    if (!data.stimulusPermasalahan) errors.push('LKPD: stimulusPermasalahan wajib diisi.');

    if (!Array.isArray(data.aktivitasLangkahKerja) || data.aktivitasLangkahKerja.length === 0) {
      errors.push('LKPD: aktivitasLangkahKerja wajib berupa array non-kosong.');
    }

    if (!Array.isArray(data.pertanyaanDanTugas) || data.pertanyaanDanTugas.length === 0) {
      errors.push('LKPD: pertanyaanDanTugas wajib berupa array non-kosong.');
    }

    if (!data.rubrikPenilaian) errors.push('LKPD: rubrikPenilaian wajib diisi.');

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const schemaValidator = new SchemaValidator();
