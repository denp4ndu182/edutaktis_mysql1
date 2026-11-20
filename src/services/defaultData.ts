import {
  MasterInputData,
  PpraValue,
  Project,
  DocumentType,
  DocumentRecord,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProtaItem,
  ProsemData,
  KktpData,
  KktpRubrikItem,
  UserProfile,
} from '../types';

export const PPRA_DEFAULT_VALUES: PpraValue[] = [
  {
    id: 'taaddub',
    nama: "Ta'addub",
    arab: 'تأدب',
    arti: 'Berkeadaban / Akhlak Mulia',
    terpilih: true,
    catatan: 'Menjunjung etika komputasi dan adab santun dalam berinteraksi digital maupun pengoperasian AI.',
  },
  {
    id: 'qudwah',
    nama: 'Qudwah',
    arab: 'قدوة',
    arti: 'Keteladanan',
    terpilih: true,
    catatan: 'Memberikan contoh teladan dalam pemanfaatan teknologi secara jujur dan anti-plagiasi.',
  },
  {
    id: 'muwatanah',
    nama: 'Muwaṭanah',
    arab: 'مواطنة',
    arti: 'Kewarganegaraan dan Kebangsaan',
    terpilih: true,
    catatan: 'Mengembangkan solusi teknologi kecerdasan buatan untuk kemaslahatan bangsa Indonesia.',
  },
  {
    id: 'tawassut',
    nama: 'Tawassuṭ',
    arab: 'توسط',
    arti: 'Mengambil Jalan Tengah / Moderat',
    terpilih: true,
    catatan: 'Keseimbangan dalam penggunaan teknologi secara proporsional dan bijaksana.',
  },
  {
    id: 'tawazun',
    nama: 'Tawāzun',
    arab: 'توازن',
    arti: 'Keseimbangan',
    terpilih: true,
    catatan: 'Menyeimbangkan kecerdasan intelektual, emosional, spiritual, dan keterampilan praktis koding.',
  },
  {
    id: 'itidal',
    nama: "I'tidāl",
    arab: 'إعتدال',
    arti: 'Lurus dan Bersikap Adil',
    terpilih: true,
    catatan: 'Mengevaluasi keadilan algoritma dan menghindari bias data yang merugikan pihak lain.',
  },
  {
    id: 'musawah',
    nama: 'Musāwah',
    arab: 'مساواة',
    arti: 'Kesetaraan / Inklusif',
    terpilih: false,
    catatan: 'Membuka akses teknologi koding tanpa diskriminasi gender, latar belakang, dan kemampuan.',
  },
  {
    id: 'syura',
    nama: 'Syūrā',
    arab: 'شورى',
    arti: 'Musyawarah / Kolaborasi',
    terpilih: true,
    catatan: 'Bekerja sama dalam tim pemrograman melalui diskusi dan pembagian tugas yang adil.',
  },
  {
    id: 'tasamuh',
    nama: 'Tasāmuh',
    arab: 'تسامح',
    arti: 'Toleransi',
    terpilih: true,
    catatan: 'Menghargai keragaman cara berpikir dan solusi pemrograman yang diajukan peserta didik.',
  },
  {
    id: 'tathawwur',
    nama: 'Tathawwur wa Ibtikār',
    arab: 'تطور وإبتكار',
    arti: 'Dinamis dan Inovatif',
    terpilih: true,
    catatan: 'Berpikir kreatif menciptakan karya digital, program koding, dan purwarupa AI yang solutif.',
  },
];

// A. DEMO MASTER INPUT (Hanya untuk tombol "Isi Contoh Administrasi")
export const DEMO_MASTER_INPUT: MasterInputData = {
  // Identitas Kementerian dan Madrasah Contoh
  kemenagOrYayasan: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
  namaMadrasah: 'MTs Negeri 1 Kota Yogyakarta',
  alamatMadrasah: 'Jl. Lowanu No. 67, Sorosutan, Kec. Umbulharjo, Kota Yogyakarta, D.I. Yogyakarta',
  mataPelajaran: 'Koding dan Kecerdasan Artifisial',
  kodeMapel: 'KBC-AI',
  fase: 'Fase D',
  kelas: 'Kelas VII (Tujuh)',
  tahunPelajaran: '2024/2025',
  semester: 'Ganjil dan Genap',
  alokasiWaktuTotal: 72,
  jpPerMinggu: 2,
  modelPembelajaran: 'Project-Based Learning (PjBL), Discovery Learning, dan Inquiry Terintegrasi KBC',
  namaGuru: 'Ahmad Fauzi, S.Kom., M.Pd.I.',
  nipGuru: '198804152014031002',
  namaKepala: 'Drs. H. Muhammad Ridwan, M.Pd.',
  nipKepala: '197208101998031001',
  kotaTandaTangan: 'Yogyakarta',
  tanggalTandaTangan: '15 Juli 2024',

  // Data Kurikulum
  kurikulum: 'Kurikulum Merdeka Madrasah Terintegrasi Kurikulum Berbasis Cinta (KBC)',
  rasionalMapel:
    'Mata pelajaran Koding dan Kecerdasan Artifisial pada madrasah bertujuan membekali peserta didik dengan kecakapan berpikir komputasional, literasi kecerdasan buatan, dan keterampilan koding yang dilandasi nilai keimanan, cinta kasih terhadap sesama, serta tanggung jawab kebangsaan. Di era revolusi industri 4.0 dan Society 5.0, peserta didik tidak hanya dituntut menjadi pengguna teknologi yang pasif, melainkan kreator dan inovator berakhlakul karimah yang mampu memecahkan masalah nyata masyarakat dengan pendekatan Panca Cinta Kemenag.',
  cpUmum:
    'Pada akhir Fase D, peserta didik mampu memahami konsep dasar berpikir komputasional, merancang algoritma sekuensial dan percabangan dengan koding visual/tekstual, mengenal cara kerja kecerdasan artifisial secara proporsional dan beretika, serta memanfaatkannya untuk menghasilkan karya inovatif yang bermanfaat dengan dilandasi nilai cinta Allah, cinta sesama, dan cinta bangsa.',
  elemenCP: [
    {
      id: 'el-1',
      kode: 'BK',
      nama: 'Berpikir Komputasional (Computational Thinking)',
      deskripsi:
        'Peserta didik mampu menerapkan dekomposisi, pengenalan pola, abstraksi, dan perancangan algoritma untuk menyelesaikan persoalan kontekstual yang dihadapi dalam kehidupan sehari-hari dengan empati dan ketelitian.',
    },
    {
      id: 'el-2',
      kode: 'AP',
      nama: 'Algoritma dan Pemrograman (Coding)',
      deskripsi:
        'Peserta didik mampu menerjemahkan gagasan ke dalam alur algoritma terstruktur dan mengimplementasikannya dalam lingkungan pemrograman visual (block-based coding) maupun skrip terpandu untuk menghasilkan animasi, gim edukatif, atau aplikasi mini.',
    },
    {
      id: 'el-3',
      kode: 'AI-ETIK',
      nama: 'Literasi AI dan Etika Komputasi KBC',
      deskripsi:
        'Peserta didik mampu memahami konsep pembelajaran mesin sederhana (machine learning), mengenali peran AI dalam kehidupan modern, serta menerapkan prinsip etika, kejujuran akademik, dan perlindungan privasi yang berakar pada nilai akhlakul karimah.',
    },
    {
      id: 'el-4',
      kode: 'DSI',
      nama: 'Dampak Sosial Informatika dan Karya Solutif',
      deskripsi:
        'Peserta didik mampu berkolaborasi dalam tim merancang produk proyek komputasi berdaya guna untuk mengatasi permasalahan lingkungan dan sosial madrasah sebagai wujud cinta lingkungan dan tanah air.',
    },
  ],
  materiPokok:
    'Fondasi Berpikir Komputasional; Blok Pemrograman Visual (Scratch/Blockly); Logika Percabangan & Perulangan; Konsep Machine Learning & Pengenalan Citra; Etika AI dan Hak Cipta Digital; Proyek Kolaboratif Aplikasi Madrasah Ramah Lingkungan.',
  karakteristikPesertaDidik:
    'Peserta didik kelas VII berada pada fase transisi dari MI/SD, memiliki rasa ingin tahu yang tinggi terhadap gawai dan gim digital, namun memerlukan pendampingan intensif mengenai etika berselancar digital, kesabaran pemecahan masalah (debugging), dan semangat berbagi (cinta sesama).',
  modelPendekatan:
    'Student-Centered Learning, Pendekatan Kontekstual Madrasah, Project-Based Learning, Pembelajaran Berdiferensiasi, Pendekatan Kurikulum Berbasis Cinta (KBC).',
  strategiAsesmen:
    'Asesmen Diagnostik Awal (Kesiapan Belajar & Gaya Belajar), Asesmen Formatif (Observasi Debugging, Jurnal Refleksi Diri, Kuis Interaktif), Asesmen Sumatif (Portofolio Proyek Koding, Unjuk Kerja Karya AI Sederhana).',

  // Integrasi KBC & PPRA
  pancaCinta: {
    cintaAllahRasul: true,
    cintaIlmu: true,
    cintaDiriSesama: true,
    cintaLingkungan: true,
    cintaTanahAir: true,
    catatanPancaCinta:
      'Setiap pembelajaran koding diawali doa kesyukuran atas akal pikiran, mengagumi keteraturan ciptaan Allah melalui logika algoritma matematika, serta mewajibkan karya proyek berorientasi sedekah karya digital untuk madrasah.',
  },
  ppraValues: PPRA_DEFAULT_VALUES,
  catatanKBC:
    'Kurikulum Berbasis Cinta diwujudkan dengan menghadirkan suasana kelas tanpa kecemasan (anxiety-free coding), membiasakan budaya saling apresiasi saat teman mendemonstrasikan kode program, serta mengedepankan etika AI yang menjunjung nilai kemanusiaan.',

  // Data Kalender Pendidikan
  kalenderSemester1: [
    { bulan: 'Juli', mingguKalender: 5, mingguTidakEfektif: 2, mingguEfektif: 3, jp: 6, keterangan: 'Matsama (1 mgg) & Libur Awal TP (1 mgg)' },
    { bulan: 'Agustus', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'HUT RI (disisipkan dalam pembelajaran)' },
    { bulan: 'September', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Asesmen Tengah Semester Ganjil (1 mgg)' },
    { bulan: 'Oktober', mingguKalender: 5, mingguTidakEfektif: 0, mingguEfektif: 5, jp: 10, keterangan: 'Pembelajaran Efektif Penuh & Proyek Koding' },
    { bulan: 'November', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif Penuh' },
    { bulan: 'Desember', mingguKalender: 4, mingguTidakEfektif: 2, mingguEfektif: 2, jp: 4, keterangan: 'Asesmen Akhir Semester & Pembagian Rapor' },
  ],
  kalenderSemester2: [
    { bulan: 'Januari', mingguKalender: 5, mingguTidakEfektif: 1, mingguEfektif: 4, jp: 8, keterangan: 'Libur Tahun Baru & HAB Kemenag (1 mgg)' },
    { bulan: 'Februari', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif Penuh' },
    { bulan: 'Maret', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Asesmen Tengah Semester Genap (1 mgg)' },
    { bulan: 'April', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Libur Idul Fitri (1 mgg)' },
    { bulan: 'Mei', mingguKalender: 5, mingguTidakEfektif: 1, mingguEfektif: 4, jp: 8, keterangan: 'Pekan Proyek Akhir AI Berbasis Cinta' },
    { bulan: 'Juni', mingguKalender: 4, mingguTidakEfektif: 2, mingguEfektif: 2, jp: 4, keterangan: 'Asesmen Akhir Tahun & Rapor Kenaikan Kelas' },
  ],

  // Data Pendukung
  attachments: [
    {
      id: 'att-1',
      name: 'Salinan_CP_Informatika_Koding_Fase_D_Kemenag.pdf',
      size: 425000,
      type: 'application/pdf',
      uploadDate: '2024-07-10',
    },
    {
      id: 'att-2',
      name: 'Kalender_Pendidikan_Madrasah_DIY_2024_2025.pdf',
      size: 310000,
      type: 'application/pdf',
      uploadDate: '2024-07-12',
    },
  ],
};

// Alias untuk backward compatibility
export const DEFAULT_MASTER_INPUT = DEMO_MASTER_INPUT;

// B. EMPTY MASTER IDENTITY & INPUT
export const EMPTY_MASTER_IDENTITY = {
  kemenagOrYayasan: '',
  namaMadrasah: '',
  alamatMadrasah: '',
  mataPelajaran: '',
  kodeMapel: '',
  fase: 'Fase D',
  kelas: '',
  tahunPelajaran: '',
  semester: 'Ganjil dan Genap',
  alokasiWaktuTotal: 72,
  jpPerMinggu: 2,
  modelPembelajaran: 'Project-Based Learning (PjBL) Terintegrasi KBC',
  namaGuru: '',
  nipGuru: '',
  namaKepala: '',
  nipKepala: '',
  kotaTandaTangan: '',
  tanggalTandaTangan: '',
};

export const EMPTY_MASTER_INPUT: MasterInputData = {
  ...EMPTY_MASTER_IDENTITY,
  kurikulum: 'Kurikulum Merdeka Madrasah Terintegrasi Kurikulum Berbasis Cinta (KBC)',
  rasionalMapel: '',
  cpUmum: '',
  elemenCP: [],
  materiPokok: '',
  karakteristikPesertaDidik: '',
  modelPendekatan: 'Student-Centered Learning, Pendekatan Kurikulum Berbasis Cinta (KBC)',
  strategiAsesmen: 'Asesmen Diagnostik, Asesmen Formatif, dan Asesmen Sumatif',
  pancaCinta: {
    cintaAllahRasul: true,
    cintaIlmu: true,
    cintaDiriSesama: true,
    cintaLingkungan: true,
    cintaTanahAir: true,
    catatanPancaCinta: '',
  },
  ppraValues: PPRA_DEFAULT_VALUES,
  catatanKBC: '',
  kalenderSemester1: [
    { bulan: 'Juli', mingguKalender: 5, mingguTidakEfektif: 2, mingguEfektif: 3, jp: 6, keterangan: 'Matsama & Libur Awal TP' },
    { bulan: 'Agustus', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif' },
    { bulan: 'September', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Asesmen Tengah Semester' },
    { bulan: 'Oktober', mingguKalender: 5, mingguTidakEfektif: 0, mingguEfektif: 5, jp: 10, keterangan: 'Pembelajaran Efektif' },
    { bulan: 'November', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif' },
    { bulan: 'Desember', mingguKalender: 4, mingguTidakEfektif: 2, mingguEfektif: 2, jp: 4, keterangan: 'Asesmen Akhir Semester & Rapor' },
  ],
  kalenderSemester2: [
    { bulan: 'Januari', mingguKalender: 5, mingguTidakEfektif: 1, mingguEfektif: 4, jp: 8, keterangan: 'Libur Tahun Baru / HAB Kemenag' },
    { bulan: 'Februari', mingguKalender: 4, mingguTidakEfektif: 0, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif' },
    { bulan: 'Maret', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Asesmen Tengah Semester' },
    { bulan: 'April', mingguKalender: 4, mingguTidakEfektif: 1, mingguEfektif: 3, jp: 6, keterangan: 'Libur Keagamaan' },
    { bulan: 'Mei', mingguKalender: 5, mingguTidakEfektif: 1, mingguEfektif: 4, jp: 8, keterangan: 'Pembelajaran Efektif & Proyek' },
    { bulan: 'Juni', mingguKalender: 4, mingguTidakEfektif: 2, mingguEfektif: 2, jp: 4, keterangan: 'Asesmen Akhir Tahun & Rapor' },
  ],
  attachments: [],
};

// C. INITIAL DEVICE USER PROFILE (Data awal profil lokal perangkat pengguna)
export const INITIAL_DEVICE_USER_PROFILE: UserProfile = {
  id: 'usr_pandu_001',
  namaLengkap: 'Pandu Kusumahadi',
  gelarDepan: '',
  gelarBelakang: 'S.Kom',
  nip: '198703252023211023',
  nuptk: '4239765666130122',
  email: 'pandu.kusumahadi@kemenag.go.id',
  nomorTelepon: '081234567890',
  preferensiMataPelajaran: 'Koding dan Kecerdasan Artifisial',
  createdAt: '2024-01-10T08:00:00.000Z',
  updatedAt: '2024-07-15T08:00:00.000Z',

  // Backward compatibility fields
  kemenagOrYayasan: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
  namaMadrasah: 'MAN 1 Gunungkidul',
  alamatMadrasah: 'Jl. KH. Agus Salim No. 65, Ledoksari, Kepek, Wonosari, Gunungkidul, D.I. Yogyakarta',
  mataPelajaran: 'Koding dan Kecerdasan Artifisial',
  kodeMapel: 'KBC-AI',
  fase: 'Fase E',
  kelas: 'Kelas X',
  tahunPelajaran: '2024/2025',
  namaGuru: 'Pandu Kusumahadi, S.Kom',
  nipGuru: '198703252023211023',
  namaKepala: 'H. Kholis Muhajir, S.Ag., M.S.I.',
  nipKepala: '197505122003121003',
  kotaTandaTangan: 'Gunungkidul',
  tanggalTandaTangan: '15 Juli 2024',
};

// Helper: Deteksi apakah MasterInput sedang menggunakan data contoh/demo
export function isDemoIdentity(input: MasterInputData): boolean {
  if (!input) return false;
  return (
    input.namaGuru === 'Ahmad Fauzi, S.Kom., M.Pd.I.' ||
    input.namaMadrasah === 'MTs Negeri 1 Kota Yogyakarta'
  );
}

export const INITIAL_PROJECT_ID = 'proj-kbc-koding-001';

export function createEmptyDocumentRecord(docType: DocumentType): DocumentRecord {
  return {
    id: `doc-${docType.toLowerCase()}-${Date.now()}`,
    docType,
    version: 1,
    status: 'not_created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: null,
  };
}

export function createInitialProject(profile?: UserProfile | null): Project {
  const masterInput: MasterInputData = profile
    ? {
        ...EMPTY_MASTER_INPUT,
        kemenagOrYayasan: profile.kemenagOrYayasan || EMPTY_MASTER_INPUT.kemenagOrYayasan,
        namaMadrasah: profile.namaMadrasah || EMPTY_MASTER_INPUT.namaMadrasah,
        alamatMadrasah: profile.alamatMadrasah || EMPTY_MASTER_INPUT.alamatMadrasah,
        mataPelajaran: profile.mataPelajaran || EMPTY_MASTER_INPUT.mataPelajaran,
        kodeMapel: profile.kodeMapel || EMPTY_MASTER_INPUT.kodeMapel,
        fase: profile.fase || EMPTY_MASTER_INPUT.fase,
        kelas: profile.kelas || EMPTY_MASTER_INPUT.kelas,
        tahunPelajaran: profile.tahunPelajaran || EMPTY_MASTER_INPUT.tahunPelajaran,
        namaGuru: profile.namaGuru || EMPTY_MASTER_INPUT.namaGuru,
        nipGuru: profile.nipGuru || EMPTY_MASTER_INPUT.nipGuru,
        namaKepala: profile.namaKepala || EMPTY_MASTER_INPUT.namaKepala,
        nipKepala: profile.nipKepala || EMPTY_MASTER_INPUT.nipKepala,
        kotaTandaTangan: profile.kotaTandaTangan || EMPTY_MASTER_INPUT.kotaTandaTangan,
        tanggalTandaTangan: profile.tanggalTandaTangan || EMPTY_MASTER_INPUT.tanggalTandaTangan,
      }
    : { ...EMPTY_MASTER_INPUT };

  const projectName = profile?.namaMadrasah
    ? `Administrasi ${profile.mataPelajaran || 'Mapel'} - ${profile.namaMadrasah}`
    : 'Proyek Administrasi Guru KBC Baru';

  return {
    id: `proj-${Date.now()}`,
    name: projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    masterInput,
    documents: {
      ACP: createEmptyDocumentRecord('ACP'),
      TP: createEmptyDocumentRecord('TP'),
      ATP: createEmptyDocumentRecord('ATP'),
      PROTA: createEmptyDocumentRecord('PROTA'),
      PROSEM: createEmptyDocumentRecord('PROSEM'),
      KKTP: createEmptyDocumentRecord('KKTP'),
    },
  };
}

// Backward-compatible exports for existing frontend consumers.
export {
  generateDeterministicACP,
  generateDeterministicTP,
  generateDeterministicATP,
  generateDeterministicPROTA,
  generateDeterministicPROSEM,
  generateDeterministicKKTP,
} from '../shared/deterministicDocumentGenerators';
