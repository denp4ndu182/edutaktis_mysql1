import { GoogleGenAI } from '@google/genai';
import {
  TeacherGenerationInput,
  ModulAjarKbcData,
  LkpdData,
  ModulAjarKbcRecord,
} from '../types';
import { AcademicMappingResult } from './academicMappingService';
import { schemaValidator } from './schemaValidator';

export interface GenerationEngineResult<T> {
  content: T;
  source: 'gemini_ai' | 'algorithmic_engine';
  status: 'completed' | 'draft';
  changelog: string;
}

export class ModulAjarAiService {
  private getAiClient(): GoogleGenAI | null {
    if (process.env.GEMINI_API_KEY) {
      return new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'edutaktis-saas-kbc',
          },
        },
      });
    }
    return null;
  }

  private getModelName(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Deterministic fallback generator for Modul Ajar KBC.
   * Generates a structured pedagogical draft strictly from database academic records.
   */
  generateDeterministicModulAjar(
    mapping: AcademicMappingResult,
    input: TeacherGenerationInput
  ): ModulAjarKbcData {
    const mi = mapping.masterInput;
    const tpListStr = mapping.matchedTpItems
      .map((t) => `${t.kodeTP}: ${t.rumusanTP}`)
      .join('; ');

    const meetingsCount = input.jumlahPertemuan > 0 ? input.jumlahPertemuan : 2;
    const totalJP = input.alokasiWaktu > 0 ? input.alokasiWaktu : 6;
    const jpPerMeeting = Math.max(1, Math.round(totalJP / meetingsCount));

    const pancaCintaList: string[] = [];
    if (mi.pancaCinta?.cintaAllahRasul) pancaCintaList.push('Cinta Allah dan Rasul-Nya');
    if (mi.pancaCinta?.cintaIlmu) pancaCintaList.push('Cinta Ilmu');
    if (mi.pancaCinta?.cintaDiriSesama) pancaCintaList.push('Cinta Diri dan Sesama Manusia');
    if (mi.pancaCinta?.cintaLingkungan) pancaCintaList.push('Cinta Lingkungan');
    if (mi.pancaCinta?.cintaTanahAir) pancaCintaList.push('Cinta Tanah Air');
    if (pancaCintaList.length === 0) pancaCintaList.push('Cinta Ilmu', 'Cinta Diri dan Sesama Manusia');

    const ppraList = (mi.ppraValues || [])
      .filter((v: any) => v.terpilih)
      .map((v: any) => `${v.nama} (${v.arab})`);
    if (ppraList.length === 0) ppraList.push('Tawasut (Aturan Pertengahan)', 'Tawazun (Keseimbangan)');

    const pertemuanList = Array.from({ length: meetingsCount }, (_, i) => ({
      pertemuanKe: i + 1,
      alokasiJP: jpPerMeeting,
      topik: `${input.materiPokok} - Bagian ${i + 1}`,
      tujuanPertemuan: `Peserta didik mampu memahami dan menerapkan ${input.materiPokok} pada pertemuan ke-${i + 1}`,
      pemahamanBermakna: `Memahami konsep ${input.materiPokok} memberikan wawasan praktis dan membentuk karakter pembelajar yang berakhlak mulia.`,
      pertanyaanPemantik: [
        `Mengapa konsep ${input.materiPokok} penting dalam kehidupan sehari-hari?`,
        `Bagaimana nilai ${pancaCintaList[0]} tercermin saat kita mempelajari materi ini?`,
      ],
      kegiatanPendahuluan: `Guru membuka kelas dengan salam, doa bersama, melakukan presensi, dan memberikan apersepsi terkait ${input.materiPokok}.`,
      kegiatanInti: `Peserta didik melakukan eksplorasi materi ${input.materiPokok} melalui pendekatan ${input.modelPembelajaran || 'Project-Based Learning'}, mendiskusikan studi kasus secara berpasangan/kelompok, dan mempresentasikan hasil kerja.`,
      kegiatanPenutup: `Guru bersama peserta didik menyimpulkan poin utama pembelajaran, memberikan kuis reflektif singkat, dan menutup dengan doa serta salam.`,
      rencanaAsesmenFormatif: 'Observasi keaktifan diskusi kelompok dan lembar ceklis kinerja.',
    }));

    return {
      identitas: {
        satuanPendidikan: mi.namaMadrasah || 'Madrasah',
        kemenagYayasan: mi.kemenagOrYayasan || 'Kementerian Agama RI',
        mataPelajaran: mi.mataPelajaran || 'Mata Pelajaran',
        faseKelas: `${mi.fase || 'Fase'} / ${mi.kelas || 'Kelas'}`,
        tahunPelajaran: mi.tahunPelajaran || '2024/2025',
        alokasiWaktu: `${totalJP} JP (${meetingsCount} Pertemuan)`,
        penyusun: `${mi.namaGuru || 'Guru Pengampu'} (NIP. ${mi.nipGuru || '-'})`,
        kepalaMadrasah: `${mi.namaKepala || 'Kepala Madrasah'} (NIP. ${mi.nipKepala || '-'})`,
        pengesahan: `${mi.kotaTandaTangan || 'Kota'}, ${mi.tanggalTandaTangan || '2024'}`,
      },
      informasiUmum: {
        materiPokok: input.materiPokok,
        gayaMengajar: input.gayaMengajar,
        modelPembelajaran: input.modelPembelajaran || 'Project-Based Learning (PjBL)',
        alokasiWaktuTotal: `${totalJP} JP`,
        jumlahPertemuan: meetingsCount,
        karakteristikKelas: input.karakteristikKelas || 'Heterogen dengan pemahaman awal bervariasi',
        saranaPrasarana: 'Proyektor, Laptop, Lembar Kerja Siswa, Papan Tulis, Koneksi Internet',
      },
      pembuktianKBC: {
        pancaCintaFocus: pancaCintaList,
        ppraValuesFocus: ppraList,
        catatanKBC: input.catatanKhusus || 'Penanaman akhlak mulia dan kecintaan terhadap ilmu pengetahuan.',
      },
      capaianDanTujuan: {
        rasional: mapping.acpData?.rasionalMapel || 'Rasional mata pelajaran berdasarkan Kurikulum Merdeka.',
        cpElemen: mapping.matchedAcpElements.map((e) => `${e.namaElemen}: ${e.kalimatCP}`).join('\n'),
        tujuanPembelajaran: mapping.matchedTpItems.map((t) => ({
          kodeTP: t.kodeTP,
          rumusanTP: t.rumusanTP,
        })),
      },
      pertemuanList,
      asesmenDanRubrik: {
        asesmenDiagnostik: 'Kuis singkat prasyarat awal materi sebelum memulai proyek.',
        asesmenFormatif: 'Observasi keaktifan, unjuk kerja kelompok, dan tanggapan diskusi.',
        asesmenSumatif: 'Tes tertulis akhir modul dan penilaian produk proyek.',
        rubrikPenilaian: 'Skala rubrik 4 tingkat: Perlu Bimbingan (<70), Cukup (70-79), Baik (80-89), Sangat Baik (90-100).',
      },
      diferensiasiDanPengayaan: {
        pembelajaranDiferensiasi: 'Diferensiasi konten (bahan bacaan bertingkat) dan diferensiasi proses (pilihan peran kelompok).',
        remedial: 'Bimbingan perorangan pada indikator TP yang belum dicapai.',
        pengayaan: 'Pemberian proyek pendalaman materi untuk peserta didik berkinerja tinggi.',
        refleksiGuruDanSiswa: 'Lembar refleksi ketercapaian tujuan dan kesan pembelajaran berbasis Panca Cinta.',
      },
    };
  }

  /**
   * Deterministic fallback generator for LKPD.
   */
  generateDeterministicLkpd(
    mapping: AcademicMappingResult,
    input: {
      mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
      materiPokok: string;
      sourceModule?: ModulAjarKbcRecord | null;
    }
  ): LkpdData {
    const mi = mapping.masterInput;
    const tpListStr = mapping.matchedTpItems.map((t) => `${t.kodeTP}: ${t.rumusanTP}`);

    return {
      identitas: {
        satuanPendidikan: mi.namaMadrasah || 'Madrasah',
        mataPelajaran: mi.mataPelajaran || 'Mata Pelajaran',
        faseKelas: `${mi.fase || 'Fase'} / ${mi.kelas || 'Kelas'}`,
        materiPokok: input.materiPokok,
        penyusun: mi.namaGuru || 'Guru Pengampu',
      },
      mode: input.mode,
      materiPokok: input.materiPokok,
      tujuanPembelajaran: tpListStr,
      petunjukPenggunaan: [
        'Bacalah setiap instruksi dengan cermat sebelum mengerjakan.',
        'Diskusikan setiap permasalahan dengan anggota kelompok Anda.',
        'Tuliskan hasil kerja pada ruang jawaban yang telah disediakan.',
        'Tanyakan kepada guru jika terdapat hal yang belum dipahami.',
      ],
      alatDanBahan: ['Lembar Kerja Peserta Didik', 'Alat Tulis', 'Buku Paket / Modul', 'Perangkat Laptop/HP (jika diperlukan)'],
      ringkasanMateri: `Ringkasan Esensial Materi ${input.materiPokok}: Memahami konsep dasar, struktur, dan penerapan praktisnya dalam pemecahan masalah sehari-hari.`,
      stimulusPermasalahan: `Studi Kasus Kontekstual: Bagaimana konsep ${input.materiPokok} dapat digunakan untuk menyelesaikan permasalahan praktis di lingkungan sekitar kita?`,
      aktivitasLangkahKerja: [
        {
          langkahKe: 1,
          instruksi: `Amatilah permasalahan kontekstual mengenai ${input.materiPokok} yang disajikan oleh guru.`,
          ruangJawaban: 'Tuliskan catat awal dan identifikasi masalah di sini...',
        },
        {
          langkahKe: 2,
          instruksi: 'Diskusikan bersama kelompok Anda rumusan solusi dan alternatif penyelesaian terbaik.',
          ruangJawaban: 'Tuliskan hasil diskusi kelompok di sini...',
        },
        {
          langkahKe: 3,
          instruksi: 'Susun kesimpulan akhir dan siapkan poin presentasi singkat.',
          ruangJawaban: 'Tuliskan kesimpulan akhir kelompok di sini...',
        },
      ],
      pertanyaanDanTugas: [
        {
          nomor: 1,
          soal: `Jelaskan pengertian dan prinsip utama dari ${input.materiPokok}!`,
          bobot: 30,
        },
        {
          nomor: 2,
          soal: `Berikan 2 contoh penerapan ${input.materiPokok} dalam kehidupan sehari-hari!`,
          bobot: 30,
        },
        {
          nomor: 3,
          soal: `Analisislah potensi kendala dan solusi saat mengimplementasikan ${input.materiPokok}!`,
          bobot: 40,
        },
      ],
      refleksiSiswa: 'Bagian mana dari pembelajaran hari ini yang paling menarik dan memberikan wawasan baru bagi Anda?',
      rubrikPenilaian: 'Penilaian Kinerja Kelompok: Kelengkapan Jawaban (40%), Kerjasama (30%), Kejelasan Presentasi (30%).',
      referensi: ['Buku Teks Utama Kurikulum Merdeka Kemenag RI', 'Modul Pembelajaran EduTaktis SaaS'],
    };
  }

  /**
   * Generates Modul Ajar KBC using Gemini AI with fallback.
   */
  async generateModulAjarKbc(
    mapping: AcademicMappingResult,
    input: TeacherGenerationInput
  ): Promise<GenerationEngineResult<ModulAjarKbcData>> {
    const aiClient = this.getAiClient();

    if (!aiClient) {
      // Deterministic Fallback when API Key is missing
      const fallbackData = this.generateDeterministicModulAjar(mapping, input);
      return {
        content: fallbackData,
        source: 'algorithmic_engine',
        status: 'draft',
        changelog: 'Digenerate oleh Educational Algorithm Engine (Tanpa GEMINI_API_KEY)',
      };
    }

    try {
      const modelName = this.getModelName();
      const systemInstruction = `Anda adalah pakar penyusun Kurikulum Berbasis Cinta (KBC), Kurikulum Merdeka Kemenag RI, dan Profil Pelajar Rahmatan lil 'Alamin (PPRA).
Tugas Anda adalah menghasilkan dokumen Modul Ajar KBC terstruktur dalam format JSON murni.
Integrasikan Panca Cinta (Cinta Allah & Rasul, Cinta Ilmu, Cinta Lingkungan, Cinta Diri & Sesama, Cinta Tanah Air) secara kontekstual ke dalam aktivitas pembelajaran.
Jangan mengarang kutipan ayat/hadis yang tidak valid. Keluarkan HANYA JSON valid.`;

      const prompt = `Susun Modul Ajar KBC untuk:
Mata Pelajaran: ${mapping.masterInput.mataPelajaran} (${mapping.masterInput.fase} / ${mapping.masterInput.kelas})
Materi Pokok: ${input.materiPokok}
Gaya Mengajar: ${input.gayaMengajar}
Model Pembelajaran: ${input.modelPembelajaran || 'Project-Based Learning'}
Total JP: ${mapping.timeAllocationPerMeeting.totalJP} JP
Jumlah Pertemuan: ${mapping.timeAllocationPerMeeting.jumlahPertemuan} Pertemuan (${mapping.timeAllocationPerMeeting.jpPerPertemuan} JP/Pertemuan)
TP Acuan Resmi: ${JSON.stringify(mapping.matchedTpItems)}
Elemen ACP Acuan: ${JSON.stringify(mapping.matchedAcpElements.map((e) => e.namaElemen))}
Catatan Khusus: ${input.catatanKhusus || 'Penanaman Panca Cinta'}

Format JSON wajib:
{
  "identitas": {
    "satuanPendidikan": "${mapping.masterInput.namaMadrasah}",
    "kemenagYayasan": "${mapping.masterInput.kemenagOrYayasan}",
    "mataPelajaran": "${mapping.masterInput.mataPelajaran}",
    "faseKelas": "${mapping.masterInput.fase} / ${mapping.masterInput.kelas}",
    "tahunPelajaran": "${mapping.masterInput.tahunPelajaran}",
    "alokasiWaktu": "${mapping.timeAllocationPerMeeting.totalJP} JP (${mapping.timeAllocationPerMeeting.jumlahPertemuan} Pertemuan)",
    "penyusun": "${mapping.masterInput.namaGuru} (NIP. ${mapping.masterInput.nipGuru})",
    "kepalaMadrasah": "${mapping.masterInput.namaKepala} (NIP. ${mapping.masterInput.nipKepala})",
    "pengesahan": "${mapping.masterInput.kotaTandaTangan}, ${mapping.masterInput.tanggalTandaTangan}"
  },
  "informasiUmum": {
    "materiPokok": "${input.materiPokok}",
    "gayaMengajar": "${input.gayaMengajar}",
    "modelPembelajaran": "${input.modelPembelajaran || 'Project-Based Learning'}",
    "alokasiWaktuTotal": "${mapping.timeAllocationPerMeeting.totalJP} JP",
    "jumlahPertemuan": ${mapping.timeAllocationPerMeeting.jumlahPertemuan},
    "karakteristikKelas": "${input.karakteristikKelas || 'Heterogen'}",
    "saranaPrasarana": "Laptop, Proyektor, LKS, Koneksi Internet"
  },
  "pembuktianKBC": {
    "pancaCintaFocus": ["Cinta Ilmu", "Cinta Diri dan Sesama Manusia"],
    "ppraValuesFocus": ["Tawasut (Aturan Pertengahan)", "Tawazun (Keseimbangan)"],
    "catatanKBC": "${input.catatanKhusus || 'Penanaman Panca Cinta'}"
  },
  "capaianDanTujuan": {
    "rasional": "...",
    "cpElemen": "...",
    "tujuanPembelajaran": [
      { "kodeTP": "TP.7.1", "rumusanTP": "..." }
    ]
  },
  "pertemuanList": [
    {
      "pertemuanKe": 1,
      "alokasiJP": ${mapping.timeAllocationPerMeeting.jpPerPertemuan},
      "topik": "...",
      "tujuanPertemuan": "...",
      "pemahamanBermakna": "...",
      "pertanyaanPemantik": ["..."],
      "kegiatanPendahuluan": "...",
      "kegiatanInti": "...",
      "kegiatanPenutup": "...",
      "rencanaAsesmenFormatif": "..."
    }
  ],
  "asesmenDanRubrik": {
    "asesmenDiagnostik": "...",
    "asesmenFormatif": "...",
    "asesmenSumatif": "...",
    "rubrikPenilaian": "..."
  },
  "diferensiasiDanPengayaan": {
    "pembelajaranDiferensiasi": "...",
    "remedial": "...",
    "pengayaan": "...",
    "refleksiGuruDanSiswa": "..."
  }
}`;

      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsedData = JSON.parse(text);

      const validation = schemaValidator.validateModulAjarData(
        parsedData,
        mapping.timeAllocationPerMeeting.jumlahPertemuan
      );

      if (!validation.valid) {
        throw new Error(`AI_SCHEMA_INVALID: ${validation.errors.join('; ')}`);
      }

      return {
        content: parsedData as ModulAjarKbcData,
        source: 'gemini_ai',
        status: 'completed',
        changelog: 'Digenerate oleh Gemini AI (Kurikulum Berbasis Cinta)',
      };
    } catch (err: any) {
      console.warn('Gemini AI Generation failed/invalid, fallback to deterministic engine:', err.message);
      const fallbackData = this.generateDeterministicModulAjar(mapping, input);
      return {
        content: fallbackData,
        source: 'algorithmic_engine',
        status: 'draft',
        changelog: `Fallback Engine: ${err.message || 'Error AI'}`,
      };
    }
  }

  /**
   * Generates LKPD using Gemini AI with fallback.
   */
  async generateLkpd(
    mapping: AcademicMappingResult,
    input: {
      mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
      materiPokok: string;
      sourceModule?: ModulAjarKbcRecord | null;
    }
  ): Promise<GenerationEngineResult<LkpdData>> {
    const aiClient = this.getAiClient();

    if (!aiClient) {
      const fallbackData = this.generateDeterministicLkpd(mapping, input);
      return {
        content: fallbackData,
        source: 'algorithmic_engine',
        status: 'draft',
        changelog: 'Digenerate oleh Educational Algorithm Engine (Tanpa GEMINI_API_KEY)',
      };
    }

    try {
      const modelName = this.getModelName();
      const systemInstruction = `Anda adalah pakar pengembang Lembar Kerja Peserta Didik (LKPD) Kurikulum Merdeka Kemenag RI.
Tugas Anda adalah menghasilkan LKPD interaktif dan kontekstual dalam format JSON murni.
Keluarkan HANYA JSON valid.`;

      const prompt = `Susun LKPD untuk:
Mata Pelajaran: ${mapping.masterInput.mataPelajaran} (${mapping.masterInput.fase} / ${mapping.masterInput.kelas})
Materi Pokok: ${input.materiPokok}
Mode: ${input.mode}
TP Acuan: ${JSON.stringify(mapping.matchedTpItems.map((t) => `${t.kodeTP}: ${t.rumusanTP}`))}

Format JSON wajib:
{
  "identitas": {
    "satuanPendidikan": "${mapping.masterInput.namaMadrasah}",
    "mataPelajaran": "${mapping.masterInput.mataPelajaran}",
    "faseKelas": "${mapping.masterInput.fase} / ${mapping.masterInput.kelas}",
    "materiPokok": "${input.materiPokok}",
    "penyusun": "${mapping.masterInput.namaGuru}"
  },
  "mode": "${input.mode}",
  "materiPokok": "${input.materiPokok}",
  "tujuanPembelajaran": [ ${JSON.stringify(mapping.matchedTpItems.map((t) => `${t.kodeTP}: ${t.rumusanTP}`))} ],
  "petunjukPenggunaan": ["Bacalah dengan cermat", "Diskusikan dalam kelompok"],
  "alatDanBahan": ["LKPD", "Alat Tulis", "Laptop"],
  "ringkasanMateri": "...",
  "stimulusPermasalahan": "...",
  "aktivitasLangkahKerja": [
    {
      "langkahKe": 1,
      "instruksi": "...",
      "ruangJawaban": "..."
    }
  ],
  "pertanyaanDanTugas": [
    {
      "nomor": 1,
      "soal": "...",
      "bobot": 50
    }
  ],
  "refleksiSiswa": "...",
  "rubrikPenilaian": "...",
  "referensi": ["Buku Teks Kurikulum Merdeka"]
}`;

      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      const parsedData = JSON.parse(text);

      const validation = schemaValidator.validateLkpdData(parsedData);
      if (!validation.valid) {
        throw new Error(`AI_SCHEMA_INVALID: ${validation.errors.join('; ')}`);
      }

      return {
        content: parsedData as LkpdData,
        source: 'gemini_ai',
        status: 'completed',
        changelog: 'Digenerate oleh Gemini AI LKPD Engine',
      };
    } catch (err: any) {
      console.warn('Gemini AI LKPD Generation failed/invalid, fallback to deterministic engine:', err.message);
      const fallbackData = this.generateDeterministicLkpd(mapping, input);
      return {
        content: fallbackData,
        source: 'algorithmic_engine',
        status: 'draft',
        changelog: `Fallback Engine: ${err.message || 'Error AI'}`,
      };
    }
  }
}

export const modulAjarAiService = new ModulAjarAiService();
