import React, { useRef } from 'react';
import {
  Printer,
  Download,
  Edit3,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookOpen,
  Calendar,
  Layers,
  Award,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  DocumentType,
  MasterInputData,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProsemData,
  KktpData,
  DocumentRecord,
} from '../types';
import { downloadDocxDocument } from '../services/docxGenerator';

interface DocumentRendererProps {
  docType: DocumentType;
  record: DocumentRecord;
  masterInput: MasterInputData;
  onEdit: () => void;
  onRegenerate: () => void;
  isGenerating?: boolean;
}

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({
  docType,
  record,
  masterInput,
  onEdit,
  onRegenerate,
  isGenerating,
}) => {
  const [zoom, setZoom] = React.useState<number>(100);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = async () => {
    if (!record.content) return;
    try {
      await downloadDocxDocument(docType, masterInput, record.content);
    } catch (e) {
      console.error('Download DOCX failed:', e);
      alert('Gagal membuat dokumen Word (.docx)');
    }
  };

  if (!record.content) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <p className="text-sm font-semibold text-slate-600">Dokumen belum dibuat.</p>
        <p className="text-xs text-slate-400 mt-1">
          Klik tombol "Generate Dokumen AI" di atas untuk menyusun dokumen ini.
        </p>
      </div>
    );
  }

  // Kop Component
  const KopMadrasah = () => (
    <div className="text-center pb-3 border-b-2 border-double border-[#1A3A5C] mb-6">
      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
        {masterInput.kemenagOrYayasan || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'}
      </h3>
      <h2 className="text-sm sm:text-base font-extrabold uppercase text-[#1A3A5C] tracking-tight">
        {masterInput.namaMadrasah || 'MADRASAH TSANAWIYAH'}
      </h2>
      <p className="text-[10px] sm:text-xs text-slate-600 italic mt-0.5">
        {masterInput.alamatMadrasah || 'Alamat Madrasah'}
      </p>
    </div>
  );

  // Signature Block Component
  const SignatureBlock = () => (
    <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-200 text-xs">
      <div>
        <p className="text-slate-600">Mengetahui,</p>
        <p className="font-bold text-slate-900 mt-0.5">Kepala Madrasah,</p>
        <div className="h-16" />
        <p className="font-bold text-slate-900 underline">{masterInput.namaKepala || 'Kepala Madrasah'}</p>
        <p className="text-slate-600 text-[11px]">NIP. {masterInput.nipKepala || '-'}</p>
      </div>

      <div>
        <p className="text-slate-600">
          {masterInput.kotaTandaTangan || 'Yogyakarta'}, {masterInput.tanggalTandaTangan || '15 Juli 2024'}
        </p>
        <p className="font-bold text-slate-900 mt-0.5">Guru Mata Pelajaran,</p>
        <div className="h-16" />
        <p className="font-bold text-slate-900 underline">{masterInput.namaGuru || 'Guru Pengampu'}</p>
        <p className="text-slate-600 text-[11px]">NIP. {masterInput.nipGuru || '-'}</p>
      </div>
    </div>
  );

  // Identity Table Component
  const RenderIdentityTable = ({ identitas }: { identitas: Record<string, string> }) => (
    <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
      <table className="w-full text-xs text-left border-collapse">
        <tbody>
          {Object.entries(identitas).map(([k, v]) => (
            <tr key={k} className="border-b border-slate-200 last:border-b-0">
              <td className="w-1/3 bg-slate-50 px-3 py-1.5 font-bold text-slate-700 capitalize">
                {k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
              </td>
              <td className="px-3 py-1.5 text-slate-800 font-medium">: {v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Document Toolbar */}
      <div className="no-print glass-surface rounded-2xl border border-white/60 p-3 shadow-md flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-800 bg-cyan-50 px-3 py-1.5 rounded-full border border-cyan-100">
            {docType} v{record.version}
          </span>
          <span className="text-[10px] font-bold text-[#64798B] hidden sm:inline">
            Diperbarui: {new Date(record.updatedAt).toLocaleString('id-ID')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-white/50 rounded-xl p-1 text-[#173B57] border border-slate-200">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1.5 hover:bg-slate-200 rounded-lg cursor-pointer"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-black w-10 text-center tabular-nums">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1.5 hover:bg-slate-200 rounded-lg cursor-pointer"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onEdit}
            className="px-4 py-2 text-[11px] font-bold bg-white text-[#173B57] hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5" />
            EDIT
          </button>

          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-4 py-2 text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            REGENERATE
          </button>

          <button
            onClick={handleDownloadDocx}
            className="px-4 py-2 text-[11px] font-black text-white bg-[#1A3A5C] hover:bg-[#087FC1] rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            title="Unduh file Microsoft Word .docx"
          >
            <Download className="w-3.5 h-3.5 text-cyan-200" />
            WORD
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 text-[11px] font-black text-white bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#075080] rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            title="Cetak langsung atau simpan ke PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            CETAK
          </button>
        </div>
      </div>

      {/* Realistic A4 White Paper Container */}
      <div className="overflow-x-auto pb-8 flex justify-center bg-slate-200/80 p-4 sm:p-6 rounded-2xl">
        <div
          ref={printContainerRef}
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
          className={`print-container bg-white text-slate-900 shadow-xl border border-slate-300 transition-all font-sans p-8 sm:p-12 ${
            ['TP', 'ATP', 'PROTA', 'PROSEM', 'KKTP'].includes(docType)
              ? 'w-full max-w-[1100px] min-h-[780px]' // Landscape appearance
              : 'w-full max-w-[850px] min-h-[1100px]' // Portrait appearance
          }`}
        >
          {/* Top Kop Madrasah */}
          <KopMadrasah />

          {/* SPECIFIC DOCUMENT CONTENT RENDERERS */}

          {/* 1. ACP RENDERER */}
          {docType === 'ACP' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  ANALISIS CAPAIAN PEMBELAJARAN (ACP)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  KURIKULUM BERBASIS CINTA (KBC) & PROFIL PELAJAR RAHMATAN LIL 'ALAMIN
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as AcpData).identitas} />

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-1 text-[#1A3A5C]">
                  A. Rasional Mata Pelajaran
                </h4>
                <p className="text-slate-700 text-justify">{(record.content as AcpData).rasionalMapel}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-1 text-[#1A3A5C]">
                  B. Capaian Pembelajaran Umum
                </h4>
                <p className="text-slate-700 text-justify">{(record.content as AcpData).cpUmum}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  C. Analisis Elemen, Kompetensi, dan Materi Esensial
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">No</th>
                        <th className="p-2 border border-slate-300 w-36">Elemen CP</th>
                        <th className="p-2 border border-slate-300">Kalimat Capaian Pembelajaran</th>
                        <th className="p-2 border border-slate-300 w-44">Kompetensi yang Ditargetkan</th>
                        <th className="p-2 border border-slate-300 w-48">Materi & Kedalaman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as AcpData).analisisElemen.map((el, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-bold">{i + 1}</td>
                          <td className="p-2 border border-slate-300 font-bold text-slate-800">
                            {el.namaElemen} ({el.kodeElemen})
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-700">{el.kalimatCP}</td>
                          <td className="p-2 border border-slate-300">
                            <ul className="list-disc list-inside space-y-0.5">
                              {el.kompetensi.map((k, idx) => (
                                <li key={idx}>{k}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2 border border-slate-300">
                            <p className="font-semibold text-slate-800">Materi Esensial:</p>
                            <ul className="list-disc list-inside mb-1 text-[11px]">
                              {el.materiEsensial.map((m, idx) => (
                                <li key={idx}>{m}</li>
                              ))}
                            </ul>
                            <p className="text-[10px] text-slate-500 italic">{el.kedalamanKeluasan}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-1 text-[#1A3A5C]">
                  D. Integrasi Kurikulum Berbasis Cinta (KBC) dan PPRA
                </h4>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <p>
                    <strong className="text-teal-900">Penerapan Panca Cinta:</strong>{' '}
                    {(record.content as AcpData).integrasiKBCPPRA.kbcApplication}
                  </p>
                  <p>
                    <strong className="text-teal-900">Penanaman Nilai PPRA:</strong>{' '}
                    {(record.content as AcpData).integrasiKBCPPRA.ppraApplication}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-1 text-[#1A3A5C]">
                  E. Rekomendasi Pembelajaran dan Asesmen
                </h4>
                <p className="text-slate-700 mb-1">
                  <strong>Pembelajaran:</strong> {(record.content as AcpData).rekomendasiPembelajaran}
                </p>
                <p className="text-slate-700">
                  <strong>Asesmen:</strong> {(record.content as AcpData).rekomendasiAsesmen}
                </p>
              </div>

              <SignatureBlock />
            </div>
          )}

          {/* 2. TP RENDERER */}
          {docType === 'TP' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  TUJUAN PEMBELAJARAN (TP)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  TAHUN PELAJARAN {masterInput.tahunPelajaran} • {masterInput.mataPelajaran.toUpperCase()}
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as TpData).identitas} />

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  Daftar Rumusan Tujuan Pembelajaran (TP)
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">No</th>
                        <th className="p-2 border border-slate-300 text-center w-16">Kode</th>
                        <th className="p-2 border border-slate-300 w-36">Elemen CP</th>
                        <th className="p-2 border border-slate-300">Rumusan Tujuan Pembelajaran</th>
                        <th className="p-2 border border-slate-300 w-36">Materi Pokok</th>
                        <th className="p-2 border border-slate-300 w-36">Integrasi KBC & PPRA</th>
                        <th className="p-2 border border-slate-300 text-center w-12 font-bold">JP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as TpData).listTP.map((tp) => (
                        <tr key={tp.no} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-bold">{tp.no}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800 bg-teal-50/40">
                            {tp.kodeTP}
                          </td>
                          <td className="p-2 border border-slate-300 font-semibold">{tp.elemen}</td>
                          <td className="p-2 border border-slate-300 text-slate-800">{tp.rumusanTP}</td>
                          <td className="p-2 border border-slate-300">{tp.materiPokok}</td>
                          <td className="p-2 border border-slate-300 text-[11px]">
                            <span className="text-rose-700 font-semibold">{tp.integrasiPancaCinta}</span>
                            <br />
                            <span className="text-slate-600">PPRA: {tp.integrasiPPRA}</span>
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {tp.alokasiJP}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={6} className="p-2 border border-slate-300 text-right uppercase">
                          Total Alokasi Waktu Satu Tahun Pelajaran:
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-extrabold text-teal-800 text-sm">
                          {(record.content as TpData).totalJP} JP
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <SignatureBlock />
            </div>
          )}

          {/* 3. ATP RENDERER */}
          {docType === 'ATP' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  ALUR TUJUAN PEMBELAJARAN (ATP)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  ROADMAP ALUR BELAJAR BERKELANJUTAN BERBASIS KBC & PPRA
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as AtpData).identitas} />

              {/* Visual Roadmap Flow */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase text-[#1A3A5C]">
                  Diagram Visual Alur Pembelajaran Bertahap
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(record.content as AtpData).visualDiagram.map((v, i) => (
                    <div
                      key={i}
                      className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#1A3A5C] text-xs">{v.tahap}</span>
                        <span className="text-[10px] font-bold bg-white text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                          {v.semester}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{v.deskripsiAlur}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {v.tpCodes.map((code) => (
                          <span
                            key={code}
                            className="bg-[#1A3A5C] text-white text-[10px] font-bold px-1.5 py-0.5 rounded"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ATP Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  Tabel Alur Tujuan Pembelajaran
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-12">Alur</th>
                        <th className="p-2 border border-slate-300 text-center w-16">Kode</th>
                        <th className="p-2 border border-slate-300 w-24 text-center">Semester</th>
                        <th className="p-2 border border-slate-300 w-32">Elemen CP</th>
                        <th className="p-2 border border-slate-300">Rumusan Tujuan Pembelajaran</th>
                        <th className="p-2 border border-slate-300 w-36">Materi & Aspek</th>
                        <th className="p-2 border border-slate-300 w-36">Integrasi KBC & PPRA</th>
                        <th className="p-2 border border-slate-300 text-center w-10 font-bold">JP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as AtpData).listATP.map((item) => (
                        <tr key={item.no} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-teal-700">
                            Ke-{item.alurUrutan}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-800">
                            {item.kodeTP}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-medium">
                            {item.semester}
                          </td>
                          <td className="p-2 border border-slate-300">{item.elemen}</td>
                          <td className="p-2 border border-slate-300 text-slate-800">{item.rumusanTP}</td>
                          <td className="p-2 border border-slate-300">
                            <span className="font-semibold">{item.materiPokok}</span>
                            <br />
                            <span className="text-[10px] text-slate-500">[{item.aspekKompetensi}]</span>
                          </td>
                          <td className="p-2 border border-slate-300 text-[11px] text-slate-600">
                            {item.integrasiKbcPpra}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {item.alokasiJP}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <SignatureBlock />
            </div>
          )}

          {/* 4. PROTA RENDERER */}
          {docType === 'PROTA' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  PROGRAM TAHUNAN (PROTA)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  DISTRIBUSI ALOKASI WAKTU TAHUN PELAJARAN {masterInput.tahunPelajaran}
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as ProtaData).identitas} />

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  A. Distribusi Minggu Efektif Berdasarkan Kalender Pendidikan
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center">Semester</th>
                        <th className="p-2 border border-slate-300">Bulan</th>
                        <th className="p-2 border border-slate-300 text-center">Minggu Kalender</th>
                        <th className="p-2 border border-slate-300 text-center">Mgg Tdk Efektif</th>
                        <th className="p-2 border border-slate-300 text-center font-bold">Mgg Efektif</th>
                        <th className="p-2 border border-slate-300 text-center font-bold">Jam (JP)</th>
                        <th className="p-2 border border-slate-300">Keterangan Kegiatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as ProtaData).distribusiMinggu.semesterGanjil.bulanList.map((b) => (
                        <tr key={`g-${b.bulan}`} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-semibold">Ganjil</td>
                          <td className="p-2 border border-slate-300 font-bold">{b.bulan}</td>
                          <td className="p-2 border border-slate-300 text-center">{b.mingguKalender}</td>
                          <td className="p-2 border border-slate-300 text-center">{b.mingguTidakEfektif}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800 bg-teal-50/30">
                            {b.mingguEfektif}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {b.jp}
                          </td>
                          <td className="p-2 border border-slate-300 text-[11px] text-slate-600">
                            {b.keterangan}
                          </td>
                        </tr>
                      ))}
                      {(record.content as ProtaData).distribusiMinggu.semesterGenap.bulanList.map((b) => (
                        <tr key={`gn-${b.bulan}`} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-semibold">Genap</td>
                          <td className="p-2 border border-slate-300 font-bold">{b.bulan}</td>
                          <td className="p-2 border border-slate-300 text-center">{b.mingguKalender}</td>
                          <td className="p-2 border border-slate-300 text-center">{b.mingguTidakEfektif}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800 bg-teal-50/30">
                            {b.mingguEfektif}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {b.jp}
                          </td>
                          <td className="p-2 border border-slate-300 text-[11px] text-slate-600">
                            {b.keterangan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  B. Rencana Alokasi Program Tahunan (PROTA)
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">No</th>
                        <th className="p-2 border border-slate-300 text-center w-16">Sem.</th>
                        <th className="p-2 border border-slate-300 text-center w-16">Kode</th>
                        <th className="p-2 border border-slate-300">Tujuan Pembelajaran & Materi Pokok</th>
                        <th className="p-2 border border-slate-300 w-32">Elemen CP</th>
                        <th className="p-2 border border-slate-300 w-36">Integrasi KBC & PPRA</th>
                        <th className="p-2 border border-slate-300 text-center w-12 font-bold">JP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as ProtaData).rencanaAlokasi.map((item) => (
                        <tr key={item.no} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-bold">{item.no}</td>
                          <td className="p-2 border border-slate-300 text-center">{item.semester}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800">
                            {item.kodeTP}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-800">
                            {item.tujuanDanMateri}
                          </td>
                          <td className="p-2 border border-slate-300">{item.elemenCP}</td>
                          <td className="p-2 border border-slate-300 text-[11px]">{item.integrasiKBCPPRA}</td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {item.alokasiJP}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rekapitulasi */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
                <h5 className="font-bold text-teal-900 text-xs">Rekapitulasi Alokasi Waktu:</h5>
                <p className="text-slate-700 text-xs">
                  • Subtotal Semester Ganjil:{' '}
                  <strong>{(record.content as ProtaData).rekapitulasi.subtotalGanjilJP} JP</strong>
                  <br />• Subtotal Semester Genap:{' '}
                  <strong>{(record.content as ProtaData).rekapitulasi.subtotalGenapJP} JP</strong>
                  <br />• Total Keseluruhan Alokasi Waktu:{' '}
                  <strong>{(record.content as ProtaData).rekapitulasi.totalTahunJP} JP</strong> (Target:{' '}
                  {(record.content as ProtaData).rekapitulasi.alokasiTargetJP} JP)
                  <br />• Status Kesesuaian:{' '}
                  <span className="font-bold text-emerald-700">
                    {(record.content as ProtaData).rekapitulasi.keteranganStatus}
                  </span>
                </p>
              </div>

              <SignatureBlock />
            </div>
          )}

          {/* 5. PROSEM RENDERER */}
          {docType === 'PROSEM' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  PROGRAM SEMESTER (PROSEM)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  MATRIKS DISTRIBUSI PEMBELAJARAN PER MINGGU TAHUN PELAJARAN {masterInput.tahunPelajaran}
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as ProsemData).identitas} />

              {/* Legenda */}
              <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 text-xs mr-2">Legenda:</span>
                {(record.content as ProsemData).legenda.map((l, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${l.warna}`}
                  >
                    [{l.simbol}] {l.keterangan}
                  </span>
                ))}
              </div>

              {/* Semester 1 Matrix */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  Matriks Program Semester 1 (Ganjil)
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">No</th>
                        <th className="p-2 border border-slate-300 text-center w-14">Kode</th>
                        <th className="p-2 border border-slate-300">Tujuan Pembelajaran & Materi</th>
                        <th className="p-2 border border-slate-300 text-center w-10 font-bold">JP</th>
                        {(record.content as ProsemData).semesterGanjil.months.map((m) => (
                          <th key={m} className="p-2 border border-slate-300 text-center w-16">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as ProsemData).semesterGanjil.items.map((item) => (
                        <tr key={item.no} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-bold">{item.no}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800">
                            {item.kodeTP}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-800">
                            {item.tujuanDanMateri}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {item.alokasiJP}
                          </td>
                          {(record.content as ProsemData).semesterGanjil.months.map((m) => {
                            const weeks = item.distribusiBulan[m] || [0, 0, 0, 0, 0];
                            return (
                              <td key={m} className="p-2 border border-slate-300 text-center font-mono">
                                <div className="flex justify-center space-x-1">
                                  {weeks.map((w, wi) => (
                                    <span
                                      key={wi}
                                      className={`w-4 text-[11px] ${
                                        w > 0
                                          ? 'font-bold text-teal-700 bg-teal-100 rounded'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {w > 0 ? w : '·'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Semester 2 Matrix */}
              <div className="pt-4">
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  Matriks Program Semester 2 (Genap)
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">No</th>
                        <th className="p-2 border border-slate-300 text-center w-14">Kode</th>
                        <th className="p-2 border border-slate-300">Tujuan Pembelajaran & Materi</th>
                        <th className="p-2 border border-slate-300 text-center w-10 font-bold">JP</th>
                        {(record.content as ProsemData).semesterGenap.months.map((m) => (
                          <th key={m} className="p-2 border border-slate-300 text-center w-16">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as ProsemData).semesterGenap.items.map((item) => (
                        <tr key={item.no} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300 text-center font-bold">{item.no}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-teal-800">
                            {item.kodeTP}
                          </td>
                          <td className="p-2 border border-slate-300 text-slate-800">
                            {item.tujuanDanMateri}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-extrabold text-[#1A3A5C]">
                            {item.alokasiJP}
                          </td>
                          {(record.content as ProsemData).semesterGenap.months.map((m) => {
                            const weeks = item.distribusiBulan[m] || [0, 0, 0, 0, 0];
                            return (
                              <td key={m} className="p-2 border border-slate-300 text-center font-mono">
                                <div className="flex justify-center space-x-1">
                                  {weeks.map((w, wi) => (
                                    <span
                                      key={wi}
                                      className={`w-4 text-[11px] ${
                                        w > 0
                                          ? 'font-bold text-teal-700 bg-teal-100 rounded'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {w > 0 ? w : '·'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <SignatureBlock />
            </div>
          )}

          {/* 6. KKTP RENDERER */}
          {docType === 'KKTP' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div className="text-center mb-6">
                <h1 className="text-base font-extrabold text-[#1A3A5C] uppercase tracking-wide">
                  KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  PANDUAN RUBRIK ASESMEN KETERAMPILAN DAN TINDAK LANJUT BERBASIS KBC
                </p>
              </div>

              <RenderIdentityTable identitas={(record.content as KktpData).identitas} />

              {/* Level Capaian Umum */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  A. Deskripsi Level Capaian Ketercapaian Secara Umum
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(record.content as KktpData).deskripsiLevelUmum.map((lvl, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                    >
                      <span className="font-extrabold text-[#1A3A5C] text-xs">{lvl.interval}</span>
                      <p className="font-bold text-teal-800 text-xs">{lvl.kategori}</p>
                      <p className="text-[11px] text-slate-600">{lvl.keterangan}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rubric Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 text-[#1A3A5C]">
                  B. Rubrik Kriteria Ketercapaian per Tujuan Pembelajaran
                </h4>
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#1A3A5C] text-white">
                      <tr>
                        <th className="p-2 border border-slate-300 w-44">Tujuan Pembelajaran</th>
                        <th className="p-2 border border-slate-300 w-48">Indikator Ketercapaian</th>
                        <th className="p-2 border border-slate-300">Deskripsi Kriteria (4 Tingkat)</th>
                        <th className="p-2 border border-slate-300 w-44">Bukti & Tindak Lanjut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.content as KktpData).listRubrik.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-300">
                            <span className="font-extrabold text-[#1A3A5C]">[{r.kodeTP}]</span>
                            <br />
                            <span className="text-slate-800">{r.rumusanTP}</span>
                          </td>
                          <td className="p-2 border border-slate-300">
                            <ul className="list-disc list-inside space-y-1">
                              {r.indikatorKetercapaian.map((ind, idx) => (
                                <li key={idx}>{ind}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2 border border-slate-300 text-[11px] space-y-1">
                            <p>
                              <strong className="text-rose-700">1. Perlu Bimbingan (&lt;70):</strong>{' '}
                              {r.kriteria.perluBimbingan}
                            </p>
                            <p>
                              <strong className="text-amber-700">2. Cukup (70-79):</strong>{' '}
                              {r.kriteria.cukup}
                            </p>
                            <p>
                              <strong className="text-emerald-700">3. Baik (80-89):</strong>{' '}
                              {r.kriteria.baik}
                            </p>
                            <p>
                              <strong className="text-teal-800">4. Mahir (90-100):</strong>{' '}
                              {r.kriteria.sangatBaik || r.kriteria.mahir}
                            </p>
                          </td>
                          <td className="p-2 border border-slate-300 text-[11px]">
                            <p className="font-semibold text-slate-800">Bukti Asesmen:</p>
                            <p className="text-slate-600 mb-1">{r.buktiAsesmen}</p>
                            <p className="font-semibold text-slate-800">Remedial:</p>
                            <p className="text-slate-600 mb-1">{r.rencanaTindakLanjut.remedial}</p>
                            <p className="font-semibold text-slate-800">Pengayaan:</p>
                            <p className="text-slate-600">{r.rencanaTindakLanjut.pengayaan}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase mb-1 text-[#1A3A5C]">
                  C. Tindak Lanjut Pembelajaran Umum
                </h4>
                <p className="text-slate-700">{(record.content as KktpData).tindakLanjutUmum}</p>
              </div>

              <SignatureBlock />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
