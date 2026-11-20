import type {
  MasterInputData,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProtaItem,
  ProsemData,
  KktpData,
  KktpRubrikItem,
} from '../types';


export function generateDeterministicACP(input: MasterInputData): AcpData {
  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP (${input.jpPerMinggu} JP/Minggu)`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    rasionalMapel: input.rasionalMapel,
    cpUmum: input.cpUmum,
    analisisElemen: input.elemenCP.map((el) => {
      let kompetensi: string[] = [];
      let materi: string[] = [];
      let kedalaman = '';

      if (el.kode === 'BK') {
        kompetensi = ['Menganalisis masalah', 'Merancang dekomposisi masalah', 'Mengabstraksi solusi', 'Mengevaluasi pola algoritma'];
        materi = ['Konsep 4 Pilar Berpikir Komputasional', 'Representasi Data Sederhana', 'Pola Logika Kontekstual'];
        kedalaman = 'Peserta didik memahami konsep secara konseptual dan mempraktikkan dekomposisi persoalan madrasah.';
      } else if (el.kode === 'AP') {
        kompetensi = ['Menyusun alur algoritma', 'Menggunakan variabel dan ekspresi', 'Menerapkan struktur kendali percabangan & perulangan', 'Menguji & men-debug kode'];
        materi = ['Bahasa Pemrograman Visual Scratch/Blockly', 'Struktur Kontrol Percabangan', 'Struktur Kontrol Perulangan', 'Proyek Gim Mini Edukatif'];
        kedalaman = 'Mulai dari animasi sederhana sekuensial hingga gim edukatif interaktif dengan skor dan timer.';
      } else if (el.kode === 'AI-ETIK') {
        kompetensi = ['Mengidentifikasi konsep dasar AI', 'Membedakan data latih & data uji', 'Menganalisis dampak etis pemanfaatan AI', 'Menerapkan kejujuran akademik'];
        materi = ['Pengenalan Machine Learning & Teachable Machine', 'Computer Vision Sederhana', 'Etika AI, Hak Cipta, dan Akhlakul Karimah'];
        kedalaman = 'Eksplorasi konsep model AI ramah anak, mitigasi bias algoritma, dan adab santun berteknologi.';
      } else {
        kompetensi = ['Berkolaborasi dalam proyek', 'Mengomunikasikan solusi karya digital', 'Mengevaluasi dampak positif bagi lingkungan'];
        materi = ['Desain Solusi Komputasi Lingkungan Hidup', 'Pameran Karya Digital (Digital Expo Madrasah)'];
        kedalaman = 'Pengembangan purwarupa proyek terpadu bertema Cinta Lingkungan dan Cinta Madrasah.';
      }

      return {
        kodeElemen: el.kode,
        namaElemen: el.nama,
        kalimatCP: el.deskripsi,
        kompetensi,
        materiEsensial: materi,
        kedalamanKeluasan: kedalaman,
      };
    }),
    integrasiKBCPPRA: {
      kbcApplication:
        'Penerapan Panca Cinta (Cinta Allah & Rasul, Cinta Ilmu, Cinta Diri & Sesama, Cinta Lingkungan, Cinta Tanah Air) diintegrasikan ke dalam seluruh tema koding. Koding bukan sekadar mengejar logika biner, tetapi sarana menyebarkan kebaikan (rahmah) dan menjaga kemaslahatan alam ciptaan Allah.',
      ppraApplication:
        'Penanaman 10 Nilai PPRA (khususnya Ta\'addub, Qudwah, Tawassut, Tawazun, I\'tidal, Syura, dan Tathawwur wa Ibtikar) diterapkan melalui metode kerja kelompok (Syura), adab penggunaan kode terbuka (Ta\'addub), serta inovasi kreatif karya digital (Tathawwur wa Ibtikar).',
    },
    rekomendasiPembelajaran:
      'Pembelajaran diselenggarakan secara tatap muka berbasis laboratorium komputer dengan pendekatan Project-Based Learning (PjBL) terintegrasi KBC. Pembelajaran berdiferensiasi diterapkan pada kompleksitas blok koding sesuai kesiapan belajar peserta didik.',
    rekomendasiAsesmen:
      'Asesmen mengombinasikan asesmen diagnostik non-kognitif awal, asesmen formatif berkelanjutan (rubrik debugging, observasi adab/sikap KBC), dan asesmen sumatif produk karya koding.',
  };
}

export function generateDeterministicTP(input: MasterInputData, acp?: AcpData): TpData {
  const listTP: TpData['listTP'] = [
    {
      no: 1,
      kodeTP: 'TP.7.1',
      elemen: 'Berpikir Komputasional (Computational Thinking)',
      rumusanTP: 'Peserta didik mampu menjelaskan dan menerapkan 4 fondasi berpikir komputasional (dekomposisi, pengenalan pola, abstraksi, algoritma) untuk menyelesaikan persoalan kontekstual harian dengan teliti.',
      kompetensi: 'Menjelaskan dan menerapkan dekomposisi serta abstraksi',
      materiPokok: 'Fondasi Berpikir Komputasional',
      integrasiPancaCinta: 'Cinta Ilmu & Cinta Diri',
      integrasiPPRA: "Ta'addub & Tawāzun",
      alokasiJP: 6,
    },
    {
      no: 2,
      kodeTP: 'TP.7.2',
      elemen: 'Berpikir Komputasional (Computational Thinking)',
      rumusanTP: 'Peserta didik mampu merancang diagram alir (flowchart) dan pseudocode sederhana untuk merepresentasikan logika pemecahan masalah dengan sistematis.',
      kompetensi: 'Merancang diagram alir dan pseudocode',
      materiPokok: 'Representasi Algoritma dan Flowchart',
      integrasiPancaCinta: 'Cinta Ilmu',
      integrasiPPRA: "I'tidāl & Qudwah",
      alokasiJP: 6,
    },
    {
      no: 3,
      kodeTP: 'TP.7.3',
      elemen: 'Algoritma dan Pemrograman (Coding)',
      rumusanTP: 'Peserta didik mampu mengoperasikan antarmuka lingkungan pemrograman visual (Scratch/Blockly) serta menyusun instruksi sekuensial gerak dan suara.',
      kompetensi: 'Mengoperasikan lingkungan pemrograman visual',
      materiPokok: 'Antarmuka Visual Coding & Instruksi Sekuensial',
      integrasiPancaCinta: 'Cinta Allah dan Rasul (Kesyukuran Akal)',
      integrasiPPRA: 'Tathawwur wa Ibtikār',
      alokasiJP: 8,
    },
    {
      no: 4,
      kodeTP: 'TP.7.4',
      elemen: 'Algoritma dan Pemrograman (Coding)',
      rumusanTP: 'Peserta didik mampu menerapkan variabel, operator matematika, dan struktur kontrol percabangan (if-then-else) pada program visual interaktif.',
      kompetensi: 'Menerapkan variabel dan percabangan',
      materiPokok: 'Variabel dan Struktur Logika Percabangan',
      integrasiPancaCinta: 'Cinta Ilmu',
      integrasiPPRA: 'Tawassuṭ & Tawāzun',
      alokasiJP: 8,
    },
    {
      no: 5,
      kodeTP: 'TP.7.5',
      elemen: 'Algoritma dan Pemrograman (Coding)',
      rumusanTP: 'Peserta didik mampu menerapkan struktur kontrol perulangan (looping) dan mendemonstrasikan proses penelusuran kesalahan (debugging) dengan sabar.',
      kompetensi: 'Menerapkan perulangan dan debugging kode',
      materiPokok: 'Struktur Perulangan dan Teknik Debugging',
      integrasiPancaCinta: 'Cinta Diri dan Sesama (Kesabaran & Empati)',
      integrasiPPRA: "Ta'addub & Qudwah",
      alokasiJP: 8,
    },
    {
      no: 6,
      kodeTP: 'TP.7.6',
      elemen: 'Algoritma dan Pemrograman (Coding)',
      rumusanTP: 'Peserta didik mampu membuat proyek gim mini edukatif bertema nilai-nilai keislaman dan kebaikan sosial secara kolaboratif.',
      kompetensi: 'Membuat proyek gim mini edukatif',
      materiPokok: 'Proyek Koding Gim Edukasi Islam & Sosial',
      integrasiPancaCinta: 'Cinta Allah dan Rasul & Cinta Sesama',
      integrasiPPRA: 'Syūrā & Tathawwur wa Ibtikār',
      alokasiJP: 10,
    },
    {
      no: 7,
      kodeTP: 'TP.7.7',
      elemen: 'Literasi AI dan Etika Komputasi KBC',
      rumusanTP: 'Peserta didik mampu menjelaskan konsep dasar kecerdasan artifisial (AI), perbedaan AI dengan program konvensional, serta cara mesin belajar (machine learning).',
      kompetensi: 'Menjelaskan konsep AI dan Machine Learning',
      materiPokok: 'Pengenalan Kecerdasan Artifisial & Pembelajaran Mesin',
      integrasiPancaCinta: 'Cinta Ilmu',
      integrasiPPRA: 'Tathawwur wa Ibtikār',
      alokasiJP: 6,
    },
    {
      no: 8,
      kodeTP: 'TP.7.8',
      elemen: 'Literasi AI dan Etika Komputasi KBC',
      rumusanTP: 'Peserta didik mampu melatih model pengenalan gambar/suara sederhana menggunakan tool berbasis web (seperti Teachable Machine) dengan data yang seimbang.',
      kompetensi: 'Melatih model AI sederhana',
      materiPokok: 'Eksperimen Pelatihan Model AI (Computer Vision)',
      integrasiPancaCinta: 'Cinta Ilmu & Cinta Sesama',
      integrasiPPRA: "I'tidāl (Anti-Bias Data) & Tawāzun",
      alokasiJP: 8,
    },
    {
      no: 9,
      kodeTP: 'TP.7.9',
      elemen: 'Literasi AI dan Etika Komputasi KBC',
      rumusanTP: 'Peserta didik mampu menganalisis dilema etika pemanfaatan AI, perlindungan privasi data pribadi, dan hak kekayaan intelektual berdasarkan adab KBC.',
      kompetensi: 'Menganalisis etika AI dan privasi data',
      materiPokok: 'Etika AI, Keamanan Siber, dan Adab Digital KBC',
      integrasiPancaCinta: 'Cinta Diri dan Sesama & Cinta Tanah Air',
      integrasiPPRA: "Ta'addub & Muwaṭanah",
      alokasiJP: 6,
    },
    {
      no: 10,
      kodeTP: 'TP.7.10',
      elemen: 'Dampak Sosial Informatika dan Karya Solutif',
      rumusanTP: 'Peserta didik mampu merancang dan mempublikasikan karya komputasi/AI solutif untuk pelestarian lingkungan hidup madrasah (Smart Green Madrasah) dalam tim.',
      kompetensi: 'Merancang dan mempublikasikan proyek karya solutif',
      materiPokok: 'Proyek Kolaboratif: Smart Green Madrasah AI Solution',
      integrasiPancaCinta: 'Cinta Lingkungan & Cinta Tanah Air',
      integrasiPPRA: 'Syūrā, Muwaṭanah, dan Tathawwur wa Ibtikār',
      alokasiJP: 6,
    },
  ];

  const totalJP = listTP.reduce((acc, curr) => acc + curr.alokasiJP, 0);

  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP (${input.jpPerMinggu} JP/Minggu)`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    pemetaanElemen: [
      { elemen: 'Berpikir Komputasional (BK)', ringkasanCP: 'Penerapan 4 fondasi berpikir komputasional & diagram alir logika', jumlahTP: 2 },
      { elemen: 'Algoritma dan Pemrograman (AP)', ringkasanCP: 'Koding visual blok, percabangan, perulangan, & gim edukatif', jumlahTP: 4 },
      { elemen: 'Literasi AI dan Etika Komputasi KBC (AI-ETIK)', ringkasanCP: 'Konsep machine learning, pelatihan model AI, & etika akhlakul karimah', jumlahTP: 3 },
      { elemen: 'Dampak Sosial Informatika (DSI)', ringkasanCP: 'Proyek kolaboratif karya komputasi cinta lingkungan madrasah', jumlahTP: 1 },
    ],
    listTP,
    totalJP,
  };
}

export function generateDeterministicATP(input: MasterInputData, tpData: TpData): AtpData {
  const atpList: AtpData['listATP'] = tpData.listTP.map((tp, idx) => {
    const isSem1 = idx < 5; // First 5 TPs in Semester 1 (36 JP), Next 5 TPs in Semester 2 (36 JP)
    return {
      no: idx + 1,
      alurUrutan: idx + 1,
      kodeTP: tp.kodeTP,
      elemen: tp.elemen,
      rumusanTP: tp.rumusanTP,
      materiPokok: tp.materiPokok,
      aspekKompetensi: tp.kompetensi,
      integrasiKbcPpra: `${tp.integrasiPancaCinta} | Nilai PPRA: ${tp.integrasiPPRA}`,
      alokasiJP: tp.alokasiJP,
      semester: isSem1 ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)',
    };
  });

  const totalJPSemester1 = atpList.filter((i) => i.semester.includes('1')).reduce((a, b) => a + b.alokasiJP, 0);
  const totalJPSemester2 = atpList.filter((i) => i.semester.includes('2')).reduce((a, b) => a + b.alokasiJP, 0);

  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    visualDiagram: [
      {
        tahap: 'Tahap 1: Fondasi Logika & Algoritma (Bulan Juli - September)',
        semester: 'Semester 1',
        deskripsiAlur: 'Membangun kemampuan problem solving komputasional dasar dan alur berpikir logis menggunakan flowchart.',
        tpCodes: ['TP.7.1', 'TP.7.2'],
      },
      {
        tahap: 'Tahap 2: Implementasi Koding Visual & Proyek Beradab (Bulan Oktober - Desember)',
        semester: 'Semester 1',
        deskripsiAlur: 'Mewujudkan logika algoritma ke dalam program Scratch interaktif dengan variabel, percabangan, dan perulangan.',
        tpCodes: ['TP.7.3', 'TP.7.4', 'TP.7.5'],
      },
      {
        tahap: 'Tahap 3: Proyek Gim Edukatif & Fondasi AI Ramah Anak (Bulan Januari - Maret)',
        semester: 'Semester 2',
        deskripsiAlur: 'Mengintegrasikan kemampuan koding dalam gim mini dan mengeksplorasi konsep machine learning secara etis.',
        tpCodes: ['TP.7.6', 'TP.7.7', 'TP.7.8'],
      },
      {
        tahap: 'Tahap 4: Etika AI & Proyek Solutif Lingkungan Madrasah (Bulan April - Juni)',
        semester: 'Semester 2',
        deskripsiAlur: 'Mengkaji etika privasi dan mempublikasikan karya nyata AI/Koding untuk kelestarian alam madrasah.',
        tpCodes: ['TP.7.9', 'TP.7.10'],
      },
    ],
    listATP: atpList,
    totalJPSemester1,
    totalJPSemester2,
    totalJPTahunan: totalJPSemester1 + totalJPSemester2,
  };
}

export function generateDeterministicPROTA(input: MasterInputData, atpData: AtpData): ProtaData {
  const sem1Weeks = input.kalenderSemester1.reduce((sum, b) => sum + b.mingguEfektif, 0);
  const sem1JP = sem1Weeks * input.jpPerMinggu;
  const sem2Weeks = input.kalenderSemester2.reduce((sum, b) => sum + b.mingguEfektif, 0);
  const sem2JP = sem2Weeks * input.jpPerMinggu;

  const rencanaAlokasi: ProtaItem[] = atpData.listATP.map((item, idx) => ({
    no: idx + 1,
    semester: item.semester.includes('1') ? 'Ganjil' : 'Genap',
    kodeTP: item.kodeTP,
    tujuanDanMateri: `${item.rumusanTP} (Materi: ${item.materiPokok})`,
    elemenCP: item.elemen,
    integrasiKBCPPRA: item.integrasiKbcPpra,
    alokasiJP: item.alokasiJP,
  }));

  const subtotalGanjil = rencanaAlokasi.filter((r) => r.semester === 'Ganjil').reduce((s, i) => s + i.alokasiJP, 0);
  const subtotalGenap = rencanaAlokasi.filter((r) => r.semester === 'Genap').reduce((s, i) => s + i.alokasiJP, 0);
  const totalTahun = subtotalGanjil + subtotalGenap;

  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    distribusiMinggu: {
      semesterGanjil: {
        semester: 'Semester Ganjil',
        bulanList: input.kalenderSemester1,
        totalMingguKalender: input.kalenderSemester1.reduce((s, b) => s + b.mingguKalender, 0),
        totalMingguTidakEfektif: input.kalenderSemester1.reduce((s, b) => s + b.mingguTidakEfektif, 0),
        totalMingguEfektif: sem1Weeks,
        totalJP: sem1JP,
      },
      semesterGenap: {
        semester: 'Semester Genap',
        bulanList: input.kalenderSemester2,
        totalMingguKalender: input.kalenderSemester2.reduce((s, b) => s + b.mingguKalender, 0),
        totalMingguTidakEfektif: input.kalenderSemester2.reduce((s, b) => s + b.mingguTidakEfektif, 0),
        totalMingguEfektif: sem2Weeks,
        totalJP: sem2JP,
      },
    },
    rencanaAlokasi,
    rekapitulasi: {
      subtotalGanjilJP: subtotalGanjil,
      subtotalGenapJP: subtotalGenap,
      totalTahunJP: totalTahun,
      alokasiTargetJP: input.alokasiWaktuTotal,
      keteranganStatus: totalTahun === input.alokasiWaktuTotal ? 'Sesuai dengan Alokasi Kurikulum (100% Match)' : 'Perlu penyesuaian JP',
    },
  };
}

export function generateDeterministicPROSEM(input: MasterInputData, protaData: ProtaData): ProsemData {
  // Build monthly week distribution matrices
  const ganjilItems = protaData.rencanaAlokasi.filter((i) => i.semester === 'Ganjil');
  const genapItems = protaData.rencanaAlokasi.filter((i) => i.semester === 'Genap');

  // Semester 1 months
  const sem1Months = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  // Semester 2 months
  const sem2Months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

  // Map TP allocations to calendar weeks realistically (2 JP per meeting week)
  const itemsSem1 = ganjilItems.map((item, idx) => {
    const distribusiBulan: Record<string, number[]> = {
      Juli: [0, 0, 0, 0, 0],
      Agustus: [0, 0, 0, 0, 0],
      September: [0, 0, 0, 0, 0],
      Oktober: [0, 0, 0, 0, 0],
      November: [0, 0, 0, 0, 0],
      Desember: [0, 0, 0, 0, 0],
    };

    if (idx === 0) {
      // TP.7.1 (6 JP = 3 meetings): Juli W3, W4, W5
      distribusiBulan['Juli'] = [0, 0, 2, 2, 2];
    } else if (idx === 1) {
      // TP.7.2 (6 JP = 3 meetings): Ags W1, W2, W3
      distribusiBulan['Agustus'] = [2, 2, 2, 0, 0];
    } else if (idx === 2) {
      // TP.7.3 (8 JP = 4 meetings): Ags W4, Sept W1, W2, W4 (Sept W3 is ATS)
      distribusiBulan['Agustus'] = [0, 0, 0, 2, 0];
      distribusiBulan['September'] = [2, 2, 0, 2, 0];
    } else if (idx === 3) {
      // TP.7.4 (8 JP = 4 meetings): Okt W1, W2, W3, W4
      distribusiBulan['Oktober'] = [2, 2, 2, 2, 0];
    } else if (idx === 4) {
      // TP.7.5 (8 JP = 4 meetings): Okt W5, Nov W1, W2, W3, W4 (Des W1-W2 cadangan/review)
      distribusiBulan['Oktober'] = [0, 0, 0, 0, 2];
      distribusiBulan['November'] = [2, 2, 2, 2, 0];
      distribusiBulan['Desember'] = [2, 0, 0, 0, 0];
    }

    return {
      no: item.no,
      kodeTP: item.kodeTP,
      tujuanDanMateri: item.tujuanDanMateri,
      alokasiJP: item.alokasiJP,
      integrasiKbcPpra: item.integrasiKBCPPRA,
      distribusiBulan,
    };
  });

  const itemsSem2 = genapItems.map((item, idx) => {
    const distribusiBulan: Record<string, number[]> = {
      Januari: [0, 0, 0, 0, 0],
      Februari: [0, 0, 0, 0, 0],
      Maret: [0, 0, 0, 0, 0],
      April: [0, 0, 0, 0, 0],
      Mei: [0, 0, 0, 0, 0],
      Juni: [0, 0, 0, 0, 0],
    };

    if (idx === 0) {
      // TP.7.6 (10 JP = 5 meetings): Jan W2, W3, W4, W5, Feb W1
      distribusiBulan['Januari'] = [0, 2, 2, 2, 2];
      distribusiBulan['Februari'] = [2, 0, 0, 0, 0];
    } else if (idx === 1) {
      // TP.7.7 (6 JP = 3 meetings): Feb W2, W3, W4
      distribusiBulan['Februari'] = [0, 2, 2, 2, 0];
    } else if (idx === 2) {
      // TP.7.8 (8 JP = 4 meetings): Mar W1, W2, W4, Apr W1 (Mar W3 is ATS)
      distribusiBulan['Maret'] = [2, 2, 0, 2, 0];
      distribusiBulan['April'] = [2, 0, 0, 0, 0];
    } else if (idx === 3) {
      // TP.7.9 (6 JP = 3 meetings): Apr W2, W4, Mei W1 (Apr W3 libur Idul Fitri)
      distribusiBulan['April'] = [0, 2, 0, 2, 0];
      distribusiBulan['Mei'] = [2, 0, 0, 0, 0];
    } else if (idx === 4) {
      // TP.7.10 (6 JP = 3 meetings): Mei W2, W3, W4 (Mei W5 & Jun W1 evaluasi akhir)
      distribusiBulan['Mei'] = [0, 2, 2, 2, 0];
      distribusiBulan['Juni'] = [2, 0, 0, 0, 0];
    }

    return {
      no: item.no,
      kodeTP: item.kodeTP,
      tujuanDanMateri: item.tujuanDanMateri,
      alokasiJP: item.alokasiJP,
      integrasiKbcPpra: item.integrasiKBCPPRA,
      distribusiBulan,
    };
  });

  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    legenda: [
      { simbol: '2', keterangan: 'Pembelajaran Tatap Muka Aktif (2 JP)', warna: 'bg-teal-100 text-teal-800' },
      { simbol: 'ATS', keterangan: 'Asesmen Tengah Semester', warna: 'bg-amber-100 text-amber-800' },
      { simbol: 'AAS', keterangan: 'Asesmen Akhir Semester / Tahun', warna: 'bg-rose-100 text-rose-800' },
      { simbol: 'LBR', keterangan: 'Libur Awal TP / Hari Raya / Semester', warna: 'bg-gray-100 text-gray-700' },
      { simbol: 'MAT', keterangan: 'Masa Ta\'aruf Siswa Madrasah (Matsama)', warna: 'bg-blue-100 text-blue-800' },
    ],
    semesterGanjil: {
      semesterName: 'Semester Ganjil',
      months: sem1Months,
      items: itemsSem1,
      totalJPSemester: itemsSem1.reduce((a, b) => a + b.alokasiJP, 0),
      mingguEfektifCount: input.kalenderSemester1.reduce((s, b) => s + b.mingguEfektif, 0),
    },
    semesterGenap: {
      semesterName: 'Semester Genap',
      months: sem2Months,
      items: itemsSem2,
      totalJPSemester: itemsSem2.reduce((a, b) => a + b.alokasiJP, 0),
      mingguEfektifCount: input.kalenderSemester2.reduce((s, b) => s + b.mingguEfektif, 0),
    },
    rekapitulasi: {
      ganjilJP: itemsSem1.reduce((a, b) => a + b.alokasiJP, 0),
      genapJP: itemsSem2.reduce((a, b) => a + b.alokasiJP, 0),
      totalJP: itemsSem1.reduce((a, b) => a + b.alokasiJP, 0) + itemsSem2.reduce((a, b) => a + b.alokasiJP, 0),
    },
  };
}

export function generateDeterministicKKTP(input: MasterInputData, tpData: TpData): KktpData {
  const listRubrik: KktpRubrikItem[] = tpData.listTP.map((tp) => {
    return {
      kodeTP: tp.kodeTP,
      rumusanTP: tp.rumusanTP,
      indikatorKetercapaian: [
        `Mampu mengidentifikasi komponen konsep utama pada materi ${tp.materiPokok}.`,
        `Mampu mempraktikkan keterampilan koding/AI secara terstruktur dan mandiri.`,
        `Menunjukkan sikap adab, kejujuran etis, dan empati sosial selama pembelajaran.`,
      ],
      kriteria: {
        perluBimbingan: 'Belum mampu mengenali konsep dasar dan belum dapat menjalankan instruksi program tanpa panduan ketat guru (Skor < 70).',
        cukup: 'Mampu menjelaskan sebagian konsep dasar dan mampu menulis kode program sederhana dengan sedikit bimbingan (Skor 70-79).',
        baik: 'Mampu menjelaskan konsep secara tepat, menyelesaikan tugas pemrograman secara mandiri, dan menerapkan adab KBC dengan baik (Skor 80-89).',
        mahir: 'Mampu menganalisis masalah kompleks, mengembangkan kode program inovatif di luar contoh, serta membimbing teman sebaya dengan akhlak terpuji (Skor 90-100).',
      },
      buktiAsesmen: 'Portofolio proyek koding visual, lembar observasi proses debugging, dan kuis pemahaman konsep berbasis LMS madrasah.',
      rencanaTindakLanjut: {
        remedial: 'Bimbingan terfokus secara personal atau berpasangan (peer tutoring) pada konsep logika yang belum tuntas sebelum melanjutkan materi.',
        pengayaan: 'Diberikan tantangan modul ekstra berupa penambahan fitur koding interaktif, kecerdasan buatan terapan, atau studi kasus lanjutan.',
      },
    };
  });

  return {
    identitas: {
      satuanPendidikan: input.namaMadrasah,
      kemenagYayasan: input.kemenagOrYayasan,
      mataPelajaran: input.mataPelajaran,
      faseKelas: `${input.fase} / ${input.kelas}`,
      tahunPelajaran: input.tahunPelajaran,
      alokasiWaktu: `${input.alokasiWaktuTotal} JP`,
      penyusun: `${input.namaGuru} (NIP. ${input.nipGuru})`,
      kepalaMadrasah: `${input.namaKepala} (NIP. ${input.nipKepala})`,
      pengesahan: `${input.kotaTandaTangan}, ${input.tanggalTandaTangan}`,
    },
    deskripsiLevelUmum: [
      { interval: '0 - 69%', kategori: 'Perlu Bimbingan', keterangan: 'Belum mencapai ketuntasan tujuan pembelajaran, memerlukan intervensi remedial intensif.' },
      { interval: '70 - 79%', kategori: 'Cukup', keterangan: 'Mencapai ketuntasan minimal, perlu penguatan pada aspek analisis dan kemandirian.' },
      { interval: '80 - 89%', kategori: 'Baik', keterangan: 'Mencapai ketuntasan dengan baik, mampu menyelesaikan tugas mandiri secara tuntas.' },
      { interval: '90 - 100%', kategori: 'Sangat Baik (Mahir)', keterangan: 'Melampaui ketuntasan, mampu berinovasi dan menjadi tutor sebaya bagi temannya.' },
    ],
    listRubrik,
    strategiAsesmen: input.strategiAsesmen,
    tindakLanjutUmum:
      'Peserta didik yang memperoleh kategori Perlu Bimbingan (<70%) mengikuti kegiatan remedial dengan modul simplifikasi. Peserta didik kategori Cukup & Baik melanjutkan ke materi berikutnya. Peserta didik kategori Mahir diberikan pengayaan dan peran sebagai pendamping sebaya berbasis adab Qudwah.',
  };
}
