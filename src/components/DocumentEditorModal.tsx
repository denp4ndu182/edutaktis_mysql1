import React, { useState } from 'react';
import {
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import {
  DocumentType,
  AnyDocumentContent,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProsemData,
  KktpData,
} from '../types';

interface DocumentEditorModalProps {
  docType: DocumentType;
  initialContent: AnyDocumentContent;
  onSave: (updatedContent: AnyDocumentContent, changelog: string) => void;
  onClose: () => void;
}

export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
  docType,
  initialContent,
  onSave,
  onClose,
}) => {
  // Deep clone initial content to local edit state
  const [content, setContent] = useState<any>(() => JSON.parse(JSON.stringify(initialContent)));
  const [changelog, setChangelog] = useState<string>('Revisi konten dan perbaikan redaksi.');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    onSave(content, changelog);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  // Specific row manipulators based on docType
  const handleAddTableRow = () => {
    if (docType === 'TP') {
      const list = [...(content.listTP || [])];
      const nextNo = list.length + 1;
      list.push({
        no: nextNo,
        kodeTP: `TP.7.${nextNo}`,
        elemen: 'Elemen Pembelajaran',
        rumusanTP: 'Peserta didik mampu...',
        kompetensi: 'Kompetensi dasar',
        materiPokok: 'Materi pokok baru',
        integrasiPancaCinta: 'Cinta Ilmu',
        integrasiPPRA: "Ta'addub",
        alokasiJP: 6,
      });
      setContent({ ...content, listTP: list, totalJP: list.reduce((a, b) => a + (b.alokasiJP || 0), 0) });
    } else if (docType === 'ATP') {
      const list = [...(content.listATP || [])];
      const nextNo = list.length + 1;
      list.push({
        no: nextNo,
        alurUrutan: nextNo,
        kodeTP: `TP.7.${nextNo}`,
        elemen: 'Elemen Pembelajaran',
        rumusanTP: 'Alur Tujuan Pembelajaran baru...',
        materiPokok: 'Materi pokok',
        aspekKompetensi: 'Keterampilan / Pengetahuan',
        integrasiKbcPpra: 'Cinta Ilmu | Taaddub',
        alokasiJP: 6,
        semester: 'Semester 1 (Ganjil)',
      });
      setContent({ ...content, listATP: list });
    } else if (docType === 'PROTA') {
      const list = [...(content.rencanaAlokasi || [])];
      const nextNo = list.length + 1;
      list.push({
        no: nextNo,
        semester: 'Ganjil',
        kodeTP: `TP.7.${nextNo}`,
        tujuanDanMateri: 'Tujuan pembelajaran baru dan materi pokok',
        elemenCP: 'Elemen Pembelajaran',
        integrasiKBCPPRA: 'KBC & PPRA',
        alokasiJP: 6,
      });
      setContent({ ...content, rencanaAlokasi: list });
    } else if (docType === 'KKTP') {
      const list = [...(content.listRubrik || [])];
      list.push({
        kodeTP: `TP.7.${list.length + 1}`,
        rumusanTP: 'Tujuan pembelajaran...',
        indikatorKetercapaian: ['Indikator 1', 'Indikator 2'],
        kriteria: {
          perluBimbingan: 'Belum mencapai ketuntasan dasar (<70)',
          cukup: 'Mencapai ketuntasan minimal (70-79)',
          baik: 'Mencapai ketuntasan baik (80-89)',
          mahir: 'Melampaui ketuntasan (90-100)',
        },
        buktiAsesmen: 'Portofolio proyek koding',
        rencanaTindakLanjut: {
          remedial: 'Bimbingan terfokus',
          pengayaan: 'Tantangan proyek tambahan',
        },
      });
      setContent({ ...content, listRubrik: list });
    }
  };

  const handleDeleteTableRow = (index: number) => {
    if (docType === 'TP') {
      const list = content.listTP.filter((_: any, i: number) => i !== index);
      setContent({ ...content, listTP: list, totalJP: list.reduce((a: any, b: any) => a + (b.alokasiJP || 0), 0) });
    } else if (docType === 'ATP') {
      const list = content.listATP.filter((_: any, i: number) => i !== index);
      setContent({ ...content, listATP: list });
    } else if (docType === 'PROTA') {
      const list = content.rencanaAlokasi.filter((_: any, i: number) => i !== index);
      setContent({ ...content, rencanaAlokasi: list });
    } else if (docType === 'KKTP') {
      const list = content.listRubrik.filter((_: any, i: number) => i !== index);
      setContent({ ...content, listRubrik: list });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl glass-surface rounded-3xl shadow-2xl border border-white/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Editor Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-[#075080] to-[#087FC1] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <FileEdit className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">Editor Dokumen {docType}</h2>
              <p className="text-[11px] text-cyan-100 font-medium">Perbaiki teks & sesuaikan isi dokumen secara manual</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 text-xs font-black text-white bg-[#1A3A5C] hover:bg-[#087FC1] rounded-2xl transition-all shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>SIMPAN REVISI</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 text-[#173B57]">
          {savedSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
              Revisi berhasil disimpan!
            </div>
          )}

          {/* Changelog field */}
          <div className="p-5 bg-white/60 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <label className="text-[11px] font-black text-[#173B57] uppercase tracking-wider block">
              Catatan Revisi / Changelog:
            </label>
            <input
              type="text"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Contoh: Menyesuaikan rumusan kata kerja operasional TP.7.3..."
              className="w-full px-4 py-3 text-xs bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-semibold"
            />
          </div>

          {/* ... Content Editors ... */}
          {docType === 'ACP' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-[#173B57] mb-1 uppercase text-[11px]">Rasional Mata Pelajaran:</label>
                <textarea
                  rows={4}
                  value={content.rasionalMapel || ''}
                  onChange={(e) => setContent({ ...content, rasionalMapel: e.target.value })}
                  className="w-full p-4 border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                />
              </div>
              <div>
                <label className="block font-black text-[#173B57] mb-1 uppercase text-[11px]">Capaian Pembelajaran Umum:</label>
                <textarea
                  rows={4}
                  value={content.cpUmum || ''}
                  onChange={(e) => setContent({ ...content, cpUmum: e.target.value })}
                  className="w-full p-4 border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                />
              </div>
              <div>
                <label className="block font-black text-[#173B57] mb-1 uppercase text-[11px]">
                  Penerapan Panca Cinta & PPRA:
                </label>
                <textarea
                  rows={3}
                  value={content.integrasiKBCPPRA?.kbcApplication || ''}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      integrasiKBCPPRA: {
                        ...content.integrasiKBCPPRA,
                        kbcApplication: e.target.value,
                      },
                    })
                  }
                  className="w-full p-4 border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium mb-3"
                  placeholder="Penerapan Panca Cinta..."
                />
                <textarea
                  rows={3}
                  value={content.integrasiKBCPPRA?.ppraApplication || ''}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      integrasiKBCPPRA: {
                        ...content.integrasiKBCPPRA,
                        ppraApplication: e.target.value,
                      },
                    })
                  }
                  className="w-full p-4 border border-slate-300 rounded-2xl focus:outline-none focus:border-[#087FC1] text-[#173B57] font-medium"
                  placeholder="Penerapan PPRA..."
                />
              </div>
            </div>
          )}

          {/* TP Editor */}
          {docType === 'TP' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-xs text-[#173B57] uppercase">
                  Daftar Tujuan Pembelajaran ({content.listTP?.length || 0} TP)
                </h4>
                <button
                  onClick={handleAddTableRow}
                  className="px-4 py-2 text-xs font-bold bg-[#075080] text-white rounded-xl hover:bg-[#087FC1] flex items-center cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tambah Baris TP
                </button>
              </div>

              <div className="space-y-3">
                {content.listTP?.map((tp: any, i: number) => (
                  <div key={i} className="p-4 border border-slate-200 rounded-2xl bg-white/50 space-y-3 text-xs shadow-inner">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="text"
                          value={tp.kodeTP}
                          onChange={(e) => {
                            const list = [...content.listTP];
                            list[i].kodeTP = e.target.value;
                            setContent({ ...content, listTP: list });
                          }}
                          className="w-20 font-black p-2.5 border border-slate-300 rounded-xl bg-white text-[#075080]"
                        />
                        <input
                          type="text"
                          value={tp.elemen}
                          onChange={(e) => {
                            const list = [...content.listTP];
                            list[i].elemen = e.target.value;
                            setContent({ ...content, listTP: list });
                          }}
                          className="flex-1 font-bold p-2.5 border border-slate-300 rounded-xl bg-white text-[#173B57]"
                        />
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">JP:</span>
                        <input
                          type="number"
                          value={tp.alokasiJP}
                          onChange={(e) => {
                            const list = [...content.listTP];
                            list[i].alokasiJP = Number(e.target.value);
                            setContent({
                              ...content,
                              listTP: list,
                              totalJP: list.reduce((a, b) => a + (b.alokasiJP || 0), 0),
                            });
                          }}
                          className="w-16 text-center font-black p-2.5 border border-slate-300 rounded-xl bg-white text-[#1A3A5C]"
                        />
                        <button
                          onClick={() => handleDeleteTableRow(i)}
                          className="text-rose-500 hover:text-rose-700 p-2 cursor-pointer bg-rose-50 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={tp.rumusanTP}
                      onChange={(e) => {
                        const list = [...content.listTP];
                        list[i].rumusanTP = e.target.value;
                        setContent({ ...content, listTP: list });
                      }}
                      className="w-full p-4 border border-slate-300 rounded-xl bg-white text-[#173B57] font-medium"
                      placeholder="Rumusan Tujuan Pembelajaran..."
                    />
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <input
                        type="text"
                        value={tp.materiPokok}
                        onChange={(e) => {
                          const list = [...content.listTP];
                          list[i].materiPokok = e.target.value;
                          setContent({ ...content, listTP: list });
                        }}
                        className="p-3 border border-slate-300 rounded-xl bg-white text-[#173B57] font-medium"
                        placeholder="Materi pokok..."
                      />
                      <input
                        type="text"
                        value={tp.integrasiPancaCinta}
                        onChange={(e) => {
                          const list = [...content.listTP];
                          list[i].integrasiPancaCinta = e.target.value;
                          setContent({ ...content, listTP: list });
                        }}
                        className="p-3 border border-slate-300 rounded-xl bg-white text-[#173B57] font-medium"
                        placeholder="Nilai KBC..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* ... (Repeat styling for ATP/PROTA/KKTP) ... */}
        </div>
      </div>
    </div>
  );
};
