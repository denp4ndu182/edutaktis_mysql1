import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Layers,
  ArrowRight,
  Calendar,
  FileText,
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Eye,
  Edit3,
  Download,
  Printer,
  Info,
  BookOpenCheck,
  FileCheck2,
  Plus,
} from 'lucide-react';
import {
  Project,
  DocumentType,
  DocumentStatus,
  AnyDocumentContent,
  ModulAjarKbcRecord,
  LkpdRecord,
} from '../types';
import { checkPrerequisites, executeDocumentGeneration } from '../services/aiGeneratorService';
import { downloadDocxDocument } from '../services/docxGenerator';
import { DocumentRenderer } from './DocumentRenderer';
import { DocumentEditorModal } from './DocumentEditorModal';
import { ModulAjarGeneratorModal } from './ModulAjarGeneratorModal';
import { LkpdGeneratorModal } from './LkpdGeneratorModal';
import { ModulAjarEditorModal } from './ModulAjarEditorModal';
import { CollectionDocumentViewerModal } from './CollectionDocumentViewerModal';

interface AIToolsViewProps {
  project: Project;
  selectedDoc: DocumentType;
  onSelectDoc: (doc: DocumentType) => void;
  onUpdateDocument: (docType: DocumentType, content: AnyDocumentContent, changelog?: string) => void;
  onMarkNeedsRevision: (affectedTypes: DocumentType[]) => void;
  onProjectUpdate?: (updatedProject: Project) => void;
  activeInstitutionId?: string;
}

export const AIToolsView: React.FC<AIToolsViewProps> = ({
  project,
  selectedDoc,
  onSelectDoc,
  onUpdateDocument,
  onMarkNeedsRevision,
  onProjectUpdate,
  activeInstitutionId,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dependencyWarning, setDependencyWarning] = useState<string | null>(null);

  const [showModulModal, setShowModulModal] = useState(false);
  const [showLkpdModal, setShowLkpdModal] = useState(false);

  const [viewingCollectionItem, setViewingCollectionItem] = useState<{
    type: 'modulAjar' | 'lkpd';
    record: ModulAjarKbcRecord | LkpdRecord;
  } | null>(null);

  const [editingCollectionItem, setEditingCollectionItem] = useState<{
    type: 'modulAjar' | 'lkpd';
    record: ModulAjarKbcRecord | LkpdRecord;
  } | null>(null);

  const docCards: {
    type: DocumentType;
    num: string;
    title: string;
    outputFileName: string;
    description: string;
    icon: any;
    depNote: string;
  }[] = [
    {
      type: 'ACP',
      num: '01',
      title: 'Analisis Capaian Pembelajaran (ACP)',
      outputFileName: `ANALISIS_CP_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Menganalisis rasional, menguraikan 4 elemen CP, kompetensi terukur, materi esensial & kedalaman.',
      icon: BookOpen,
      depNote: 'Sumber: Master Input Kurikulum',
    },
    {
      type: 'TP',
      num: '02',
      title: 'Tujuan Pembelajaran (TP)',
      outputFileName: `TP_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Menyusun rumusan TP menggunakan Kata Kerja Operasional (KKO) Taksonomi Bloom terukur.',
      icon: Layers,
      depNote: 'Dependensi: Memerlukan ACP',
    },
    {
      type: 'ATP',
      num: '03',
      title: 'Alur Tujuan Pembelajaran (ATP)',
      outputFileName: `ATP_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Menyusun alur tahapan pembelajaran logis dari dasar menuju kompleks serta diagram visual.',
      icon: ArrowRight,
      depNote: 'Dependensi: Memerlukan TP',
    },
    {
      type: 'PROTA',
      num: '04',
      title: 'Program Tahunan (PROTA)',
      outputFileName: `PROTA_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Menghitung distribusi minggu efektif kalender & merumuskan alokasi waktu tahunan.',
      icon: Calendar,
      depNote: 'Dependensi: Memerlukan TP, ATP & Kalender',
    },
    {
      type: 'PROSEM',
      num: '05',
      title: 'Program Semester (PROSEM)',
      outputFileName: `PROSEM_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Mendistribusikan JP tatap muka ke dalam matriks mingguan setiap bulan pada semester ganjil dan genap.',
      icon: FileText,
      depNote: 'Dependensi: Memerlukan PROTA & Kalender',
    },
    {
      type: 'KKTP',
      num: '06',
      title: 'Kriteria Ketercapaian TP (KKTP)',
      outputFileName: `KKTP_${project.masterInput.mataPelajaran.replace(/\s+/g, '_').toUpperCase()}.docx`,
      description: 'Rubrik penilaian 4 tingkat ketercapaian, bukti asesmen, program remedial, dan pengayaan.',
      icon: Award,
      depNote: 'Dependensi: Memerlukan TP',
    },
  ];

  const handleGenerate = async (docType: DocumentType, force = false) => {
    if (!force) {
      const check = checkPrerequisites(docType, project.documents);
      if (!check.allowed) {
        setDependencyWarning(check.message);
        return;
      }
    }

    setDependencyWarning(null);
    setIsGenerating(true);

    try {
      const result = await executeDocumentGeneration(docType, project.masterInput, project.documents);
      onUpdateDocument(
        docType,
        result.content,
        result.source === 'gemini_ai'
          ? 'Digenerate oleh Gemini AI Kemenag'
          : 'Digenerate oleh Educational Document Engine'
      );

      if (docType === 'TP') {
        onMarkNeedsRevision(['ATP', 'PROTA', 'PROSEM', 'KKTP']);
      } else if (docType === 'ATP') {
        onMarkNeedsRevision(['PROTA', 'PROSEM']);
      } else if (docType === 'PROTA') {
        onMarkNeedsRevision(['PROSEM']);
      }
    } catch (err: any) {
      console.error(`Generation error for ${docType}:`, err);
      alert(`Gagal membuat dokumen ${docType}: ${err.message || 'Error AI'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadWord = async (docType: DocumentType) => {
    const rec = project.documents[docType];
    if (!rec.content) return;
    try {
      await downloadDocxDocument(docType, project.masterInput, rec.content);
    } catch (e) {
      console.error('Download Word failed:', e);
      alert('Gagal mendownload file Word (.docx)');
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#DDF7EC] text-[#159B79] border border-[#DDF7EC]">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Selesai
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Perlu Revisi
          </span>
        );
      case 'generating':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E1F2FC] text-[#087FC1] border border-[#E1F2FC]">
            <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
            Proses AI
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EEF3F7] text-[#536B80] border border-[#EEF3F7]">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Belum Dibuat
          </span>
        );
    }
  };

  const hasAcp = project.documents.ACP?.content;
  const hasTp = project.documents.TP?.content;
  const modulList = project.collections?.modulAjar || [];
  const lkpdList = project.collections?.lkpd || [];

  return (
    <div className="space-y-8 pb-16 min-h-screen">
      {/* Dependency Alert Banner */}
      {dependencyWarning && (
        <div className="p-4 bg-amber-50/90 backdrop-blur-md border border-amber-200/90 rounded-2xl flex items-start justify-between shadow-xs">
          <div className="flex items-start space-x-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-950 space-y-1">
              <p className="font-extrabold">Prasyarat Dokumen Belum Terpenuhi</p>
              <p className="font-medium">{dependencyWarning}</p>
            </div>
          </div>
          <button
            onClick={() => setDependencyWarning(null)}
            className="text-amber-800 hover:text-amber-950 text-xs font-extrabold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1. BASELINE GENERATORS GRID */}
      <section>
        <h2 className="text-xs font-extrabold text-[#64798B] uppercase tracking-wider mb-4">
          1. Enam Generator Administrasi Dasar (Baseline 01 - 06)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {docCards.map((card) => {
            const rec = project.documents[card.type];
            const isSelected = selectedDoc === card.type;
            const isCompleted = rec.status === 'completed' && rec.content;

            return (
              <div
                key={card.type}
                onClick={() => onSelectDoc(card.type)}
                className={`glass-surface rounded-3xl border transition-all p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-lg ${
                  isSelected
                    ? 'border-[#075080] ring-2 ring-[#075080]/20'
                    : 'border-white/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#1A3A5C] text-white flex items-center justify-center font-black text-xs shrink-0">
                        {card.num}
                      </div>
                      <span className="text-xs font-black text-[#173B57] tracking-wider uppercase">
                        {card.type}
                      </span>
                    </div>
                    {getStatusBadge(rec.status)}
                  </div>

                  <h3 className="font-extrabold text-[#173B57] text-[15px] leading-snug">{card.title}</h3>
                  <p className="text-[12px] text-[#64798B] mt-1.5 leading-relaxed min-h-[2.5rem]">{card.description}</p>
                  <div className="mt-3 text-[11px] text-[#64798B] bg-slate-100/60 border border-slate-200/50 px-2.5 py-1.5 rounded-xl font-medium flex items-center">
                    <Info className="w-3.5 h-3.5 mr-1.5 text-[#64798B] shrink-0" />
                    {card.depNote}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {!isCompleted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDoc(card.type);
                        handleGenerate(card.type);
                      }}
                      disabled={isGenerating}
                      className="flex-1 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all duration-200 flex items-center justify-center shadow-md cursor-pointer hover:-translate-y-0.5"
                    >
                      <Sparkles className="w-4 h-4 mr-1.5 text-cyan-200" />
                      Generate AI
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDoc(card.type);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#1A3A5C] text-white shadow-md'
                            : 'bg-white border border-slate-200 text-[#173B57] hover:bg-slate-50'
                        }`}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Preview
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDoc(card.type);
                          setIsEditing(true);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#173B57] hover:bg-slate-50 transition-all duration-200 flex items-center cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-4 h-4 mr-1.5" />
                        Edit
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadWord(card.type);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-extrabold bg-[#1A3A5C] hover:bg-[#087FC1] text-white transition-all duration-200 flex items-center shadow-md cursor-pointer"
                        title="Download Word (.docx)"
                      >
                        <Download className="w-4 h-4 mr-1.5 text-cyan-200" />
                        DOCX
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. GENERATOR LANJUTAN (#07 MODUL AJAR & #08 LKPD) */}
      <section className="space-y-4">
        <h2 className="text-xs font-extrabold text-[#64798B] uppercase tracking-wider">
          2. Generator Lanjutan KBC & Pembelajaran Interaktif (07 - 08)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CARD 07: MODUL AJAR KBC */}
          <div className="glass-surface rounded-3xl border border-white/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#1A3A5C] text-white flex items-center justify-center font-black text-xs">
                    07
                  </span>
                  <span className="text-xs font-black text-[#1A3A5C] tracking-wider uppercase">
                    MODUL_AJAR_KBC
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                    hasAcp && hasTp
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {hasAcp && hasTp ? `Siap (${modulList.length} Modul)` : 'Butuh ACP & TP'}
                </span>
              </div>

              <h3 className="font-extrabold text-[#173B57] text-[15px] leading-snug">
                Generator Modul Ajar KBC (Kurikulum Berbasis Cinta)
              </h3>
              <p className="text-[12px] text-[#64798B] leading-relaxed">
                Menyusun Modul Ajar terstruktur berbasis KBC & Kemenag dengan integrasi Panca Cinta, PPRA, serta alokasi pertemuan KBC Deep Learning (Mindful, Meaningful, Joyful).
              </p>
              <div className="text-[11px] text-[#64798B] bg-slate-100/60 border border-slate-200/50 px-3 py-1.5 rounded-xl font-medium flex items-center shadow-2xs">
                <Info className="w-3.5 h-3.5 mr-2 text-[#64798B] shrink-0" />
                Mendukung Banyak Modul Ajar per Proyek
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-200/60">
              <button
                onClick={() => setShowModulModal(true)}
                className="w-full px-5 py-3 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:-translate-y-0.5"
              >
                <BookOpenCheck className="w-4.5 h-4.5 text-cyan-200" />
                <span>BUKA GENERATOR MODUL AJAR KBC</span>
              </button>
            </div>
          </div>

          {/* CARD 08: LKPD INTERAKTIF */}
          <div className="glass-surface rounded-3xl border border-white/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#1A3A5C] text-white flex items-center justify-center font-black text-xs">
                    08
                  </span>
                  <span className="text-xs font-black text-[#1A3A5C] tracking-wider uppercase">
                    LKPD_INTERAKTIF
                  </span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold bg-cyan-50 text-[#075080] border border-cyan-200">
                  {`Tersedia (${lkpdList.length} LKPD)`}
                </span>
              </div>

              <h3 className="font-extrabold text-[#173B57] text-[15px] leading-snug">
                Generator Lembar Kerja Peserta Didik (LKPD)
              </h3>
              <p className="text-[12px] text-[#64798B] leading-relaxed">
                Menyusun LKPD interaktif berstruktur lengkap berbasis Modul Ajar (Mode 1) atau data akademik ACP & TP secara langsung (Mode 2).
              </p>
              <div className="text-[11px] text-[#64798B] bg-slate-100/60 border border-slate-200/50 px-3 py-1.5 rounded-xl font-medium flex items-center shadow-2xs">
                <Info className="w-3.5 h-3.5 mr-2 text-[#64798B] shrink-0" />
                Mode 1 (Dari Modul) | Mode 2 (Dari ACP/TP)
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-200/60">
              <button
                onClick={() => setShowLkpdModal(true)}
                className="w-full px-5 py-3 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:-translate-y-0.5"
              >
                <FileCheck2 className="w-4.5 h-4.5 text-cyan-200" />
                <span>BUKA GENERATOR LKPD</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SAVED COLLECTIONS LIST SECTION */}
      {(modulList.length > 0 || lkpdList.length > 0) && (
        <section className="p-6 bg-white/50 backdrop-blur-md border border-slate-200/60 rounded-3xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#1A3A5C] uppercase tracking-wider">
              Koleksi Modul Ajar & LKPD Terdaftar
            </h3>
            <span className="text-[11px] text-[#64798B] font-bold bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
              Total: {modulList.length} Modul Ajar | {lkpdList.length} LKPD
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modul Ajar List */}
            {modulList.map((mod) => (
              <div
                key={mod.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#075080] text-[10px] px-2.5 py-0.5 bg-cyan-50 border border-cyan-100 rounded-lg">
                      Modul Ajar KBC
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">v{mod.version}</span>
                  </div>
                  <h4 className="font-extrabold text-[#173B57] text-xs truncate">{mod.title}</h4>
                  <p className="text-[11px] text-[#64798B] truncate">
                    Materi: {mod.teacherInput.materiPokok} | {mod.teacherInput.alokasiWaktu} JP
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setViewingCollectionItem({ type: 'modulAjar', record: mod })}
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#173B57] font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat</span>
                  </button>
                  <button
                    onClick={() => setEditingCollectionItem({ type: 'modulAjar', record: mod })}
                    className="flex-1 px-3 py-2 bg-[#1A3A5C] hover:bg-[#087FC1] text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}

            {/* LKPD List */}
            {lkpdList.map((lk) => (
              <div
                key={lk.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#075080] text-[10px] px-2.5 py-0.5 bg-cyan-50 border border-cyan-100 rounded-lg">
                      LKPD ({lk.mode === 'FROM_MODULE' ? 'Dari Modul' : 'Dari Data Akademik'})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">v{lk.version}</span>
                  </div>
                  <h4 className="font-extrabold text-[#173B57] text-xs truncate">{lk.title}</h4>
                  <p className="text-[11px] text-[#64798B] truncate">
                    Materi: {lk.teacherInput.materiPokok || 'LKPD'}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setViewingCollectionItem({ type: 'lkpd', record: lk })}
                    className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#173B57] font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat</span>
                  </button>
                  <button
                    onClick={() => setEditingCollectionItem({ type: 'lkpd', record: lk })}
                    className="flex-1 px-3 py-2 bg-[#1A3A5C] hover:bg-[#087FC1] text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ACTIVE DOCUMENT PREVIEW AREA (BASELINE 6 GENERATORS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-extrabold text-[#64798B] uppercase tracking-wider">
              Area Kerja & Preview:
            </span>
            <span className="text-[11px] font-black text-white bg-[#075080] px-3 py-1 rounded-full shadow-2xs">
              {selectedDoc}
            </span>
          </div>
        </div>

        <DocumentRenderer
          docType={selectedDoc}
          record={project.documents[selectedDoc]}
          masterInput={project.masterInput}
          onEdit={() => setIsEditing(true)}
          onRegenerate={() => handleGenerate(selectedDoc, true)}
          isGenerating={isGenerating}
        />
      </section>

      {/* EDIT MODAL FOR BASELINE 6 DOCS */}
      {isEditing && (
        <DocumentEditorModal
          docType={selectedDoc}
          initialContent={project.documents[selectedDoc].content!}
          onSave={(updatedContent, changelog) => {
            onUpdateDocument(selectedDoc, updatedContent, changelog);
            setIsEditing(false);
          }}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* MODAL: MODUL AJAR GENERATOR */}
      {showModulModal && (
        <ModulAjarGeneratorModal
          project={project}
          activeInstitutionId={activeInstitutionId}
          onClose={() => setShowModulModal(false)}
          onSuccess={(record, updatedProj) => {
            setShowModulModal(false);
            if (onProjectUpdate) onProjectUpdate(updatedProj);
            setViewingCollectionItem({ type: 'modulAjar', record });
          }}
        />
      )}

      {/* MODAL: LKPD GENERATOR */}
      {showLkpdModal && (
        <LkpdGeneratorModal
          project={project}
          activeInstitutionId={activeInstitutionId}
          onClose={() => setShowLkpdModal(false)}
          onSuccess={(record, updatedProj) => {
            setShowLkpdModal(false);
            if (onProjectUpdate) onProjectUpdate(updatedProj);
            setViewingCollectionItem({ type: 'lkpd', record });
          }}
        />
      )}

      {/* MODAL: COLLECTION VIEWING */}
      {viewingCollectionItem && (
        <CollectionDocumentViewerModal
          type={viewingCollectionItem.type}
          record={viewingCollectionItem.record}
          masterInput={project.masterInput}
          onClose={() => setViewingCollectionItem(null)}
          onEdit={() => {
            const item = viewingCollectionItem;
            setViewingCollectionItem(null);
            setEditingCollectionItem(item);
          }}
        />
      )}

      {/* MODAL: COLLECTION EDITING */}
      {editingCollectionItem && (
        <ModulAjarEditorModal
          type={editingCollectionItem.type}
          record={editingCollectionItem.record}
          project={project}
          activeInstitutionId={activeInstitutionId}
          onClose={() => setEditingCollectionItem(null)}
          onSaveSuccess={(updatedRecord, updatedProj) => {
            setEditingCollectionItem(null);
            if (onProjectUpdate) onProjectUpdate(updatedProj);
          }}
        />
      )}
    </div>
  );
};
