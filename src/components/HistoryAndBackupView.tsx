import React, { useRef } from 'react';
import {
  FolderKanban,
  Download,
  Upload,
  Plus,
  Copy,
  Trash2,
  Clock,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { Project, DocumentType } from '../types';
import { exportProjectToJson } from '../services/storageService';

interface HistoryAndBackupViewProps {
  currentProject: Project;
  allProjects: Project[];
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: () => void;
  onDeleteProject: (id: string) => void;
  onImportProject: (imported: Project) => void;
}

export const HistoryAndBackupView: React.FC<HistoryAndBackupViewProps> = ({
  currentProject,
  allProjects,
  onSwitchProject,
  onNewProject,
  onDuplicateProject,
  onDeleteProject,
  onImportProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && parsed.id && parsed.masterInput) {
          onImportProject(parsed);
          alert('Proyek berhasil diimpor!');
        } else {
          alert('Format file JSON tidak valid sebagai backup administrasi.');
        }
      } catch (err) {
        alert('Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
  };

  const docTypes: DocumentType[] = ['ACP', 'TP', 'ATP', 'PROTA', 'PROSEM', 'KKTP'];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="glass-surface rounded-3xl border border-white/60 p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#173B57] flex items-center">
            <FolderKanban className="w-6 h-6 mr-3 text-[#087FC1]" />
            Manajemen Proyek & Riwayat Dokumen
          </h2>
          <p className="text-xs text-[#64798B] font-medium mt-1">
            Kelola proyek administrasi guru, backup data secara offline, dan pantau log versi dokumen.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-2xl text-[11px] font-black bg-white border border-slate-200 text-[#173B57] hover:bg-slate-50 transition-all flex items-center cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 mr-2" />
            RESTORE (UPLOAD JSON)
          </button>

          <button
            onClick={() => exportProjectToJson(currentProject)}
            className="px-5 py-2.5 rounded-2xl text-[11px] font-black bg-gradient-to-r from-[#075080] to-[#087FC1] text-white hover:from-[#087FC1] hover:to-[#075080] transition-all flex items-center shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-2 text-cyan-200" />
            BACKUP PROYEK INI
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="glass-surface rounded-3xl border border-white/60 p-6 shadow-md space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[#173B57] uppercase tracking-wider text-sm">
            Daftar Proyek ({allProjects.length})
          </h3>
          <button
            onClick={onNewProject}
            className="px-4 py-2 text-[11px] font-black bg-[#075080] text-white rounded-2xl hover:bg-[#087FC1] flex items-center cursor-pointer shadow-md transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            BUAT PROYEK BARU
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allProjects.map((p) => {
            const isCurrent = p.id === currentProject.id;
            const completedDocs = Object.values(p.documents).filter(
              (d) => d.status === 'completed' && d.content
            ).length;

            return (
              <div
                key={p.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-cyan-400 bg-white shadow-lg'
                    : 'border-slate-200 bg-white/60 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-[#173B57] truncate">{p.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-black bg-[#24BFD0]/20 text-[#075080] px-3 py-1 rounded-full border border-[#24BFD0]/30">
                        AKTIF
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64798B] font-medium">
                    {p.masterInput.namaMadrasah} • {p.masterInput.mataPelajaran} ({p.masterInput.fase})
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                    {completedDocs} dari 6 Dokumen Dibuat • {new Date(p.updatedAt).toLocaleDateString('id-ID')}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                  {!isCurrent ? (
                    <button
                      onClick={() => onSwitchProject(p.id)}
                      className="text-[11px] font-black text-[#087FC1] hover:text-[#075080] cursor-pointer"
                    >
                      BUKA PROYEK
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">PROYEK SAAT INI</span>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => exportProjectToJson(p)}
                      className="p-2 text-[#64798B] hover:text-[#087FC1] rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
                      title="Unduh Backup JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {allProjects.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus proyek "${p.name}"?`)) {
                            onDeleteProject(p.id);
                          }
                        }}
                        className="p-2 text-rose-500 hover:text-rose-700 rounded-xl hover:bg-rose-50 cursor-pointer transition-all"
                        title="Hapus Proyek"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Version Logs */}
      <div className="glass-surface rounded-3xl border border-white/60 p-6 shadow-md space-y-6">
        <h3 className="font-black text-[#173B57] uppercase tracking-wider text-sm flex items-center">
          <Clock className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
          Riwayat Versi Dokumen Proyek Aktif
        </h3>

        <div className="overflow-x-auto border border-white/60 rounded-2xl shadow-inner">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-[#1A3A5C] text-white">
              <tr>
                <th className="p-4 font-black">DOKUMEN</th>
                <th className="p-4 font-black text-center">VERSI</th>
                <th className="p-4 font-black">STATUS</th>
                <th className="p-4 font-black">DIPERBARUI</th>
                <th className="p-4 font-black">CATATAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/40">
              {docTypes.map((t) => {
                const doc = currentProject.documents[t];
                return (
                  <tr key={t} className="hover:bg-white/80 transition-colors">
                    <td className="p-4 font-black text-[#173B57]">{t}</td>
                    <td className="p-4 text-center font-black text-[#087FC1] bg-cyan-50/50">
                      v{doc.version}
                    </td>
                    <td className="p-4">
                      {doc.status === 'completed' ? (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          BERHASIL
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Belum dibuat</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-[#64798B]">
                      {new Date(doc.updatedAt).toLocaleString('id-ID')}
                    </td>
                    <td className="p-4 font-medium text-[#173B57] italic">
                      {doc.changelog || 'Inisialisasi sistem'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
