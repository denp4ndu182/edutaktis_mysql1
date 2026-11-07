import React, { useState } from 'react';
import {
  X,
  FileCheck2,
  Sparkles,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Clock,
  HelpCircle,
} from 'lucide-react';
import {
  Project,
  LkpdRecord,
  ModulAjarKbcRecord,
  TujuanPembelajaranItem,
  TpData,
} from '../types';
import { generateLkpdApi, syncProjectCollectionToLocal } from '../services/modulAjarClient';

interface LkpdGeneratorModalProps {
  project: Project;
  activeInstitutionId?: string;
  onClose: () => void;
  onSuccess: (record: LkpdRecord, updatedProject: Project) => void;
}

export const LkpdGeneratorModal: React.FC<LkpdGeneratorModalProps> = ({
  project,
  activeInstitutionId,
  onClose,
  onSuccess,
}) => {
  const savedModulAjarList: ModulAjarKbcRecord[] =
    project.collections?.modulAjar || [];

  const docs = project.documents || {};
  const tpRecord = docs.TP;
  const tpContent = tpRecord?.content as TpData | null;
  const listTP: TujuanPembelajaranItem[] = tpContent?.listTP || [];

  // Form State
  const [mode, setMode] = useState<'FROM_MODULE' | 'FROM_ACADEMIC_DATA'>(
    savedModulAjarList.length > 0 ? 'FROM_MODULE' : 'FROM_ACADEMIC_DATA'
  );

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    savedModulAjarList[0]?.id || ''
  );
  const [materiPokok, setMateriPokok] = useState<string>(
    project.masterInput.materiPokok || 'Algoritma Pemrograman'
  );
  const [pertemuanNomor, setPertemuanNomor] = useState<number>(1);
  const [tingkatKesulitan, setTingkatKesulitan] = useState<'MUDAH' | 'SEDANG' | 'TINGGI'>('SEDANG');
  const [bentukKerja, setBentukKerja] = useState<'KELOMPOK' | 'INDIVIDU'>('KELOMPOK');
  const [fokusAktivitas, setFokusAktivitas] = useState<string>(
    'Penyelesaian studi kasus kontekstual dan pengerjaan soal latihan berjenjang'
  );
  const [selectedTpCodes, setSelectedTpCodes] = useState<string[]>(
    listTP.map((t) => t.kodeTP)
  );

  const [step, setStep] = useState<'form' | 'summary' | 'generating' | 'error'>('form');
  const [loadingMsg, setLoadingMsg] = useState<string>('Menyiapkan data...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeModule = savedModulAjarList.find((m) => m.id === selectedModuleId);

  const handleToggleTp = (kodeTP: string) => {
    if (selectedTpCodes.includes(kodeTP)) {
      setSelectedTpCodes(selectedTpCodes.filter((c) => c !== kodeTP));
    } else {
      setSelectedTpCodes([...selectedTpCodes, kodeTP]);
    }
  };

  const handleGenerate = async () => {
    if (mode === 'FROM_MODULE' && !selectedModuleId) {
      setErrorMessage('Pilihlah salah satu Modul Ajar acuan.');
      return;
    }

    const topic = mode === 'FROM_MODULE' && activeModule
      ? activeModule.teacherInput.materiPokok
      : materiPokok;

    if (!topic.trim()) {
      setErrorMessage('Materi pokok wajib diisi.');
      return;
    }

    setStep('generating');
    setLoadingMsg('Menyusun Lembar Kerja Peserta Didik (LKPD)...');

    setTimeout(async () => {
      setLoadingMsg('Membuat instruksi kerja, soal latihan, & rubrik penilaian...');
      const response = await generateLkpdApi(
        project.id,
        {
          mode,
          sourceModuleId: mode === 'FROM_MODULE' ? selectedModuleId : undefined,
          materiPokok: topic.trim(),
          teacherInput: {
            materiPokok: topic.trim(),
            selectedTpCodes,
            catatanKhusus: `Tingkat Kesulitan: ${tingkatKesulitan}, Bentuk Kerja: ${bentukKerja}, Fokus: ${fokusAktivitas}`,
          },
        },
        activeInstitutionId,
        project.updatedAt
      );

      if (response.success && response.data) {
        const updatedProj = syncProjectCollectionToLocal(project, response.data, 'lkpd');
        onSuccess(response.data, updatedProj);
      } else {
        setStep('error');
        setErrorMessage(response.error || 'Gagal memproses generasi LKPD.');
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl glass-surface rounded-3xl shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[#075080] to-[#087FC1] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <FileCheck2 className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">Generator LKPD Interaktif</h2>
              <p className="text-[11px] text-cyan-100 font-medium">Lembar Kerja Peserta Didik KBC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-[#173B57]">
          {/* ERROR STEP */}
          {step === 'error' && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-rose-900 uppercase">Gagal Membuat LKPD</h3>
                <p className="text-xs text-rose-800">{errorMessage}</p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setStep('form')}
                  className="px-5 py-2.5 text-xs font-bold text-[#173B57] bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Kembali
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

          {/* GENERATING STEP */}
          {step === 'generating' && (
            <div className="py-16 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-100 border-t-[#087FC1] animate-spin" />
                <Sparkles className="w-8 h-8 text-[#087FC1] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-[#173B57] uppercase tracking-wider">Menyusun LKPD Interaktif</h3>
                <p className="text-xs text-[#64798B] font-medium animate-pulse">{loadingMsg}</p>
              </div>
            </div>
          )}

          {/* FORM STEP */}
          {step === 'form' && (
            <>
              {/* MODE SELECTOR */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                  Pilih Mode Sumber Generasi LKPD
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('FROM_MODULE')}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      mode === 'FROM_MODULE'
                        ? 'bg-[#075080] text-white border-[#075080] shadow-md'
                        : 'bg-white border-slate-200 text-[#64798B] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className={`w-4 h-4 ${mode === 'FROM_MODULE' ? 'text-cyan-200' : 'text-slate-400'}`} />
                      <span className="font-black text-xs">MODE 1 — Dari Modul Ajar</span>
                    </div>
                    <p className={`text-[10px] ${mode === 'FROM_MODULE' ? 'text-cyan-100' : 'text-slate-500'}`}>
                      Mengekstrak dari Modul Ajar KBC yang tersimpan pada proyek.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('FROM_ACADEMIC_DATA')}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      mode === 'FROM_ACADEMIC_DATA'
                        ? 'bg-[#075080] text-white border-[#075080] shadow-md'
                        : 'bg-white border-slate-200 text-[#64798B] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className={`w-4 h-4 ${mode === 'FROM_ACADEMIC_DATA' ? 'text-cyan-200' : 'text-slate-400'}`} />
                      <span className="font-black text-xs">MODE 2 — Dari Data Akademik</span>
                    </div>
                    <p className={`text-[10px] ${mode === 'FROM_ACADEMIC_DATA' ? 'text-cyan-100' : 'text-slate-500'}`}>
                      Langsung dari rumusan TP & ACP tanpa perlu Modul Ajar.
                    </p>
                  </button>
                </div>
              </div>

              {/* MODE 1: FROM MODULE FIELDS */}
              {mode === 'FROM_MODULE' && (
                <div className="space-y-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-inner">
                  {savedModulAjarList.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                      Belum ada Modul Ajar KBC yang tersimpan. Silakan gunakan <strong>Mode 2</strong> atau buat Modul Ajar terlebih dahulu.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                        Pilih Modul Ajar Acuan
                      </label>
                      <select
                        value={selectedModuleId}
                        onChange={(e) => setSelectedModuleId(e.target.value)}
                        className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl font-bold focus:outline-none focus:border-[#087FC1] text-[#173B57]"
                      >
                        {savedModulAjarList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} ({m.teacherInput.materiPokok}) - v{m.version}
                          </option>
                        ))}
                      </select>

                      {activeModule && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                          <p className="font-bold text-[#075080]">
                            Ringkasan Modul: {activeModule.teacherInput.materiPokok}
                          </p>
                          <p className="text-[10px] text-[#64798B] font-medium">
                            Model: {activeModule.teacherInput.modelPembelajaran} | Alokasi: {activeModule.teacherInput.alokasiWaktu} JP
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                      Target Pertemuan
                    </label>
                    <select
                      value={pertemuanNomor}
                      onChange={(e) => setPertemuanNomor(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl font-bold text-[#173B57]"
                    >
                      <option value={1}>Pertemuan 1</option>
                      <option value={2}>Pertemuan 2</option>
                      <option value={3}>Pertemuan 3</option>
                    </select>
                  </div>
                </div>
              )}

              {/* MODE 2: FROM ACADEMIC DATA FIELDS */}
              {mode === 'FROM_ACADEMIC_DATA' && (
                <div className="space-y-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-inner">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                      Materi Pokok LKPD <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={materiPokok}
                      onChange={(e) => setMateriPokok(e.target.value)}
                      placeholder="Contoh: Algoritma Pencarian dan Pengurutan"
                      className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl text-[#173B57] font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                      Pilih Tujuan Pembelajaran Acuan
                    </label>
                    <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-white rounded-2xl border border-slate-200 text-xs shadow-inner">
                      {listTP.map((tp) => (
                        <label key={tp.kodeTP} className="flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedTpCodes.includes(tp.kodeTP)}
                            onChange={() => handleToggleTp(tp.kodeTP)}
                            className="mt-0.5 text-[#087FC1] rounded w-4 h-4"
                          />
                          <span className="font-medium text-[#173B57]">
                            <strong className="text-[#075080]">{tp.kodeTP}</strong>: {tp.rumusanTP}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* COMMON OPTIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={tingkatKesulitan}
                    onChange={(e) => setTingkatKesulitan(e.target.value as any)}
                    className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl font-bold text-[#173B57]"
                  >
                    <option value="MUDAH">Mudah (Dasar/Pemula)</option>
                    <option value="SEDANG">Sedang (Standar Menengah)</option>
                    <option value="TINGGI">Tinggi (HOTS / Tantangan)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                    Bentuk Pengerjaan
                  </label>
                  <select
                    value={bentukKerja}
                    onChange={(e) => setBentukKerja(e.target.value as any)}
                    className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl font-bold text-[#173B57]"
                  >
                    <option value="KELOMPOK">Kelompok (Kolaboratif)</option>
                    <option value="INDIVIDU">Individu (Mandiri)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
                  Fokus Instruksi Aktivitas
                </label>
                <textarea
                  rows={2}
                  value={fokusAktivitas}
                  onChange={(e) => setFokusAktivitas(e.target.value)}
                  placeholder="Catatan fokus penugasan..."
                  className="w-full p-4 text-xs bg-white border border-slate-300 rounded-2xl text-[#173B57] font-medium"
                />
              </div>
            </>
          )}

          {/* SUMMARY STEP */}
          {step === 'summary' && (
            <div className="space-y-4">
              <div className="p-5 bg-cyan-50 border border-cyan-100 rounded-2xl text-xs space-y-2">
                <h3 className="font-black text-[#075080] uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-cyan-600" />
                  Konfirmasi Pembuatan LKPD
                </h3>
                <p className="text-[#075080] font-medium">Periksa kembali parameter LKPD sebelum diproses oleh AI.</p>
              </div>
              
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs text-xs space-y-3 font-medium text-[#173B57]">
                <p><strong>Mode:</strong> {mode === 'FROM_MODULE' ? 'Dari Modul Ajar' : 'Dari Data Akademik'}</p>
                <p><strong>Materi Pokok:</strong> {mode === 'FROM_MODULE' && activeModule ? activeModule.teacherInput.materiPokok : materiPokok}</p>
                <p><strong>Tingkat Kesulitan:</strong> {tingkatKesulitan} | <strong>Bentuk Kerja:</strong> {bentukKerja}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
                onClick={() => setStep('summary')}
                className="px-6 py-3 text-xs font-black text-white bg-[#1A3A5C] hover:bg-[#087FC1] rounded-2xl transition-all shadow-md flex items-center gap-2"
              >
                <span>RINGKASAN</span>
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
                <span>BUAT LKPD INTERAKTIF</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
