import React, { useState } from 'react';
import {
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  FileEdit,
  History,
  Eye,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react';
import {
  ModulAjarKbcRecord,
  LkpdRecord,
  ModulAjarKbcData,
  LkpdData,
  Project,
} from '../types';
import {
  updateModulAjarApi,
  updateLkpdApi,
  syncProjectCollectionToLocal,
} from '../services/modulAjarClient';

interface ModulAjarEditorModalProps {
  type: 'modulAjar' | 'lkpd';
  record: ModulAjarKbcRecord | LkpdRecord;
  project: Project;
  activeInstitutionId?: string;
  onClose: () => void;
  onSaveSuccess: (updatedRecord: any, updatedProject: Project) => void;
}

export const ModulAjarEditorModal: React.FC<ModulAjarEditorModalProps> = ({
  type,
  record,
  project,
  activeInstitutionId,
  onClose,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState<string>(record.title);
  const [content, setContent] = useState<any>(() =>
    JSON.parse(JSON.stringify(record.content || {}))
  );
  const [status, setStatus] = useState<'draft' | 'completed' | 'needs_revision'>(
    record.status || 'completed'
  );
  const [changelog, setChangelog] = useState<string>('Pembaruan revisi konten dokumen.');
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'preview'>('editor');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    let res;
    if (type === 'modulAjar') {
      res = await updateModulAjarApi(
        project.id,
        record.id,
        {
          title,
          content: content as ModulAjarKbcData,
          status,
          changelog,
          expectedProjectUpdatedAt: project.updatedAt,
        },
        activeInstitutionId
      );
    } else {
      res = await updateLkpdApi(
        project.id,
        record.id,
        {
          title,
          content: content as LkpdData,
          status,
          changelog,
          expectedProjectUpdatedAt: project.updatedAt,
        },
        activeInstitutionId
      );
    }

    setIsSaving(false);

    if (res.success && res.data) {
      setSaveSuccess(true);
      const updatedProj = syncProjectCollectionToLocal(project, res.data, type);
      setTimeout(() => {
        onSaveSuccess(res.data, updatedProj);
      }, 500);
    } else {
      setSaveError(res.error || 'Gagal menyimpan perubahan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1A3A5C] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <FileEdit className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                Editor Document: {type === 'modulAjar' ? 'Modul Ajar KBC' : 'LKPD Interaktif'}
              </h2>
              <p className="text-xs text-cyan-100">
                Versi {record.version} | Dibuat: {new Date(record.createdAt).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeTab === 'editor' ? 'bg-white text-[#1A3A5C] font-bold' : 'text-white/80 hover:text-white'
                }`}
              >
                Penyuntingan
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeTab === 'history' ? 'bg-white text-[#1A3A5C] font-bold' : 'text-white/80 hover:text-white'
                }`}
              >
                Riwayat Versi
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <span>{saveError}</span>
              <button onClick={() => setSaveError(null)} className="text-rose-500 font-bold">
                Dismiss
              </button>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Perubahan dokumen berhasil disimpan sebagai versi baru!</span>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6 text-xs">
              {/* DOCUMENT META EDIT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-800">Judul Dokumen</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Status Dokumen</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="completed">Selesai (Completed)</option>
                    <option value="draft">Draf (Draft)</option>
                    <option value="needs_revision">Perlu Revisi</option>
                  </select>
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="font-bold text-slate-800">Catatan Perubahan (Changelog)</label>
                  <input
                    type="text"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="Contoh: Menyesuaikan alokasi waktu per pertemuan dan menambah asesmen..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* MODUL AJAR CONTENT EDITOR */}
              {type === 'modulAjar' && content.informasiUmum && (
                <div className="space-y-6">
                  {/* Informas umum */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                    <h3 className="font-bold text-[#1A3A5C] uppercase tracking-wider text-[11px] border-b pb-2">
                      Informasi Umum Pembelajaran
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block">Materi Pokok</label>
                        <input
                          type="text"
                          value={content.informasiUmum.materiPokok || ''}
                          onChange={(e) =>
                            setContent({
                              ...content,
                              informasiUmum: { ...content.informasiUmum, materiPokok: e.target.value },
                            })
                          }
                          className="w-full p-1.5 border border-slate-300 rounded-md font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">Gaya Mengajar</label>
                        <input
                          type="text"
                          value={content.informasiUmum.gayaMengajar || ''}
                          onChange={(e) =>
                            setContent({
                              ...content,
                              informasiUmum: { ...content.informasiUmum, gayaMengajar: e.target.value },
                            })
                          }
                          className="w-full p-1.5 border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pertemuan List */}
                  {Array.isArray(content.pertemuanList) && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-bold text-[#1A3A5C] uppercase tracking-wider text-[11px]">
                          Aktivitas Pertemuan Pembelajaran ({content.pertemuanList.length} Pertemuan)
                        </h3>
                      </div>

                      {content.pertemuanList.map((p: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <span className="font-bold text-cyan-800 text-[11px]">
                            Pertemuan ke-{p.pertemuanKe || idx + 1} ({p.alokasiJP || 2} JP)
                          </span>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 block">Topik Pertemuan</label>
                            <input
                              type="text"
                              value={p.topik || ''}
                              onChange={(e) => {
                                const list = [...content.pertemuanList];
                                list[idx].topik = e.target.value;
                                setContent({ ...content, pertemuanList: list });
                              }}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded-md font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 block">Kegiatan Inti KBC Deep Learning</label>
                            <textarea
                              rows={3}
                              value={p.kegiatanInti || ''}
                              onChange={(e) => {
                                const list = [...content.pertemuanList];
                                list[idx].kegiatanInti = e.target.value;
                                setContent({ ...content, pertemuanList: list });
                              }}
                              className="w-full p-1.5 bg-white border border-slate-300 rounded-md"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LKPD CONTENT EDITOR */}
              {type === 'lkpd' && content.materiPokok && (
                <div className="space-y-6">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                    <h3 className="font-bold text-[#1A3A5C] uppercase tracking-wider text-[11px] border-b pb-2">
                      Konten & Ringkasan Materi LKPD
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block">Ringkasan Materi</label>
                        <textarea
                          rows={3}
                          value={content.ringkasanMateri || ''}
                          onChange={(e) => setContent({ ...content, ringkasanMateri: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">Stimulus Permasalahan</label>
                        <textarea
                          rows={2}
                          value={content.stimulusPermasalahan || ''}
                          onChange={(e) => setContent({ ...content, stimulusPermasalahan: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-slate-800">Riwayat Perubahan Versi</h3>
              {Array.isArray(record.versionsHistory) && record.versionsHistory.length > 0 ? (
                <div className="space-y-2">
                  {record.versionsHistory.map((h: any) => (
                    <div key={h.version} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#1A3A5C]">Versi {h.version}</span>
                        <p className="text-[11px] text-slate-600">{h.changelog || 'Tidak ada catatan'}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(h.updatedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Belum ada riwayat versi sebelumnya.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
            BATAL
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-xs font-bold text-white bg-[#1A3A5C] hover:bg-[#142d48] rounded-xl flex items-center gap-2 shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'SIMPAN PERUBAHAN VERSI'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
