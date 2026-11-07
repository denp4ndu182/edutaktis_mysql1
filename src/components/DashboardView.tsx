import React from 'react';
import {
  FileText,
  Calendar,
  Layers,
  Award,
  ArrowRight,
  Sparkles,
  School,
  UserCheck,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Project, DocumentType } from '../types';

interface DashboardViewProps {
  project: Project;
  onNavigateTab: (tab: any) => void;
  onSelectDocument: (docType: DocumentType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  onNavigateTab,
  onSelectDocument,
}) => {
  const docs = project.documents;
  const completedCount = Object.values(docs).filter((d) => d.status === 'completed' && d.content).length;
  const progressPercent = Math.round((completedCount / 6) * 100);

  const docCards: {
    type: DocumentType;
    num: string;
    title: string;
    shortDesc: string;
    dep: string;
    icon: any;
  }[] = [
    {
      type: 'ACP',
      num: '01',
      title: 'Analisis Capaian Pembelajaran (ACP)',
      shortDesc: 'Penguraian elemen CP, kompetensi terukur, materi esensial & integrasi KBC.',
      dep: 'Berdasarkan Master Input Kurikulum',
      icon: BookOpen,
    },
    {
      type: 'TP',
      num: '02',
      title: 'Tujuan Pembelajaran (TP)',
      shortDesc: 'Rumusan tujuan operasional KKO Bloom, Panca Cinta & 10 Nilai PPRA.',
      dep: 'Diturunkan dari dokumen ACP',
      icon: Layers,
    },
    {
      type: 'ATP',
      num: '03',
      title: 'Alur Tujuan Pembelajaran (ATP)',
      shortDesc: 'Peta urutan logis tahapan belajar bertahap semester 1 & semester 2.',
      dep: 'Berdasarkan dokumen TP',
      icon: ArrowRight,
    },
    {
      type: 'PROTA',
      num: '04',
      title: 'Program Tahunan (PROTA)',
      shortDesc: 'Distribusi minggu efektif kalender madrasah & alokasi JP per tujuan.',
      dep: 'Berdasarkan TP, ATP & Kalender',
      icon: Calendar,
    },
    {
      type: 'PROSEM',
      num: '05',
      title: 'Program Semester (PROSEM)',
      shortDesc: 'Matriks sebaran JP tatap muka mingguan per bulan ganjil dan genap.',
      dep: 'Berdasarkan PROTA & Kalender',
      icon: FileText,
    },
    {
      type: 'KKTP',
      num: '06',
      title: 'Kriteria Ketercapaian TP (KKTP)',
      shortDesc: 'Rubrik penilaian 4 tingkatan kompetensi, bukti asesmen, remedial & pengayaan.',
      dep: 'Berdasarkan dokumen TP',
      icon: Award,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Welcome & Identity Summary (Soft Ocean Glass Edition) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#075080]/90 via-[#087FA6]/85 to-[#16A9B9]/80 backdrop-blur-xl text-white p-5 sm:p-6 md:p-7 shadow-xl border border-white/40">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
          <div className="lg:col-span-2 space-y-3">
            <div className="inline-flex items-center space-x-2 bg-white/15 text-cyan-100 border border-white/25 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xs shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
              <span>Sistem Cerdas Administrasi Guru Madrasah Kemenag RI</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight drop-shadow-xs leading-snug">
              Generator Administrasi Guru KBC AI
            </h2>
            <p className="text-cyan-50 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
              Cukup sekali input data madrasah dan kurikulum, sistem secara otomatis merumuskan 6
              dokumen pembelajaran resmi siap cetak dan ekspor Word (DOCX) berstandar Kementerian Agama.
            </p>

            <div className="pt-1 flex flex-wrap gap-2.5">
              <button
                onClick={() => onNavigateTab('ai_tools')}
                className="bg-white text-[#075080] hover:bg-cyan-50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-2 text-[#087FC1]" />
                Mulai Generate Dokumen
              </button>
              <button
                onClick={() => onNavigateTab('master_input')}
                className="bg-black/20 hover:bg-black/30 text-white border border-white/30 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-xs hover:-translate-y-0.5 transition-all duration-200 flex items-center cursor-pointer shadow-xs"
              >
                <School className="w-4 h-4 mr-2 text-cyan-200" />
                Edit Identitas Madrasah
              </button>
            </div>
          </div>

          {/* Quick Progress Badge with 3D Depth */}
          <div className="bg-white/12 backdrop-blur-md border border-white/25 rounded-2xl p-5 text-center flex flex-col justify-center items-center shadow-inner">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-white/20"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - progressPercent / 100)}
                  className="text-cyan-200 transition-all duration-700 filter drop-shadow-[0_0_8px_rgba(36,191,208,0.8)]"
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black tracking-tight">{progressPercent}%</span>
              </div>
            </div>
            <p className="text-xs font-bold text-cyan-100 mt-2">
              {completedCount} dari 6 Dokumen Selesai
            </p>
            <p className="text-[11px] text-cyan-200/90 font-medium mt-0.5">
              {completedCount === 6 ? 'Semua Dokumen Siap Cetak & Ekspor' : 'Menunggu generate dokumen'}
            </p>
          </div>
        </div>

        {/* Decorative corner glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Madrasah Profile Highlights (White Glass Cards with fixed wrapping) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface rounded-2xl p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-start space-x-3.5 group">
          <div className="p-2.5 bg-cyan-50/90 rounded-xl text-cyan-700 group-hover:bg-[#087FC1] group-hover:text-white transition-colors shrink-0 mt-0.5">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Madrasah</p>
            <p className="text-xs font-extrabold text-[#173B57] leading-tight line-clamp-2 mt-0.5" title={project.masterInput.namaMadrasah}>
              {project.masterInput.namaMadrasah || 'Nama Madrasah'}
            </p>
            <p className="text-[10px] text-slate-500 leading-snug line-clamp-2 mt-1" title={project.masterInput.alamatMadrasah}>
              {project.masterInput.alamatMadrasah || 'Alamat Madrasah'}
            </p>
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-start space-x-3.5 group">
          <div className="p-2.5 bg-blue-50/90 rounded-xl text-blue-700 group-hover:bg-[#075080] group-hover:text-white transition-colors shrink-0 mt-0.5">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru Pengampu</p>
            <p className="text-xs font-extrabold text-[#173B57] leading-tight line-clamp-2 mt-0.5" title={project.masterInput.namaGuru}>
              {project.masterInput.namaGuru || 'Nama Guru'}
            </p>
            <p className="text-[10px] text-slate-500 leading-snug line-clamp-1 mt-1 font-mono">
              NIP. {project.masterInput.nipGuru || '-'}
            </p>
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-start space-x-3.5 group">
          <div className="p-2.5 bg-teal-50/90 rounded-xl text-teal-700 group-hover:bg-[#24BFD0] group-hover:text-white transition-colors shrink-0 mt-0.5">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mata Pelajaran</p>
            <p className="text-xs font-extrabold text-[#173B57] leading-tight line-clamp-2 mt-0.5" title={project.masterInput.mataPelajaran}>
              {project.masterInput.mataPelajaran || 'Mata Pelajaran'}
            </p>
            <p className="text-[10px] text-slate-500 leading-snug line-clamp-1 mt-1">
              {project.masterInput.fase} • {project.masterInput.kelas}
            </p>
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-start space-x-3.5 group">
          <div className="p-2.5 bg-amber-50/90 rounded-xl text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alokasi Waktu</p>
            <p className="text-xs font-extrabold text-[#173B57] leading-tight line-clamp-1 mt-0.5">
              {project.masterInput.alokasiWaktuTotal} JP / Tahun
            </p>
            <p className="text-[10px] text-slate-500 leading-snug line-clamp-1 mt-1">
              {project.masterInput.jpPerMinggu} JP/Minggu • TP {project.masterInput.tahunPelajaran}
            </p>
          </div>
        </div>
      </div>

      {/* Document Dependency Workflow Visualization */}
      <div className="glass-surface rounded-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-extrabold text-[#173B57] text-sm sm:text-base flex items-center">
              <Layers className="w-5 h-5 mr-2 text-[#087FC1]" />
              Alur Integrasi & Dependensi Antardokumen
            </h3>
            <p className="text-xs text-slate-500">
              Sistem menjamin konsistensi data dari hulu ke hilir sesuai standar Kurikulum Merdeka Kemenag
            </p>
          </div>
          <span className="text-xs bg-teal-50 text-teal-800 px-3 py-1 rounded-full font-bold border border-teal-200">
            Otomatis & Terpadu
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
          {docCards.map((card, idx) => {
            const isCompleted = docs[card.type].status === 'completed';
            return (
              <div
                key={card.type}
                onClick={() => {
                  onSelectDocument(card.type);
                  onNavigateTab('ai_tools');
                }}
                className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer relative group shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                  isCompleted
                    ? 'bg-cyan-50/60 border-cyan-300 hover:bg-cyan-100/70'
                    : 'bg-white/70 border-slate-200 hover:border-[#087FC1] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-[#087FC1]">
                    {card.num}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#159B79]" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <p className="text-xs font-extrabold text-[#173B57] truncate">{card.type}</p>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{card.title.split('(')[0]}</p>
                {idx < 4 && (
                  <div className="hidden md:block absolute -right-3.5 top-1/2 transform -translate-y-1/2 z-10 text-[#087FC1] font-bold">
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6 Documents Grid Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-[#173B57] text-sm sm:text-base flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-[#087FC1]" />
            Status 6 Dokumen Administrasi Pembelajaran
          </h3>
          <button
            onClick={() => onNavigateTab('ai_tools')}
            className="text-xs font-bold text-[#087FC1] hover:text-[#075080] flex items-center cursor-pointer hover:underline"
          >
            Buka Modul AI Tools <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {docCards.map((doc) => {
            const currentDoc = docs[doc.type];
            const isCompleted = currentDoc.status === 'completed' && currentDoc.content;

            return (
              <div
                key={doc.type}
                className="glass-surface rounded-3xl hover:border-[#087FC1] transition-all duration-200 p-5 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#075080] flex items-center justify-center font-black text-xs border border-teal-200 shrink-0">
                        {doc.num}
                      </div>
                      <span className="text-xs font-black text-slate-700 tracking-wider">
                        {doc.type}
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="inline-flex items-center text-[11px] font-bold bg-emerald-50 text-[#159B79] px-3 py-1 rounded-full border border-emerald-200 shadow-2xs shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#159B79]" />
                        Selesai v{currentDoc.version}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200/60 shrink-0">
                        Belum Dibuat
                      </span>
                    )}
                  </div>

                  <h4 className="font-extrabold text-[#173B57] text-sm leading-snug">{doc.title}</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed min-h-[2.5rem]">{doc.shortDesc}</p>
                  <p className="text-[11px] text-[#075080] mt-3 font-medium bg-cyan-50/70 p-2 rounded-xl border border-cyan-100 line-clamp-1">
                    {doc.dep}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
                    {isCompleted ? `Diperbarui: ${new Date(currentDoc.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Siap diproses AI'}
                  </span>

                  <button
                    onClick={() => {
                      onSelectDocument(doc.type);
                      onNavigateTab('ai_tools');
                    }}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-[#075080] text-white hover:bg-[#087FC1] transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer shrink-0"
                  >
                    {isCompleted ? (
                      <>
                        <Printer className="w-3.5 h-3.5 mr-1.5 text-cyan-200" />
                        Preview & Cetak
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-cyan-200" />
                        Generate AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

