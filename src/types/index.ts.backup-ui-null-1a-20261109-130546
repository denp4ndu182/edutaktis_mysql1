export type DocumentType = 'ACP' | 'TP' | 'ATP' | 'PROTA' | 'PROSEM' | 'KKTP';

export type DocumentStatus = 'not_created' | 'generating' | 'completed' | 'needs_revision' | 'failed';

export interface ElemenCP {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string;
}

export interface PpraValue {
  id: string;
  nama: string;
  arab: string;
  arti: string;
  terpilih: boolean;
  catatan: string;
}

export interface PancaCintaConfig {
  cintaAllahRasul: boolean;
  cintaIlmu: boolean;
  cintaDiriSesama: boolean;
  cintaLingkungan: boolean;
  cintaTanahAir: boolean;
  catatanPancaCinta: string;
}

export interface BulanKalender {
  bulan: string;
  mingguKalender: number;
  mingguTidakEfektif: number;
  mingguEfektif: number;
  jp: number;
  keterangan: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
}

export type InstitutionRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'HEADMASTER' | 'TEACHER' | 'OPERATOR';

export type MembershipStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface UserProfile {
  id: string;
  namaLengkap: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  nip: string;
  nuptk?: string;
  email: string;
  nomorTelepon?: string;
  fotoProfilUrl?: string;
  preferensiMataPelajaran: string;
  createdAt: string;
  updatedAt: string;

  // Backward compatibility fields from Phase 1
  namaGuru?: string;
  nipGuru?: string;
  kemenagOrYayasan?: string;
  namaMadrasah?: string;
  alamatMadrasah?: string;
  mataPelajaran?: string;
  kodeMapel?: string;
  fase?: string;
  kelas?: string;
  tahunPelajaran?: string;
  namaKepala?: string;
  nipKepala?: string;
  kotaTandaTangan?: string;
  tanggalTandaTangan?: string;
}

export interface InstitutionProfile {
  id: string;
  namaResmi: string;
  namaSingkat: string;
  jenjang: string;
  jenisInstitusi: string;
  npsn: string;
  kementerianDinas: string;
  alamatLengkap: string;
  kelurahanDesa: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  telepon: string;
  email: string;
  website: string;
  logoUrl?: string;
  namaKepala: string;
  nipKepala: string;
  kotaTandaTangan: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionMembership {
  id: string;
  userId: string;
  institutionId: string;
  role: InstitutionRole;
  status: MembershipStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface TenantContext {
  currentUser: UserProfile;
  currentMembership: InstitutionMembership;
  currentInstitution: InstitutionProfile;
  userInstitutions: Array<{
    institution: InstitutionProfile;
    membership: InstitutionMembership;
  }>;
}

export interface MasterInputData {
  // A. Identitas Kementerian dan Madrasah
  kemenagOrYayasan: string;
  namaMadrasah: string;
  alamatMadrasah: string;
  mataPelajaran: string;
  kodeMapel: string;
  fase: string;
  kelas: string;
  tahunPelajaran: string;
  semester: string;
  alokasiWaktuTotal: number;
  jpPerMinggu: number;
  modelPembelajaran: string;
  namaGuru: string;
  nipGuru: string;
  namaKepala: string;
  nipKepala: string;
  kotaTandaTangan: string;
  tanggalTandaTangan: string;

  // B. Data Kurikulum
  kurikulum: string;
  rasionalMapel: string;
  cpUmum: string;
  elemenCP: ElemenCP[];
  materiPokok: string;
  karakteristikPesertaDidik: string;
  modelPendekatan: string;
  strategiAsesmen: string;

  // C. Integrasi KBC & PPRA
  pancaCinta: PancaCintaConfig;
  ppraValues: PpraValue[];
  catatanKBC: string;

  // D. Kalender Pendidikan
  kalenderSemester1: BulanKalender[];
  kalenderSemester2: BulanKalender[];

  // E. Data Pendukung
  attachments: AttachmentFile[];
}

// 1. ACP Document Data Structure
export interface AcpElemenAnalisis {
  kodeElemen: string;
  namaElemen: string;
  kalimatCP: string;
  kompetensi: string[];
  materiEsensial: string[];
  kedalamanKeluasan: string;
}

export interface AcpData {
  identitas: Record<string, string>;
  rasionalMapel: string;
  cpUmum: string;
  analisisElemen: AcpElemenAnalisis[];
  integrasiKBCPPRA: {
    kbcApplication: string;
    ppraApplication: string;
  };
  rekomendasiPembelajaran: string;
  rekomendasiAsesmen: string;
}

// 2. TP Document Data Structure
export interface TujuanPembelajaranItem {
  no: number;
  kodeTP: string;
  elemen: string;
  rumusanTP: string;
  kompetensi: string;
  materiPokok: string;
  integrasiPancaCinta: string;
  integrasiPPRA: string;
  alokasiJP: number;
}

export interface TpData {
  identitas: Record<string, string>;
  pemetaanElemen: {
    elemen: string;
    ringkasanCP: string;
    jumlahTP: number;
  }[];
  listTP: TujuanPembelajaranItem[];
  totalJP: number;
}

// 3. ATP Document Data Structure
export interface AtpItem {
  no: number;
  alurUrutan: number;
  kodeTP: string;
  elemen: string;
  rumusanTP: string;
  materiPokok: string;
  aspekKompetensi: string;
  integrasiKbcPpra: string;
  alokasiJP: number;
  semester: string;
}

export interface AtpData {
  identitas: Record<string, string>;
  visualDiagram: {
    tahap: string;
    semester: string;
    deskripsiAlur: string;
    tpCodes: string[];
  }[];
  listATP: AtpItem[];
  totalJPSemester1: number;
  totalJPSemester2: number;
  totalJPTahunan: number;
}

// 4. PROTA Document Data Structure
export interface ProtaDistribusiSemester {
  semester: string;
  bulanList: BulanKalender[];
  totalMingguKalender: number;
  totalMingguTidakEfektif: number;
  totalMingguEfektif: number;
  totalJP: number;
}

export interface ProtaItem {
  no: number;
  semester: string;
  kodeTP: string;
  tujuanDanMateri: string;
  elemenCP: string;
  integrasiKBCPPRA: string;
  alokasiJP: number;
}

export interface ProtaData {
  identitas: Record<string, string>;
  distribusiMinggu: {
    semesterGanjil: ProtaDistribusiSemester;
    semesterGenap: ProtaDistribusiSemester;
  };
  rencanaAlokasi: ProtaItem[];
  rekapitulasi: {
    subtotalGanjilJP: number;
    subtotalGenapJP: number;
    totalTahunJP: number;
    alokasiTargetJP: number;
    keteranganStatus: string;
  };
}

// 5. PROSEM Document Data Structure
export interface ProsemItem {
  no: number;
  kodeTP: string;
  tujuanDanMateri: string;
  alokasiJP: number;
  integrasiKbcPpra: string;
  // Distribution across 5 weeks per month. key: e.g. "Juli", value: [2, 0, 0, 0, 0]
  distribusiBulan: Record<string, number[]>;
}

export interface ProsemSemesterData {
  semesterName: string;
  months: string[];
  items: ProsemItem[];
  totalJPSemester: number;
  mingguEfektifCount: number;
}

export interface ProsemData {
  identitas: Record<string, string>;
  legenda: {
    simbol: string;
    keterangan: string;
    warna: string;
  }[];
  semesterGanjil: ProsemSemesterData;
  semesterGenap: ProsemSemesterData;
  rekapitulasi: {
    ganjilJP: number;
    genapJP: number;
    totalJP: number;
  };
}

// 6. KKTP Document Data Structure
export interface KktpRubrikItem {
  kodeTP: string;
  rumusanTP: string;
  indikatorKetercapaian: string[];
  kriteria: {
    perluBimbingan: string; // 0 - 69
    cukup: string;          // 70 - 79
    baik: string;           // 80 - 89
    sangatBaik?: string;    // 90 - 100
    mahir?: string;         // 90 - 100
  };
  buktiAsesmen: string;
  rencanaTindakLanjut: {
    remedial: string;
    pengayaan: string;
  };
}

export interface KktpData {
  identitas: Record<string, string>;
  deskripsiLevelUmum: {
    interval: string;
    kategori: string;
    keterangan: string;
  }[];
  listRubrik: KktpRubrikItem[];
  strategiAsesmen: string;
  tindakLanjutUmum: string;
}

export type AnyDocumentContent = AcpData | TpData | AtpData | ProtaData | ProsemData | KktpData;

export interface DocumentRecord {
  id: string;
  docType: DocumentType;
  version: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  content: AnyDocumentContent | null;
  changelog?: string;
  error?: string;
}

// ==========================================
// PHASE 1A — MODUL AJAR KBC & LKPD TYPES
// ==========================================

export interface AcademicSourceReferences {
  acpAvailable: boolean;
  tpAvailable: boolean;
  atpAvailable: boolean;
  selectedTpCodes?: string[];
  selectedAtpCodes?: string[];
  tpItems?: Array<{ kodeTP: string; rumusanTP: string; materiPokok: string }>;
  acpSummary?: string;
  warnings?: string[];
}

export interface TeacherGenerationInput {
  materiPokok: string;
  gayaMengajar: string;
  modelPembelajaran?: string;
  alokasiWaktu: number;
  jumlahPertemuan: number;
  karakteristikKelas?: string;
  catatanKhusus?: string;
  selectedTpCodes?: string[];
}

export interface ModulAjarKbcData {
  identitas: Record<string, string>;
  informasiUmum: {
    materiPokok: string;
    gayaMengajar: string;
    modelPembelajaran: string;
    alokasiWaktuTotal: string;
    jumlahPertemuan: number;
    karakteristikKelas: string;
    saranaPrasarana: string;
  };
  pembuktianKBC: {
    pancaCintaFocus: string[];
    ppraValuesFocus: string[];
    catatanKBC: string;
  };
  capaianDanTujuan: {
    rasional: string;
    cpElemen: string;
    tujuanPembelajaran: Array<{ kodeTP: string; rumusanTP: string }>;
  };
  pertemuanList: Array<{
    pertemuanKe: number;
    alokasiJP: number;
    topik: string;
    tujuanPertemuan: string;
    pemahamanBermakna: string;
    pertanyaanPemantik: string[];
    kegiatanPendahuluan: string;
    kegiatanInti: string;
    kegiatanPenutup: string;
    rencanaAsesmenFormatif: string;
  }>;
  asesmenDanRubrik: {
    asesmenDiagnostik: string;
    asesmenFormatif: string;
    asesmenSumatif: string;
    rubrikPenilaian: string;
  };
  diferensiasiDanPengayaan: {
    pembelajaranDiferensiasi: string;
    remedial: string;
    pengayaan: string;
    refleksiGuruDanSiswa: string;
  };
}

export interface ModulAjarKbcRecord {
  id: string;
  title: string;
  version: number;
  status: 'draft' | 'completed' | 'needs_revision';
  createdAt: string;
  updatedAt: string;
  teacherInput: TeacherGenerationInput;
  sourceReferences: AcademicSourceReferences;
  content: ModulAjarKbcData | null;
  changelog?: string;
  versionsHistory?: Array<{
    version: number;
    updatedAt: string;
    changelog?: string;
    content: ModulAjarKbcData | null;
  }>;
}

export interface LkpdData {
  identitas: Record<string, string>;
  mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
  materiPokok: string;
  tujuanPembelajaran: string[];
  petunjukPenggunaan: string[];
  alatDanBahan: string[];
  ringkasanMateri: string;
  stimulusPermasalahan: string;
  aktivitasLangkahKerja: Array<{
    langkahKe: number;
    instruksi: string;
    ruangJawaban: string;
  }>;
  pertanyaanDanTugas: Array<{
    nomor: number;
    soal: string;
    bobot: number;
  }>;
  refleksiSiswa: string;
  rubrikPenilaian: string;
  referensi: string[];
}

export interface LkpdRecord {
  id: string;
  title: string;
  version: number;
  status: 'draft' | 'completed' | 'needs_revision';
  mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
  sourceModuleId?: string;
  createdAt: string;
  updatedAt: string;
  teacherInput: Partial<TeacherGenerationInput>;
  sourceReferences: AcademicSourceReferences;
  content: LkpdData | null;
  changelog?: string;
  versionsHistory?: Array<{
    version: number;
    updatedAt: string;
    changelog?: string;
    content: LkpdData | null;
  }>;
}

export interface DocumentCollection {
  modulAjar: ModulAjarKbcRecord[];
  lkpd: LkpdRecord[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  masterInput: MasterInputData;
  documents: Record<DocumentType, DocumentRecord>;
  collections?: DocumentCollection;
}
