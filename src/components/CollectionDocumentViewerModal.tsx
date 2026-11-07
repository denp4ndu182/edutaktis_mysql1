import React from 'react';
import { X, Printer, Edit3, BookOpen, FileCheck2, Sparkles, CheckCircle2, Download } from 'lucide-react';
import { ModulAjarKbcRecord, LkpdRecord, MasterInputData } from '../types';
import { downloadModulAjarDocx, downloadLkpdDocx } from '../services/docxGenerator';

interface CollectionDocumentViewerModalProps {
  type: 'modulAjar' | 'lkpd';
  record: ModulAjarKbcRecord | LkpdRecord;
  masterInput: MasterInputData;
  onClose: () => void;
  onEdit: () => void;
}

export const CollectionDocumentViewerModal: React.FC<CollectionDocumentViewerModalProps> = ({
  type,
  record,
  masterInput,
  onClose,
  onEdit,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = async () => {
    try {
      if (type === 'modulAjar') {
        await downloadModulAjarDocx(masterInput, record as ModulAjarKbcRecord);
      } else {
        await downloadLkpdDocx(masterInput, record as LkpdRecord);
      }
    } catch (e) {
      console.error('Failed to download DOCX:', e);
      alert('Gagal mendownload file Word (.docx)');
    }
  };

  const isModulAjar = type === 'modulAjar';
  const modulContent = isModulAjar ? (record.content as any) : null;
  const lkpdContent = !isModulAjar ? (record.content as any) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl glass-surface rounded-3xl shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[#075080] to-[#087FC1] text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              {isModulAjar ? (
                <BookOpen className="w-5 h-5 text-cyan-200" />
              ) : (
                <FileCheck2 className="w-5 h-5 text-cyan-200" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black">{record.title}</h2>
              <p className="text-[11px] text-cyan-100 font-medium">
                {isModulAjar ? 'Modul Ajar KBC' : 'Lembar Kerja Peserta Didik'} | Versi {record.version}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDocx}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black flex items-center gap-2 transition-all shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>UNDUH DOCX</span>
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2.5 bg-[#1A3A5C] hover:bg-[#087FC1] text-white rounded-xl text-[11px] font-black flex items-center gap-2 transition-all shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>EDIT</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-black flex items-center gap-2 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>CETAK</span>
            </button>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable View Body */}
        <div className="p-8 overflow-y-auto flex-1 text-[#173B57] bg-white font-sans leading-relaxed text-xs">
          {/* Kop Madrasah */}
          <div className="text-center pb-3 border-b-2 border-double border-[#1A3A5C] mb-6 font-sans">
            <h3 className="text-xs font-bold uppercase text-slate-800">
              {masterInput.kemenagOrYayasan || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'}
            </h3>
            <h2 className="text-sm font-extrabold uppercase text-[#1A3A5C]">
              {masterInput.namaMadrasah || 'MADRASAH TSANAWIYAH'}
            </h2>
            <p className="text-[10px] text-slate-600 italic">
              {masterInput.alamatMadrasah || 'Alamat Madrasah'}
            </p>
          </div>

          {/* Title Header */}
          <div className="text-center my-4 font-sans space-y-1">
            <h1 className="text-base font-extrabold uppercase text-[#1A3A5C] tracking-wide">
              {isModulAjar ? 'MODUL AJAR KURIKULUM BERBASIS CINTA (KBC)' : 'LEMBAR KERJA PESERTA DIDIK (LKPD)'}
            </h1>
            <p className="text-xs font-bold text-slate-700">{record.title}</p>
          </div>

          {/* MODUL AJAR CONTENT */}
          {isModulAjar && modulContent && (
            <div className="space-y-6 font-sans">
              {/* Identitas Table */}
              {modulContent.identitas && (
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody>
                      {Object.entries(modulContent.identitas).map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-200">
                          <td className="p-2 font-bold bg-slate-50 w-1/3 capitalize border-r border-slate-200">
                            {k.replace(/([A-Z])/g, ' $1')}
                          </td>
                          <td className="p-2 text-slate-800">{String(v || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pembuktian KBC */}
              {modulContent.pembuktianKBC && (
                <div className="p-4 bg-cyan-50/60 rounded-xl border border-cyan-200 space-y-2">
                  <h3 className="font-bold text-[#1A3A5C] uppercase text-xs">
                    Penanaman Nilai KBC & PPRA (Profil Pelajar Rahmatan lil 'Alamin)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-cyan-900 block">Fokus Panca Cinta:</span>
                      <ul className="list-disc list-inside text-slate-700">
                        {modulContent.pembuktianKBC.pancaCintaFocus?.map((pc: string, idx: number) => (
                          <li key={idx}>{pc}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-cyan-900 block">Nilai PPRA:</span>
                      <ul className="list-disc list-inside text-slate-700">
                        {modulContent.pembuktianKBC.ppraValuesFocus?.map((p: string, idx: number) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Pertemuan List */}
              {Array.isArray(modulContent.pertemuanList) && (
                <div className="space-y-4">
                  <h3 className="font-bold text-[#1A3A5C] text-sm uppercase border-b pb-1">
                    Langkah & Skenario Kegiatan Pembelajaran
                  </h3>

                  {modulContent.pertemuanList.map((p: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-900">
                          Pertemuan ke-{p.pertemuanKe || idx + 1} ({p.alokasiJP || 2} JP)
                        </span>
                        <span className="text-xs text-cyan-800 font-semibold">{p.topik}</span>
                      </div>
                      <p><strong>Tujuan Pertemuan:</strong> {p.tujuanPertemuan}</p>
                      <p><strong>Pemahaman Bermakna:</strong> {p.pemahamanBermakna}</p>
                      <p><strong>Kegiatan Pendahuluan:</strong> {p.kegiatanPendahuluan}</p>
                      <p><strong>Kegiatan Inti KBC:</strong> {p.kegiatanInti}</p>
                      <p><strong>Kegiatan Penutup:</strong> {p.kegiatanPenutup}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LKPD CONTENT */}
          {!isModulAjar && lkpdContent && (
            <div className="space-y-6 font-sans">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p><strong>Materi Pokok:</strong> {lkpdContent.materiPokok}</p>
                <p><strong>Ringkasan Materi:</strong> {lkpdContent.ringkasanMateri}</p>
                <p><strong>Stimulus Permasalahan:</strong> {lkpdContent.stimulusPermasalahan}</p>
              </div>

              {/* Langkah Kerja */}
              {Array.isArray(lkpdContent.aktivitasLangkahKerja) && (
                <div className="space-y-3">
                  <h3 className="font-bold text-[#1A3A5C] text-sm uppercase border-b pb-1">
                    Aktivitas & Langkah Kerja
                  </h3>
                  {lkpdContent.aktivitasLangkahKerja.map((a: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <p className="font-bold text-slate-800">Langkah {a.langkahKe || idx + 1}: {a.instruksi}</p>
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded text-slate-400 italic">
                        {a.ruangJawaban || 'Ruang Lembar Jawaban Peserta Didik'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pertanyaan & Tugas */}
              {Array.isArray(lkpdContent.pertanyaanDanTugas) && (
                <div className="space-y-3">
                  <h3 className="font-bold text-[#1A3A5C] text-sm uppercase border-b pb-1">
                    Pertanyaan & Soal Latihan
                  </h3>
                  {lkpdContent.pertanyaanDanTugas.map((q: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900">{q.nomor || idx + 1}. {q.soal}</p>
                      </div>
                      <span className="font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded text-[10px]">
                        Bobot: {q.bobot || 20}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Signature */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-slate-200 font-sans">
            <div>
              <p className="text-slate-600">Mengetahui,</p>
              <p className="font-bold text-slate-900">Kepala Madrasah,</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 underline">{masterInput.namaKepala}</p>
              <p className="text-slate-600">NIP. {masterInput.nipKepala || '-'}</p>
            </div>
            <div>
              <p className="text-slate-600">{masterInput.kotaTandaTangan || 'Kota'}, {masterInput.tanggalTandaTangan || '2024'}</p>
              <p className="font-bold text-slate-900">Guru Mata Pelajaran,</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 underline">{masterInput.namaGuru}</p>
              <p className="text-slate-600">NIP. {masterInput.nipGuru || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
