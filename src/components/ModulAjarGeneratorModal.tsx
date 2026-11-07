import React, { useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  FileText,
  UserCheck,
  Building2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react';
import {
  Project,
  TeacherGenerationInput,
  TujuanPembelajaranItem,
  ModulAjarKbcRecord,
  AcpData,
  TpData,
  AtpData,
} from '../types';
import { generateModulAjarKbcApi, syncProjectCollectionToLocal } from '../services/modulAjarClient';

interface ModulAjarGeneratorModalProps {
  project: Project;
  activeInstitutionId?: string;
  onClose: () => void;
  onSuccess: (record: ModulAjarKbcRecord, updatedProject: Project) => void;
}

const DEFAULT_GAYA_MENGAJAR_OPTIONS = [
  'Ceramah interaktif',
  'Demonstrasi',
  'Diskusi kelompok',
  'Praktik langsung',
  'Kolaboratif',
  'Project Based Learning',
  'Problem Based Learning',
  'Inquiry Learning',
  'Discovery Learning',
  'Gamifikasi',
  'Pembelajaran berbasis teknologi dan AI',
  'Pembelajaran berdiferensiasi',
];

const MODEL_PEMBELAJARAN_OPTIONS = [
  'Project-Based Learning (PjBL)',
  'Problem-Based Learning (PBL)',
  'Inquiry-Based Learning',
  'Discovery Learning',
  'Cooperative Learning (STAD/Jigsaw)',
  'Direct Instruction (Pengajaran Langsung)',
  'Contextual Teaching and Learning (CTL)',
];

export const ModulAjarGeneratorModal: React.FC<ModulAjarGeneratorModalProps> = ({
  project,
  activeInstitutionId,
  onClose,
  onSuccess,
}) => {
  const docs = project.documents || {};
  const acpRecord = docs.ACP;
  const tpRecord = docs.TP;
  const atpRecord = docs.ATP;

  const acpContent = acpRecord?.content as AcpData | null;
  const tpContent = tpRecord?.content as TpData | null;
  const atpContent = atpRecord?.content as AtpData | null;

  const hasAcp = acpRecord && acpContent && (acpRecord.status === 'completed' || acpContent.analisisElemen);
  const hasTp = tpRecord && tpContent && (tpRecord.status === 'completed' || tpContent.listTP);
  const listTP: TujuanPembelajaranItem[] = tpContent?.listTP || [];

  const [step, setStep] = useState<'form' | 'summary' | 'generating' | 'error'>('form');
  const [materiPokok, setMateriPokok] = useState<string>(project.masterInput.materiPokok || '');
  const [selectedTpCodes, setSelectedTpCodes] = useState<string[]>(() => listTP.map((t) => t.kodeTP));
  const [selectedGaya, setSelectedGaya] = useState<string[]>(['Diskusi kelompok', 'Project Based Learning']);
  const [customGaya, setCustomGaya] = useState<string>('');
  const [modelPembelajaran, setModelPembelajaran] = useState<string>('Project-Based Learning (PjBL)');
  const [alokasiWaktu, setAlokasiWaktu] = useState<number>(project.masterInput.alokasiWaktuTotal || 4);
  const [jumlahPertemuan, setJumlahPertemuan] = useState<number>(2);
  const [karakteristikKelas, setKarakteristikKelas] = useState<string>(
    project.masterInput.karakteristikPesertaDidik || 'Kemampuan heterogen dengan minat beragam'
  );
  const [catatanKhusus, setCatatanKhusus] = useState<string>(
    'Penekanan pada Panca Cinta (Cinta Ilmu & Cinta Diri/Sesama) dan profil PPRA Tawasut.'
  );

  const [loadingMsg, setLoadingMsg] = useState<string>('Menyiapkan prapemrosesan data...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleToggleTp = (kodeTP: string) => {
    if (selectedTpCodes.includes(kodeTP)) {
      setSelectedTpCodes(selectedTpCodes.filter((c) => c !== kodeTP));
    } else {
      setSelectedTpCodes([...selectedTpCodes, kodeTP]);
    }
  };

  const handleToggleGaya = (gaya: string) => {
    if (selectedGaya.includes(gaya)) {
      setSelectedGaya(selectedGaya.filter((g) => g !== gaya));
    } else {
      setSelectedGaya([...selectedGaya, gaya]);
    }
  };

  const handleGenerate = async () => {
    if (!materiPokok.trim()) {
      setErrorMessage('Materi pokok wajib diisi sebelum membuat Modul Ajar.');
      return;
    }
    if (selectedTpCodes.length === 0) {
      setErrorMessage('Pilihlah sekurang-kurangnya 1 Tujuan Pembelajaran (TP).');
      return;
    }

    setStep('generating');
    setLoadingMsg('Menghubungi Engine AI EduTaktis KBC & memverifikasi data akademik...');

    const combinedGaya = [...selectedGaya];
    if (customGaya.trim()) {
      combinedGaya.push(customGaya.trim());
    }

    const inputData: TeacherGenerationInput = {
      materiPokok: materiPokok.trim(),
      gayaMengajar: combinedGaya.join(', '),
      modelPembelajaran,
      alokasiWaktu,
      jumlahPertemuan,
      karakteristikKelas,
      catatanKhusus,
      selectedTpCodes,
    };

    setTimeout(async () => {
      setLoadingMsg('Memproses sintaks KBC Deep Learning (Mindful, Meaningful, Joyful)...');
      
      const response = await generateModulAjarKbcApi(
        project.id,
        inputData,
        activeInstitutionId,
        project.updatedAt
      );

      if (response.success && response.data) {
        const updatedProj = syncProjectCollectionToLocal(project, response.data, 'modulAjar');
        onSuccess(response.data, updatedProj);
      } else {
        setStep('error');
        setErrorMessage(response.error || 'Gagal memproses generasi Modul Ajar KBC.');
        setErrorCode(response.code || 'UNKNOWN_ERROR');
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-surface rounded-3xl shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[#075080] to-[#087FC1] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Sparkles className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">Generator Modul Ajar KBC</h2>
              <p className="text-[11px] text-cyan-100 font-medium">
                Kurikulum Berbasis Cinta (KBC) & Merdeka Kemenag RI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-[#173B57]">
          {/* STEP: ERROR */}
          {step === 'error' && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-rose-900 uppercase">
                  {errorCode === 'OCC_CONFLICT' ? 'Konflik Konkurensi Data' : 'Gagal Menyusun Modul Ajar'}
                </h3>
                <p className="text-xs text-rose-800 max-w-md mx-auto">{errorMessage}</p>
              </div>

              {errorCode === 'PREREQUISITE_FAILED' && (
                <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs text-slate-700 max-w-lg mx-auto text-left space-y-1.5 shadow-2xs">
                  <p className="font-bold text-slate-900">Petunjuk Penyelesaian:</p>
                  <p>1. Pastikan Anda telah menyusun dokumen <strong>Analisis Capaian Pembelajaran (ACP)</strong>.</p>
                  <p>2. Pastikan Anda telah menyusun dokumen <strong>Tujuan Pembelajaran (TP)</strong> pada proyek ini.</p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setStep('form')}
                  className="px-5 py-2.5 text-xs font-bold text-[#173B57] bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Kembali ke Form
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#075080] rounded-xl hover:bg-[#087FC1] transition-colors cursor-pointer shadow-md"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {/* STEP: GENERATING */}
          {step === 'generating' && (
            <div className="py-16 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-100 border-t-[#087FC1] animate-spin" />
                <Sparkles className="w-8 h-8 text-[#087FC1] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-[#173B57] uppercase tracking-wider">
                  Proses Penyusunan Modul Ajar KBC
                </h3>
                <p className="text-xs text-[#64798B] font-medium animate-pulse">{loadingMsg}</p>
              </div>
              <div className="max-w-xs mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-[#173B57] text-left space-y-2 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Mengekstrak sumber data resmi ACP & TP</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Mengintegrasikan Panca Cinta & PPRA</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#087FC1] animate-spin shrink-0" />
                  <span className="font-medium">Menyusun aktivitas KBC Deep Learning</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP: FORM */}
          {step === 'form' && (
            <>
              {/* SECTION 1: INFORMASI SUMBER AKADEMIK */}
              <div className="p-5 bg-white/60 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[#1A3A5C] uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4.5 h-4.5 text-[#087FC1]" />
                    1. Sumber Akademik Proyek Aktif
                  </span>
                  <span className="text-[10px] font-bold text-[#64798B] bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Otomatis dari Database
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Guru / Penyusun</p>
                    <p className="font-bold text-[#173B57] truncate" title={project.masterInput.namaGuru || 'Guru Pengampu'}>
                      {project.masterInput.namaGuru || 'Guru Pengampu'}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Mata Pelajaran</p>
                    <p className="font-bold text-[#173B57] truncate" title={project.masterInput.mataPelajaran}>
                      {project.masterInput.mataPelajaran}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Fase / Kelas</p>
                    <p className="font-bold text-[#173B57] truncate">
                      {project.masterInput.fase} / {project.masterInput.kelas}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <p className="text-[10px] text-slate-500 font-semibold mb-0.5">Madrasah</p>
                    <p className="font-bold text-[#173B57] truncate" title={project.masterInput.namaMadrasah}>
                      {project.masterInput.namaMadrasah}
                    </p>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${
                      hasAcp ? 'bg-[#DDF7EC] text-[#159B79] border-[#DDF7EC]' : 'bg-[#FDE8E8] text-[#DC5656] border-[#FDE8E8]'
                    }`}
                  >
                    {hasAcp ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    ACP: {hasAcp ? 'Tersedia' : 'Belum Dibuat'}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${
                      hasTp ? 'bg-[#DDF7EC] text-[#159B79] border-[#DDF7EC]' : 'bg-[#FDE8E8] text-[#DC5656] border-[#FDE8E8]'
                    }`}
                  >
                    {hasTp ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    TP: {hasTp ? `${listTP.length} Terdaftar` : 'Belum Dibuat'}
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-[#EEF3F7] text-[#536B80] border border-[#EEF3F7]">
                    <Info className="w-3.5 h-3.5 text-[#087FC1]" />
                    ATP: {atpContent ? 'Tersedia' : 'Opsional'}
                  </span>
                </div>
              </div>

              {/* SECTION 2: MATERI POKOK */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                  2. Materi Pokok Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={materiPokok}
                  onChange={(e) => setMateriPokok(e.target.value)}
                  placeholder="Contoh: Berpikir Komputasional dan Algoritma Pemrograman"
                  className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] focus:ring-1 focus:ring-[#087FC1] text-[#173B57] font-semibold"
                />
                <p className="text-[11px] text-[#64798B] font-medium">
                  Materi pokok digunakan sebagai acuan pemetaan terhadap elemen ACP dan rumusan TP.
                </p>
              </div>

              {/* SECTION 3: PEMILIHAN TP DAN ATP */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                    3. Pilih Tujuan Pembelajaran (TP) Acuan <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-[#075080] font-bold bg-cyan-50 px-3 py-0.5 rounded-full">
                    {selectedTpCodes.length} / {listTP.length} Dipilih
                  </span>
                </div>

                {listTP.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                    ⚠️ Dokumen TP belum disusun pada proyek ini. Silakan buat dokumen TP terlebih dahulu melalui menu Generator TP.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-inner">
                    {listTP.map((tpItem) => {
                      const isChecked = selectedTpCodes.includes(tpItem.kodeTP);
                      return (
                        <label
                          key={tpItem.kodeTP}
                          className={`flex items-start gap-3.5 p-3 rounded-xl cursor-pointer transition-all border text-xs ${
                            isChecked ? 'bg-cyan-50 border-cyan-200 text-[#173B57]' : 'bg-slate-50/50 border-slate-200 text-[#64798B] hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTp(tpItem.kodeTP)}
                            className="mt-0.5 rounded text-[#087FC1] focus:ring-[#087FC1] w-4 h-4"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-black text-[#087FC1] text-[10px] px-2 py-0.5 bg-white border border-cyan-100 rounded-lg">
                                {tpItem.kodeTP}
                              </span>
                              <span className="text-[11px] font-bold text-[#173B57]">
                                {tpItem.elemen || 'Elemen Mapel'}
                              </span>
                            </div>
                            <p className="text-xs font-medium">{tpItem.rumusanTP}</p>
                            {tpItem.materiPokok && (
                              <p className="text-[10px] text-[#64798B] italic">
                                Materi: {tpItem.materiPokok}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 4: GAYA MENGAJAR */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                  4. Gaya Mengajar Pendekatan Guru (Multi-Select)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DEFAULT_GAYA_MENGAJAR_OPTIONS.map((gaya) => {
                    const active = selectedGaya.includes(gaya);
                    return (
                      <button
                        type="button"
                        key={gaya}
                        onClick={() => handleToggleGaya(gaya)}
                        className={`px-4 py-2.5 text-xs rounded-xl border text-left font-bold transition-all ${
                          active
                            ? 'bg-[#075080] text-white border-[#075080] shadow-sm'
                            : 'bg-white text-[#64798B] border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {gaya}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customGaya}
                  onChange={(e) => setCustomGaya(e.target.value)}
                  placeholder="Gaya mengajar lain (opsional)..."
                  className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                />
              </div>

              {/* SECTION 5: MODEL PEMBELAJARAN */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                  5. Model Pembelajaran Rekomendasi
                </label>
                <select
                  value={modelPembelajaran}
                  onChange={(e) => setModelPembelajaran(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-bold"
                >
                  {MODEL_PEMBELAJARAN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* SECTION 6: ALOKASI WAKTU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                    6A. Total Alokasi Waktu (JP)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={alokasiWaktu}
                    onChange={(e) => setAlokasiWaktu(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-black tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                    6B. Jumlah Pertemuan
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={jumlahPertemuan}
                    onChange={(e) => setJumlahPertemuan(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-black tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2 text-xs text-[#075080] bg-cyan-50 p-3 rounded-xl border border-cyan-100 flex items-center justify-between font-bold">
                  <span>Estimasi Pembagian Waktu:</span>
                  <span className="tabular-nums">
                    {jumlahPertemuan} Pertemuan @ {Math.max(1, Math.round(alokasiWaktu / jumlahPertemuan))} JP per Pertemuan
                  </span>
                </div>
              </div>

              {/* SECTION 7: KARAKTERISTIK KELAS */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                  7. Karakteristik Peserta Didik (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={karakteristikKelas}
                  onChange={(e) => setKarakteristikKelas(e.target.value)}
                  placeholder="Contoh: Kemampuan awal beragam, aktif dalam diskusi kelompok, memerlukan media visual..."
                  className="w-full p-4 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                />
              </div>

              {/* SECTION 8: CATATAN KHUSUS */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#173B57] uppercase tracking-wider block">
                  8. Catatan Khusus & Penekanan KBC (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={catatanKhusus}
                  onChange={(e) => setCatatanKhusus(e.target.value)}
                  placeholder="Contoh: Integrasi Panca Cinta (Cinta Ilmu & Cinta Diri), penguatan nilai PPRA Tawasut..."
                  className="w-full p-4 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                />
              </div>
            </>
          )}

          {/* STEP: SUMMARY CONFIRMATION */}
          {step === 'summary' && (
            <div className="space-y-4">
              <div className="p-5 bg-cyan-50 border border-cyan-100 rounded-2xl space-y-2.5">
                <h3 className="text-xs font-black text-[#075080] uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-cyan-600" />
                  Konfirmasi Ringkasan Sebelum Generasi
                </h3>
                <p className="text-xs text-[#075080] font-medium">
                  Periksa kembali parameter berikut sebelum menghubungi AI Engine EduTaktis KBC.
                </p>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs text-xs space-y-4">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Materi Pokok</span>
                    <span className="font-bold text-[#173B57]">{materiPokok}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Model Pembelajaran</span>
                    <span className="font-bold text-[#173B57]">{modelPembelajaran}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">TP Terpilih</span>
                    <span className="font-bold text-[#173B57]">{selectedTpCodes.length} TP</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Alokasi Waktu</span>
                    <span className="font-bold text-[#173B57] tabular-nums">{alokasiWaktu} JP ({jumlahPertemuan} Pertemuan)</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Gaya Mengajar</span>
                  <span className="font-medium text-[#173B57]">{selectedGaya.join(', ')} {customGaya ? `(${customGaya})` : ''}</span>
                </div>

                {catatanKhusus && (
                  <div className="border-t border-slate-100 pt-4 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Penekanan KBC & PPRA</span>
                    <span className="font-medium text-[#173B57]">{catatanKhusus}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 'form' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-[#173B57] transition-colors"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!materiPokok.trim()) {
                    alert('Materi pokok wajib diisi.');
                    return;
                  }
                  if (selectedTpCodes.length === 0) {
                    alert('Pilihlah sekurang-kurangnya 1 TP.');
                    return;
                  }
                  setStep('summary');
                }}
                className="px-6 py-3 text-xs font-black text-white bg-[#1A3A5C] hover:bg-[#087FC1] rounded-2xl transition-all shadow-md flex items-center gap-2"
              >
                <span>LANJUT KE RINGKASAN</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'summary' && (
            <>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-5 py-2.5 text-xs font-bold text-[#173B57] bg-white border border-slate-300 rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>KEMBALI EDIT</span>
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="px-7 py-3 text-xs font-black text-white bg-gradient-to-r from-[#1A3A5C] to-[#075080] hover:from-[#087FC1] hover:to-[#075080] rounded-2xl transition-all shadow-md flex items-center gap-2"
              >
                <Sparkles className="w-4.5 h-4.5 text-cyan-200" />
                <span>BUAT MODUL AJAR KBC</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
