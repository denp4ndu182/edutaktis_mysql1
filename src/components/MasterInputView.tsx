import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  Sparkles,
  School,
  BookOpen,
  Heart,
  Calendar,
  Paperclip,
  Plus,
  Trash2,
  Copy,
  Eye,
  CheckCircle2,
  Upload,
  FileCheck,
  UserCheck,
  Info,
  BookmarkCheck,
  X,
} from 'lucide-react';
import { MasterInputData, ElemenCP, PpraValue, AttachmentFile, UserProfile, TenantContext } from '../types';
import { DEFAULT_MASTER_INPUT, isDemoIdentity } from '../services/defaultData';

interface MasterInputViewProps {
  data: MasterInputData;
  onChange: (updated: MasterInputData) => void;
  onSave: () => void;
  onReset: () => void;
  onDuplicateProject: () => void;
  onFillExample: () => void;
  isSaved: boolean;
  userProfile?: UserProfile | null;
  onSaveUserProfile?: (profile: UserProfile) => void;
  onApplyUserProfile?: () => void;
  tenantContext?: TenantContext;
  onSyncTenantContext?: () => void;
}

export const MasterInputView: React.FC<MasterInputViewProps> = ({
  data,
  onChange,
  onSave,
  onReset,
  onDuplicateProject,
  onFillExample,
  isSaved,
  userProfile,
  onSaveUserProfile,
  onApplyUserProfile,
  tenantContext,
  onSyncTenantContext,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'identitas' | 'kurikulum' | 'kbc' | 'kalender' | 'pendukung'>('identitas');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // Field change helper
  const handleFieldChange = (field: keyof MasterInputData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  // Elemen CP handlers
  const handleAddElemen = () => {
    const newEl: ElemenCP = {
      id: `el-${Date.now()}`,
      kode: `EL-${data.elemenCP.length + 1}`,
      nama: 'Elemen Baru',
      deskripsi: 'Deskripsi Capaian Pembelajaran untuk elemen ini...',
    };
    handleFieldChange('elemenCP', [...data.elemenCP, newEl]);
  };

  const handleUpdateElemen = (index: number, key: keyof ElemenCP, val: string) => {
    const list = [...data.elemenCP];
    list[index] = { ...list[index], [key]: val };
    handleFieldChange('elemenCP', list);
  };

  const handleRemoveElemen = (index: number) => {
    const list = data.elemenCP.filter((_, i) => i !== index);
    handleFieldChange('elemenCP', list);
  };

  // PPRA handlers
  const handleTogglePpra = (id: string) => {
    const updated = data.ppraValues.map((v) => (v.id === id ? { ...v, terpilih: !v.terpilih } : v));
    handleFieldChange('ppraValues', updated);
  };

  const handlePpraNoteChange = (id: string, note: string) => {
    const updated = data.ppraValues.map((v) => (v.id === id ? { ...v, catatan: note } : v));
    handleFieldChange('ppraValues', updated);
  };

  // Panca Cinta toggle
  const handleTogglePancaCinta = (key: keyof MasterInputData['pancaCinta']) => {
    handleFieldChange('pancaCinta', {
      ...data.pancaCinta,
      [key]: !data.pancaCinta[key],
    });
  };

  // Kalender calculation helpers
  const handleKalenderChange = (semester: 'sem1' | 'sem2', index: number, field: string, val: any) => {
    const listKey = semester === 'sem1' ? 'kalenderSemester1' : 'kalenderSemester2';
    const list = [...data[listKey]];
    const item = { ...list[index], [field]: val };

    if (field === 'mingguKalender' || field === 'mingguTidakEfektif') {
      const cal = field === 'mingguKalender' ? Number(val) : item.mingguKalender;
      const unef = field === 'mingguTidakEfektif' ? Number(val) : item.mingguTidakEfektif;
      item.mingguEfektif = Math.max(0, cal - unef);
      item.jp = item.mingguEfektif * (data.jpPerMinggu || 2);
    }

    list[index] = item;
    handleFieldChange(listKey, list);
  };

  // File upload simulation
  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentFile[] = Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      uploadDate: new Date().toISOString().split('T')[0],
    }));

    handleFieldChange('attachments', [...data.attachments, ...newAttachments]);
  };

  const handleRemoveAttachment = (id: string) => {
    handleFieldChange(
      'attachments',
      data.attachments.filter((a) => a.id !== id)
    );
  };

  const triggerSave = () => {
    onSave();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  // Calculate totals
  const totalMingguEfektifSem1 = data.kalenderSemester1.reduce((acc, curr) => acc + curr.mingguEfektif, 0);
  const totalMingguEfektifSem2 = data.kalenderSemester2.reduce((acc, curr) => acc + curr.mingguEfektif, 0);
  const totalJPSem1 = data.kalenderSemester1.reduce((acc, curr) => acc + curr.jp, 0);
  const totalJPSem2 = data.kalenderSemester2.reduce((acc, curr) => acc + curr.jp, 0);
  const totalMingguTahun = totalMingguEfektifSem1 + totalMingguEfektifSem2;
  const totalJPTahun = totalJPSem1 + totalJPSem2;

  return (
    <div className="space-y-6 pb-16">
      {/* Action Bar Header (Premium Ocean Glass) */}
      <div className="glass-surface rounded-3xl p-5 border border-white/60 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-[#173B57] flex items-center">
            <BookOpen className="w-5 h-5 mr-2.5 text-[#087FC1]" />
            Modul Master Input Administrasi Pembelajaran
          </h2>
          <p className="text-xs text-[#64798B] font-medium">
            Isi formulir terstruktur satu kali untuk mendanai pembuatan 6 dokumen terintegrasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onFillExample}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-50/90 text-[#075080] border border-cyan-200/90 hover:bg-cyan-100 transition-all duration-200 flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
            title="Isi contoh demonstrasi KBC Koding & AI"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-[#087FC1]" />
            Isi Contoh Administrasi
          </button>

          <button
            onClick={triggerSave}
            className="px-4.5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all duration-200 flex items-center shadow-md cursor-pointer hover:-translate-y-0.5"
          >
            <Save className="w-4 h-4 mr-1.5 text-cyan-200" />
            Simpan Data
          </button>

          <button
            onClick={() => setShowSummaryModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/90 text-[#173B57] border border-slate-200 hover:bg-slate-50 transition-all duration-200 flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
          >
            <Eye className="w-4 h-4 mr-1.5 text-[#075080]" />
            Lihat Data
          </button>

          <button
            onClick={onDuplicateProject}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/90 text-[#173B57] border border-slate-200 hover:bg-slate-50 transition-all duration-200 flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
            title="Duplikasi Proyek Ini"
          >
            <Copy className="w-4 h-4 mr-1.5 text-[#075080]" />
            Duplikasi
          </button>

          <button
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50/90 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all duration-200 flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
            title="Reset Form ke Kosong"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset Form
          </button>
        </div>
      </div>

      {/* Save Notification Toasts */}
      {saveToast && (
        <div className="p-4 bg-emerald-50/90 backdrop-blur-md border border-emerald-200/90 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center">
            <CheckCircle2 className="w-4.5 h-4.5 mr-2.5 text-[#159B79] shrink-0" />
            Data Master Input berhasil disimpan ke sistem! (Data tidak langsung di-generate, menunggu perintah guru).
          </span>
          <span className="text-[11px] bg-emerald-200/60 px-2.5 py-1 rounded-full text-emerald-900 font-bold">
            Aman & Persisten
          </span>
        </div>
      )}

      {profileSavedToast && (
        <div className="p-4 bg-teal-50/90 backdrop-blur-md border border-teal-200/90 rounded-2xl text-teal-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center">
            <BookmarkCheck className="w-4.5 h-4.5 mr-2.5 text-[#087FC1] shrink-0" />
            Identitas madrasah dan guru berhasil disimpan sebagai Profil Default di perangkat ini! Proyek baru akan otomatis menggunakan profil ini.
          </span>
          <span className="text-[11px] bg-teal-200/60 px-2.5 py-1 rounded-full text-teal-900 font-bold">
            Profil Tersimpan
          </span>
        </div>
      )}

      {/* Demo Identity Banner */}
      {isDemoIdentity(data) && (
        <div className="p-4 bg-amber-50/90 backdrop-blur-md border border-amber-200/90 rounded-2xl text-amber-900 text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center space-x-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-extrabold text-amber-950">
                Pemberitahuan: Proyek Menggunakan Identitas Contoh (Demo Bawaan)
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Proyek ini memuat data contoh: <strong>MTs Negeri 1 Kota Yogyakarta</strong> (Guru: <strong>Ahmad Fauzi, S.Kom.</strong>). Anda dapat menggantinya dengan identitas madrasah & guru Anda sendiri.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {userProfile && onApplyUserProfile && (
              <button
                type="button"
                onClick={onApplyUserProfile}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center shadow-xs"
              >
                <UserCheck className="w-4 h-4 mr-1.5" />
                Ganti dengan Profil Saya ({userProfile.namaMadrasah || 'Profil'})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Subtabs (A - E) - Premium Ocean Glass Pill Bar */}
      <div className="flex bg-white/70 backdrop-blur-xl p-1.5 rounded-2xl gap-2 overflow-x-auto shadow-inner border border-[#DCEAF2]">
        <button
          onClick={() => setActiveSubTab('identitas')}
          className={`px-4 py-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center rounded-xl shrink-0 ${
            activeSubTab === 'identitas'
              ? 'bg-gradient-to-r from-[#075080] via-[#087FC1] to-[#168FCB] text-white shadow-md shadow-cyan-500/15'
              : 'bg-white/80 text-[#173B57] hover:bg-cyan-50/60 hover:text-[#087FC1] border border-slate-200/70'
          }`}
        >
          <School className={`w-4 h-4 mr-2 ${activeSubTab === 'identitas' ? 'text-white' : 'text-[#087FC1]'}`} />
          A. Identitas Madrasah
        </button>

        <button
          onClick={() => setActiveSubTab('kurikulum')}
          className={`px-4 py-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center rounded-xl shrink-0 ${
            activeSubTab === 'kurikulum'
              ? 'bg-gradient-to-r from-[#075080] via-[#087FC1] to-[#168FCB] text-white shadow-md shadow-cyan-500/15'
              : 'bg-white/80 text-[#173B57] hover:bg-cyan-50/60 hover:text-[#087FC1] border border-slate-200/70'
          }`}
        >
          <BookOpen className={`w-4 h-4 mr-2 ${activeSubTab === 'kurikulum' ? 'text-white' : 'text-[#087FC1]'}`} />
          B. Data Kurikulum & Elemen CP
        </button>

        <button
          onClick={() => setActiveSubTab('kbc')}
          className={`px-4 py-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center rounded-xl shrink-0 ${
            activeSubTab === 'kbc'
              ? 'bg-gradient-to-r from-[#075080] via-[#087FC1] to-[#168FCB] text-white shadow-md shadow-cyan-500/15'
              : 'bg-white/80 text-[#173B57] hover:bg-cyan-50/60 hover:text-[#087FC1] border border-slate-200/70'
          }`}
        >
          <Heart className={`w-4 h-4 mr-2 ${activeSubTab === 'kbc' ? 'text-white' : 'text-rose-500'}`} />
          C. Integrasi KBC & Nilai PPRA
        </button>

        <button
          onClick={() => setActiveSubTab('kalender')}
          className={`px-4 py-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center rounded-xl shrink-0 ${
            activeSubTab === 'kalender'
              ? 'bg-gradient-to-r from-[#075080] via-[#087FC1] to-[#168FCB] text-white shadow-md shadow-cyan-500/15'
              : 'bg-white/80 text-[#173B57] hover:bg-cyan-50/60 hover:text-[#087FC1] border border-slate-200/70'
          }`}
        >
          <Calendar className={`w-4 h-4 mr-2 ${activeSubTab === 'kalender' ? 'text-white' : 'text-[#24BFD0]'}`} />
          D. Kalender Pendidikan & Jam (JP)
        </button>

        <button
          onClick={() => setActiveSubTab('pendukung')}
          className={`px-4 py-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center rounded-xl shrink-0 ${
            activeSubTab === 'pendukung'
              ? 'bg-gradient-to-r from-[#075080] via-[#087FC1] to-[#168FCB] text-white shadow-md shadow-cyan-500/15'
              : 'bg-white/80 text-[#173B57] hover:bg-cyan-50/60 hover:text-[#087FC1] border border-slate-200/70'
          }`}
        >
          <Paperclip className={`w-4 h-4 mr-2 ${activeSubTab === 'pendukung' ? 'text-white' : 'text-[#087FC1]'}`} />
          E. Dokumen Pendukung ({data.attachments.length})
        </button>
      </div>

      {/* Main Tab Content Card (Glass Surface) */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7 shadow-xl border border-white/80 space-y-6">
        {/* SUBTAB A: IDENTITAS */}
        {activeSubTab === 'identitas' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/60 pb-3.5">
              <h3 className="text-base font-extrabold text-[#173B57]">
                A. Identitas Satuan Pendidikan & Guru Penyusun
              </h3>
              <p className="text-xs text-[#64798B] mt-0.5">
                Data identitas diturunkan secara terpisah dari Profil Pribadi Guru dan Profil Institusi Madrasah untuk menjamin keselarasan dan isolasi multi-tenant.
              </p>
            </div>

            {/* Tenant & Profile Synchronization Banner */}
            <div className="bg-gradient-to-r from-teal-50/90 via-cyan-50/80 to-blue-50/70 backdrop-blur-md border border-teal-200/80 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start space-x-3.5">
                <div className="p-3 bg-[#075080] text-white rounded-xl shadow-xs shrink-0">
                  <UserCheck className="w-5 h-5 text-cyan-200" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <p className="text-xs font-extrabold text-[#173B57]">
                      Integrasi Multi-Tenant: Profil Guru & Institusi Aktif
                    </p>
                    {tenantContext && (
                      <span className="text-[10px] font-extrabold bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full border border-teal-300">
                        {tenantContext.currentInstitution.namaSingkat}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Guru: <strong>{tenantContext ? `${tenantContext.currentUser.namaLengkap}${tenantContext.currentUser.gelarBelakang ? `, ${tenantContext.currentUser.gelarBelakang}` : ''}` : userProfile?.namaGuru || 'Belum Diatur'}</strong>
                    {' • '}
                    Institusi: <strong>{tenantContext ? tenantContext.currentInstitution.namaResmi : userProfile?.namaMadrasah || 'Belum Diatur'}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Klik tombol di samping untuk menyelaraskan isian di bawah dengan data profil aktif saat ini.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {onSyncTenantContext && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Sinkronkan seluruh identitas madrasah dan guru pada Master Input ini dengan profil aktif saat ini?')) {
                        onSyncTenantContext();
                        setProfileSavedToast(true);
                        setTimeout(() => setProfileSavedToast(false), 3000);
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-extrabold bg-[#075080] hover:bg-[#087FC1] text-white rounded-xl transition-all cursor-pointer flex items-center shadow-xs"
                    title="Sinkronkan dengan Profil Guru & Institusi Aktif"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5 text-cyan-200" />
                    Sinkronkan dengan Profil Aktif
                  </button>
                )}

                {onApplyUserProfile && userProfile && !onSyncTenantContext && (
                  <button
                    type="button"
                    onClick={onApplyUserProfile}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-[#173B57] hover:bg-slate-50 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    Muat Profil
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                  <span>Kantor Kementerian Agama / Yayasan</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    Dari Profil Institusi
                  </span>
                </label>
                <input
                  type="text"
                  value={data.kemenagOrYayasan}
                  onChange={(e) => handleFieldChange('kemenagOrYayasan', e.target.value)}
                  placeholder="Kementerian Agama RI / Kantor Kemenag Kota..."
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                  <span>Nama Satuan Pendidikan (Madrasah)</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    Dari Profil Institusi
                  </span>
                </label>
                <input
                  type="text"
                  value={data.namaMadrasah}
                  onChange={(e) => handleFieldChange('namaMadrasah', e.target.value)}
                  placeholder="MTs Negeri 1 Kota Yogyakarta"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                  <span>Alamat Lengkap Madrasah</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    Dari Profil Institusi
                  </span>
                </label>
                <input
                  type="text"
                  value={data.alamatMadrasah}
                  onChange={(e) => handleFieldChange('alamatMadrasah', e.target.value)}
                  placeholder="Jl. Lowanu No. 67, Kec. Umbulharjo, Kota Yogyakarta"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                  <span>Mata Pelajaran</span>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    Dari Preferensi Guru
                  </span>
                </label>
                <input
                  type="text"
                  value={data.mataPelajaran}
                  onChange={(e) => handleFieldChange('mataPelajaran', e.target.value)}
                  placeholder="Koding dan Kecerdasan Artifisial"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Singkatan / Kode Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={data.kodeMapel}
                  onChange={(e) => handleFieldChange('kodeMapel', e.target.value)}
                  placeholder="KBC-AI"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">Fase</label>
                  <select
                    value={data.fase}
                    onChange={(e) => handleFieldChange('fase', e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] transition-all shadow-2xs font-semibold"
                  >
                    <option value="Fase A">Fase A (Kelas I-II)</option>
                    <option value="Fase B">Fase B (Kelas III-IV)</option>
                    <option value="Fase C">Fase C (Kelas V-VI)</option>
                    <option value="Fase D">Fase D (Kelas VII-IX MTs)</option>
                    <option value="Fase E">Fase E (Kelas X MA)</option>
                    <option value="Fase F">Fase F (Kelas XI-XII MA)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">Kelas</label>
                  <input
                    type="text"
                    value={data.kelas}
                    onChange={(e) => handleFieldChange('kelas', e.target.value)}
                    placeholder="Kelas VII (Tujuh)"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    value={data.tahunPelajaran}
                    onChange={(e) => handleFieldChange('tahunPelajaran', e.target.value)}
                    placeholder="2024/2025"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">Semester</label>
                  <input
                    type="text"
                    value={data.semester}
                    onChange={(e) => handleFieldChange('semester', e.target.value)}
                    placeholder="Ganjil dan Genap"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Alokasi Waktu Total (JP / Tahun)
                  </label>
                  <input
                    type="number"
                    value={data.alokasiWaktuTotal}
                    onChange={(e) => handleFieldChange('alokasiWaktuTotal', Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#075080] font-extrabold focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Jumlah JP per Minggu
                  </label>
                  <input
                    type="number"
                    value={data.jpPerMinggu}
                    onChange={(e) => handleFieldChange('jpPerMinggu', Number(e.target.value))}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-extrabold focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Model Pembelajaran Utama
                </label>
                <input
                  type="text"
                  value={data.modelPembelajaran}
                  onChange={(e) => handleFieldChange('modelPembelajaran', e.target.value)}
                  placeholder="Project-Based Learning, Discovery Learning, Problem-Based Learning"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                    <span>Nama Guru Penyusun</span>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Dari Profil Guru
                    </span>
                  </label>
                  <input
                    type="text"
                    value={data.namaGuru}
                    onChange={(e) => handleFieldChange('namaGuru', e.target.value)}
                    placeholder="Pandu Kusumahadi, S.Kom"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-semibold focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                    <span>NIP / NUPTK Guru</span>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Dari Profil Guru
                    </span>
                  </label>
                  <input
                    type="text"
                    value={data.nipGuru}
                    onChange={(e) => handleFieldChange('nipGuru', e.target.value)}
                    placeholder="198703252023211023"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-mono focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                    <span>Nama Kepala Madrasah</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Dari Profil Institusi
                    </span>
                  </label>
                  <input
                    type="text"
                    value={data.namaKepala}
                    onChange={(e) => handleFieldChange('namaKepala', e.target.value)}
                    placeholder="H. Kholis Muhajir, S.Ag., M.S.I."
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-semibold focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                    <span>NIP Kepala Madrasah</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Dari Profil Institusi
                    </span>
                  </label>
                  <input
                    type="text"
                    value={data.nipKepala}
                    onChange={(e) => handleFieldChange('nipKepala', e.target.value)}
                    placeholder="197505122003121003"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-mono focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center justify-between">
                    <span>Kota Penandatanganan</span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Dari Profil Institusi
                    </span>
                  </label>
                  <input
                    type="text"
                    value={data.kotaTandaTangan}
                    onChange={(e) => handleFieldChange('kotaTandaTangan', e.target.value)}
                    placeholder="Gunungkidul"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Tanggal Penandatanganan
                  </label>
                  <input
                    type="text"
                    value={data.tanggalTandaTangan}
                    onChange={(e) => handleFieldChange('tanggalTandaTangan', e.target.value)}
                    placeholder="15 Juli 2024"
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB B: DATA KURIKULUM & ELEMEN CP */}
        {activeSubTab === 'kurikulum' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/60 pb-3.5">
              <h3 className="text-base font-extrabold text-[#173B57]">
                B. Data Kurikulum dan Capaian Pembelajaran (CP)
              </h3>
              <p className="text-xs text-[#64798B] mt-0.5">
                Data rasional, capaian pembelajaran umum, dan penguraian elemen CP resmi dari Kementerian Agama.
              </p>
            </div>

            <div className="space-y-4.5">
              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Kurikulum yang Digunakan
                </label>
                <input
                  type="text"
                  value={data.kurikulum}
                  onChange={(e) => handleFieldChange('kurikulum', e.target.value)}
                  placeholder="Kurikulum Merdeka Madrasah Terintegrasi KBC"
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57] font-bold focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Rasional Mata Pelajaran
                </label>
                <textarea
                  rows={4}
                  value={data.rasionalMapel}
                  onChange={(e) => handleFieldChange('rasionalMapel', e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-3 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all leading-relaxed shadow-2xs"
                  placeholder="Uraikan pentingnya mata pelajaran ini dalam membekali peserta didik madrasah..."
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Capaian Pembelajaran (CP) Umum
                </label>
                <textarea
                  rows={4}
                  value={data.cpUmum}
                  onChange={(e) => handleFieldChange('cpUmum', e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-3 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all leading-relaxed shadow-2xs"
                  placeholder="Capaian pembelajaran pada akhir fase sesuai naskah BSKAP / Kemenag..."
                />
              </div>

              {/* Elemen CP Repeater */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-extrabold text-[#173B57]">
                    Elemen Capaian Pembelajaran (CP) ({data.elemenCP.length} Elemen)
                  </label>
                  <button
                    onClick={handleAddElemen}
                    className="px-3 py-1.5 text-xs font-bold bg-cyan-50 text-[#075080] border border-cyan-200/90 rounded-xl hover:bg-cyan-100 transition-all flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-[#087FC1]" />
                    Tambah Elemen
                  </button>
                </div>

                <div className="space-y-3.5">
                  {data.elemenCP.map((el, idx) => (
                    <div
                      key={el.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-cyan-300 transition-all duration-200 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2.5 flex-1">
                          <input
                            type="text"
                            value={el.kode}
                            onChange={(e) => handleUpdateElemen(idx, 'kode', e.target.value)}
                            placeholder="Kode (mis. BK)"
                            className="w-24 text-xs font-bold uppercase rounded-xl border border-slate-300 p-2 bg-white text-[#075080]"
                          />
                          <input
                            type="text"
                            value={el.nama}
                            onChange={(e) => handleUpdateElemen(idx, 'nama', e.target.value)}
                            placeholder="Nama Elemen (mis. Berpikir Komputasional)"
                            className="flex-1 text-xs font-bold rounded-xl border border-slate-300 p-2 bg-white text-[#173B57]"
                          />
                        </div>

                        <button
                          onClick={() => handleRemoveElemen(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                          title="Hapus elemen ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={el.deskripsi}
                        onChange={(e) => handleUpdateElemen(idx, 'deskripsi', e.target.value)}
                        placeholder="Deskripsi kompetensi capaian pembelajaran elemen..."
                        className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-[#173B57] leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Materi Pokok / Konten Esensial
                </label>
                <textarea
                  rows={3}
                  value={data.materiPokok}
                  onChange={(e) => handleFieldChange('materiPokok', e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-3 text-[#173B57] focus:border-[#087FC1] focus:ring-2 focus:ring-[#087FC1]/20 transition-all shadow-2xs"
                  placeholder="Daftar materi pokok pembelajaran..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Karakteristik Peserta Didik
                  </label>
                  <textarea
                    rows={3}
                    value={data.karakteristikPesertaDidik}
                    onChange={(e) => handleFieldChange('karakteristikPesertaDidik', e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57]"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Model & Pendekatan
                  </label>
                  <textarea
                    rows={3}
                    value={data.modelPendekatan}
                    onChange={(e) => handleFieldChange('modelPendekatan', e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57]"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                    Strategi Asesmen
                  </label>
                  <textarea
                    rows={3}
                    value={data.strategiAsesmen}
                    onChange={(e) => handleFieldChange('strategiAsesmen', e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB C: INTEGRASI KBC & PPRA */}
        {activeSubTab === 'kbc' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/60 pb-3.5">
              <h3 className="text-base font-extrabold text-[#173B57] flex items-center">
                <Heart className="w-5 h-5 mr-2 text-rose-500" />
                C. Integrasi Kurikulum Berbasis Cinta (KBC) dan Nilai PPRA
              </h3>
              <p className="text-xs text-[#64798B] mt-0.5">
                Pilih dan deskripsikan nilai Panca Cinta Kementerian Agama serta 10 Nilai Profil Pelajar Rahmatan lil 'Alamin.
              </p>
            </div>

            {/* Panca Cinta Kemenag */}
            <div className="bg-gradient-to-r from-rose-50/70 to-pink-50/50 rounded-2xl border border-rose-200/80 p-4.5 space-y-3.5 shadow-2xs">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center">
                Panca Cinta Kementerian Agama
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2.5 p-3 bg-white/90 rounded-xl border border-rose-200/80 cursor-pointer hover:border-rose-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={data.pancaCinta.cintaAllahRasul}
                    onChange={() => handleTogglePancaCinta('cintaAllahRasul')}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">1. Cinta Allah dan Rasul</span>
                </label>

                <label className="flex items-center space-x-2.5 p-3 bg-white/90 rounded-xl border border-rose-200/80 cursor-pointer hover:border-rose-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={data.pancaCinta.cintaIlmu}
                    onChange={() => handleTogglePancaCinta('cintaIlmu')}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">2. Cinta Ilmu</span>
                </label>

                <label className="flex items-center space-x-2.5 p-3 bg-white/90 rounded-xl border border-rose-200/80 cursor-pointer hover:border-rose-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={data.pancaCinta.cintaDiriSesama}
                    onChange={() => handleTogglePancaCinta('cintaDiriSesama')}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">3. Cinta Diri dan Sesama</span>
                </label>

                <label className="flex items-center space-x-2.5 p-3 bg-white/90 rounded-xl border border-rose-200/80 cursor-pointer hover:border-rose-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={data.pancaCinta.cintaLingkungan}
                    onChange={() => handleTogglePancaCinta('cintaLingkungan')}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">4. Cinta Lingkungan</span>
                </label>

                <label className="flex items-center space-x-2.5 p-3 bg-white/90 rounded-xl border border-rose-200/80 cursor-pointer hover:border-rose-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    checked={data.pancaCinta.cintaTanahAir}
                    onChange={() => handleTogglePancaCinta('cintaTanahAir')}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-800">5. Cinta Tanah Air</span>
                </label>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                  Uraian Praktik Pembelajaran Panca Cinta
                </label>
                <textarea
                  rows={2}
                  value={data.pancaCinta.catatanPancaCinta}
                  onChange={(e) =>
                    handleFieldChange('pancaCinta', {
                      ...data.pancaCinta,
                      catatanPancaCinta: e.target.value,
                    })
                  }
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-[#173B57]"
                  placeholder="Bagaimana nilai-nilai Panca Cinta diwujudkan dalam aktivitas belajar siswa..."
                />
              </div>
            </div>

            {/* 10 Nilai PPRA */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#173B57]">
                10 Nilai Profil Pelajar Rahmatan lil 'Alamin (PPRA)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {data.ppraValues.map((v) => (
                  <div
                    key={v.id}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                      v.terpilih
                        ? 'border-teal-300 bg-teal-50/60 shadow-xs'
                        : 'border-slate-200/70 bg-slate-50/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={v.terpilih}
                          onChange={() => handleTogglePpra(v.id)}
                          className="rounded text-[#087FC1] focus:ring-[#087FC1] w-4 h-4"
                        />
                        <span className="text-xs font-extrabold text-[#173B57]">{v.nama}</span>
                        <span className="text-xs font-arabic text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-md font-bold">
                          {v.arab}
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">{v.arti}</span>
                    </div>

                    <input
                      type="text"
                      value={v.catatan}
                      onChange={(e) => handlePpraNoteChange(v.id, e.target.value)}
                      placeholder="Penerapan nilai pada mapel..."
                      className="w-full text-[11px] rounded-lg border border-slate-300 p-2 bg-white text-[#173B57]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                Catatan Tambahan Suasana Pembelajaran KBC
              </label>
              <textarea
                rows={2}
                value={data.catatanKBC}
                onChange={(e) => handleFieldChange('catatanKBC', e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[#173B57]"
                placeholder="Catatan atmosfer belajar berbasis kasih sayang dan tanpa kecemasan..."
              />
            </div>
          </div>
        )}

        {/* SUBTAB D: KALENDER PENDIDIKAN */}
        {activeSubTab === 'kalender' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/60 pb-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#173B57]">
                  D. Data Kalender Pendidikan dan Alokasi Jam Pembelajaran (JP)
                </h3>
                <p className="text-xs text-[#64798B] mt-0.5">
                  Kalender ini menjadi dasar perhitungan otomatis minggu efektif untuk dokumen PROTA dan PROSEM.
                </p>
              </div>

              {/* Total Live Indicator (Ocean Glass Style) */}
              <div className="flex items-center space-x-3.5 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/90 px-4 py-2 rounded-2xl shadow-2xs">
                <div className="text-right">
                  <p className="text-[10px] text-[#075080] font-bold uppercase tracking-wider">Total Minggu Efektif</p>
                  <p className="text-xs font-black text-[#173B57] tabular-nums">{totalMingguTahun} Minggu</p>
                </div>
                <div className="h-7 w-px bg-cyan-200" />
                <div className="text-right">
                  <p className="text-[10px] text-[#075080] font-bold uppercase tracking-wider">Total JP Terhitung</p>
                  <p className="text-xs font-black text-[#087FC1] tabular-nums">{totalJPTahun} JP</p>
                </div>
              </div>
            </div>

            {/* Semester 1 Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#173B57] uppercase tracking-wider">
                  Semester 1 (Ganjil) — Juli s/d Desember
                </h4>
                <span className="text-xs font-bold text-[#075080] tabular-nums">
                  Subtotal: {totalMingguEfektifSem1} Minggu Efektif ({totalJPSem1} JP)
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#075080] text-white">
                    <tr>
                      <th className="p-3 font-bold">Bulan</th>
                      <th className="p-3 text-center font-bold">Minggu Kalender</th>
                      <th className="p-3 text-center font-bold">Minggu Tdk Efektif</th>
                      <th className="p-3 text-center font-bold">Minggu Efektif</th>
                      <th className="p-3 text-center font-bold">Jam (JP)</th>
                      <th className="p-3 font-bold">Keterangan / Kegiatan Tidak Efektif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.kalenderSemester1.map((b, i) => (
                      <tr key={b.bulan} className="table-row-hover transition-colors">
                        <td className="p-2.5 font-bold text-[#173B57]">{b.bulan}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={b.mingguKalender}
                            onChange={(e) =>
                              handleKalenderChange('sem1', i, 'mingguKalender', e.target.value)
                            }
                            className="w-16 text-center rounded-lg border border-slate-300 p-1 font-bold text-[#173B57] tabular-nums"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={b.mingguTidakEfektif}
                            onChange={(e) =>
                              handleKalenderChange('sem1', i, 'mingguTidakEfektif', e.target.value)
                            }
                            className="w-16 text-center rounded-lg border border-slate-300 p-1 font-bold text-[#173B57] tabular-nums"
                          />
                        </td>
                        <td className="p-2.5 text-center font-black text-[#087FC1] bg-cyan-50/50 tabular-nums">
                          {b.mingguEfektif}
                        </td>
                        <td className="p-2.5 text-center font-black text-[#075080] bg-cyan-50/50 tabular-nums">
                          {b.jp}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={b.keterangan}
                            onChange={(e) =>
                              handleKalenderChange('sem1', i, 'keterangan', e.target.value)
                            }
                            placeholder="Kegiatan..."
                            className="w-full rounded-lg border border-slate-300 p-1.5 text-[11px] text-[#173B57]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Semester 2 Table */}
            <div className="space-y-2.5 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#173B57] uppercase tracking-wider">
                  Semester 2 (Genap) — Januari s/d Juni
                </h4>
                <span className="text-xs font-bold text-[#075080] tabular-nums">
                  Subtotal: {totalMingguEfektifSem2} Minggu Efektif ({totalJPSem2} JP)
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#075080] text-white">
                    <tr>
                      <th className="p-3 font-bold">Bulan</th>
                      <th className="p-3 text-center font-bold">Minggu Kalender</th>
                      <th className="p-3 text-center font-bold">Minggu Tdk Efektif</th>
                      <th className="p-3 text-center font-bold">Minggu Efektif</th>
                      <th className="p-3 text-center font-bold">Jam (JP)</th>
                      <th className="p-3 font-bold">Keterangan / Kegiatan Tidak Efektif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.kalenderSemester2.map((b, i) => (
                      <tr key={b.bulan} className="table-row-hover transition-colors">
                        <td className="p-2.5 font-bold text-[#173B57]">{b.bulan}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={b.mingguKalender}
                            onChange={(e) =>
                              handleKalenderChange('sem2', i, 'mingguKalender', e.target.value)
                            }
                            className="w-16 text-center rounded-lg border border-slate-300 p-1 font-bold text-[#173B57] tabular-nums"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            value={b.mingguTidakEfektif}
                            onChange={(e) =>
                              handleKalenderChange('sem2', i, 'mingguTidakEfektif', e.target.value)
                            }
                            className="w-16 text-center rounded-lg border border-slate-300 p-1 font-bold text-[#173B57] tabular-nums"
                          />
                        </td>
                        <td className="p-2.5 text-center font-black text-[#087FC1] bg-cyan-50/50 tabular-nums">
                          {b.mingguEfektif}
                        </td>
                        <td className="p-2.5 text-center font-black text-[#075080] bg-cyan-50/50 tabular-nums">
                          {b.jp}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={b.keterangan}
                            onChange={(e) =>
                              handleKalenderChange('sem2', i, 'keterangan', e.target.value)
                            }
                            placeholder="Kegiatan..."
                            className="w-full rounded-lg border border-slate-300 p-1.5 text-[11px] text-[#173B57]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB E: DOKUMEN PENDUKUNG */}
        {activeSubTab === 'pendukung' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/60 pb-3.5">
              <h3 className="text-base font-extrabold text-[#173B57]">
                E. Unggah Dokumen Pendukung & Referensi Pembelajaran
              </h3>
              <p className="text-xs text-[#64798B] mt-0.5">
                Fasilitas upload dokumen Capaian Pembelajaran, Kalender Pendidikan Madrasah, dan dokumen referensi (PDF, DOCX, DOC, XLSX, JPG, PNG).
              </p>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-[#087FC1] rounded-3xl p-8 text-center bg-cyan-50/30 hover:bg-cyan-50/60 transition-all duration-200 cursor-pointer relative group shadow-2xs">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                onChange={handleSimulatedFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-100 text-[#087FC1] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-extrabold text-[#173B57]">
                Klik atau seret file dokumen pendukung ke sini
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Format yang diterima: PDF, DOCX, DOC, XLSX, dan Gambar (Maks 15 MB)
              </p>
            </div>

            {/* Attachment List */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#173B57]">
                File Terlampir ({data.attachments.length})
              </h4>
              {data.attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada file pendukung diunggah.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {data.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="p-3.5 bg-white/90 rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 bg-teal-50 rounded-xl text-[#075080] shrink-0">
                          <FileCheck className="w-5 h-5 text-[#087FC1]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#173B57] truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {(file.size / 1024).toFixed(0)} KB • Diunggah {file.uploadDate}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveAttachment(file.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary View Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-surface rounded-3xl max-w-2xl w-full p-6 sm:p-7 max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h3 className="font-extrabold text-[#173B57] text-base">Ringkasan Master Input</h3>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2.5 text-[#173B57] leading-relaxed">
              <p>
                <strong>Madrasah:</strong> {data.namaMadrasah}
              </p>
              <p>
                <strong>Mata Pelajaran:</strong> {data.mataPelajaran} ({data.fase} / {data.kelas})
              </p>
              <p>
                <strong>Guru Pengampu:</strong> {data.namaGuru} (NIP. {data.nipGuru})
              </p>
              <p>
                <strong>Kepala Madrasah:</strong> {data.namaKepala} (NIP. {data.nipKepala})
              </p>
              <p>
                <strong>Total Alokasi Waktu:</strong> {data.alokasiWaktuTotal} JP ({data.jpPerMinggu}{' '}
                JP/Minggu)
              </p>
              <p>
                <strong>Elemen CP:</strong> {data.elemenCP.map((e) => e.nama).join(', ')}
              </p>
              <p>
                <strong>Nilai PPRA Terpilih:</strong>{' '}
                {data.ppraValues
                  .filter((v) => v.terpilih)
                  .map((v) => v.nama)
                  .join(', ')}
              </p>
              <p>
                <strong>Total Kalender Efektif:</strong> {totalMingguTahun} Minggu ({totalJPTahun} JP)
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
