import React, { useState } from 'react';
import {
  User,
  Save,
  CheckCircle2,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  CreditCard,
  BookOpen,
} from 'lucide-react';
import { UserProfile, TenantContext } from '../types';
import { formatFullTeacherName } from '../services/tenantService';

interface UserProfileViewProps {
  tenantContext: TenantContext;
  onSaveUserProfile: (profile: UserProfile) => void;
  onApplyToMasterInput?: () => void;
  onLogout?: () => void;
  onLogoutAll?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  tenantContext,
  onSaveUserProfile,
  onApplyToMasterInput,
  onLogout,
  onLogoutAll,
}) => {
  const [profile, setProfile] = useState<UserProfile>(tenantContext.currentUser);
  const [savedToast, setSavedToast] = useState(false);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUserProfile(profile);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  };

  const previewFullName = formatFullTeacherName(profile);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner (Premium Ocean Glass) */}
      <div className="glass-surface rounded-3xl p-6 border border-white/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#075080] via-[#087FC1] to-[#168FCB] text-white flex items-center justify-center shrink-0 shadow-md">
            <User className="w-7 h-7 text-cyan-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-extrabold text-[#173B57]">Profil Pribadi Guru</h2>
              <span className="bg-cyan-50 text-[#075080] text-xs font-extrabold px-3 py-1 rounded-full border border-cyan-200">
                User Profile
              </span>
            </div>
            <p className="text-xs text-[#64798B] mt-1 font-medium">
              Data identitas pribadi guru penyusun. Informasi ini bersifat terpisah dari institusi madrasah dan otomatis menjadi pengisi identitas penyusun pada dokumen administrasi.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onApplyToMasterInput && (
            <button
              type="button"
              onClick={onApplyToMasterInput}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-50/90 text-[#075080] border border-cyan-200/90 hover:bg-cyan-100 transition-all flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
              title="Perbarui Master Input dengan data profil ini"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-[#087FC1]" />
              Terapkan ke Master Input
            </button>
          )}
        </div>
      </div>

      {savedToast && (
        <div className="p-4 bg-emerald-50/90 backdrop-blur-md border border-emerald-200/90 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2.5 text-[#159B79] shrink-0" />
            Profil pribadi guru berhasil disimpan! Perubahan tersimpan di profil perangkat Anda dan tersinkronisasi dengan proyek aktif.
          </span>
          <span className="text-[11px] bg-emerald-200/60 px-2.5 py-1 rounded-full text-emerald-900 font-bold">
            Tersimpan
          </span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="glass-surface rounded-3xl p-6 sm:p-7 shadow-xl border border-white/80 space-y-6">
        {/* Name Preview Badge */}
        <div className="bg-gradient-to-r from-cyan-50/90 via-blue-50/80 to-teal-50/70 backdrop-blur-md border border-cyan-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <span className="text-[11px] font-extrabold tracking-wider text-[#075080] uppercase">
              Format Nama Resmi Guru Penandatangan
            </span>
            <p className="text-lg font-black text-[#173B57] mt-0.5">
              {previewFullName || '(Nama guru belum diisi)'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              NIP: <span className="font-mono">{profile.nip || '-'}</span> • NUPTK: <span className="font-mono">{profile.nuptk || '-'}</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-white/90 px-3.5 py-1.5 rounded-xl border border-teal-200 text-xs text-teal-800 font-bold self-start sm:self-auto shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#159B79]" />
            <span>Terverifikasi Lokal</span>
          </div>
        </div>

        {/* Section 1: Nama & Gelar */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <GraduationCap className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Nama Lengkap & Gelar Akademik
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Gelar Depan
              </label>
              <input
                type="text"
                value={profile.gelarDepan || ''}
                onChange={(e) => handleChange('gelarDepan', e.target.value)}
                placeholder="Contoh: Dra., Dr., Drs., H."
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Kosongkan jika tidak ada</span>
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Nama Lengkap (Tanpa Gelar) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.namaLengkap}
                onChange={(e) => handleChange('namaLengkap', e.target.value)}
                placeholder="Contoh: Pandu Kusumahadi"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] font-bold focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Gelar Belakang
              </label>
              <input
                type="text"
                value={profile.gelarBelakang || ''}
                onChange={(e) => handleChange('gelarBelakang', e.target.value)}
                placeholder="Contoh: S.Kom, M.Pd."
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Gunakan koma jika jamak</span>
            </div>
          </div>
        </div>

        {/* Section 2: Identitas Kepegawaian */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <CreditCard className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Identitas Kepegawaian & Kemenag
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                NIP (Nomor Induk Pegawai)
              </label>
              <input
                type="text"
                value={profile.nip}
                onChange={(e) => handleChange('nip', e.target.value)}
                placeholder="Contoh: 198703252023211023 (18 digit) atau strip (-)"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Guru Non-PNS/PPPK dapat mengisi tanda strip (-)</span>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                NUPTK / PegID Simpatika
              </label>
              <input
                type="text"
                value={profile.nuptk || ''}
                onChange={(e) => handleChange('nuptk', e.target.value)}
                placeholder="Contoh: 4239765666130122 (16 digit)"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Nomor Pendidik resmi Kemenag / Kemendikbud</span>
            </div>
          </div>
        </div>

        {/* Section 3: Kontak & Preferensi Mengajar */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <BookOpen className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Kontak & Preferensi Mata Pelajaran
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Email Pribadi / Dinas
              </label>
              <input
                type="email"
                required
                value={profile.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="guru@kemenag.go.id"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center">
                <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={profile.nomorTelepon || ''}
                onChange={(e) => handleChange('nomorTelepon', e.target.value)}
                placeholder="081234567890"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 block">
                Preferensi Mata Pelajaran
              </label>
              <input
                type="text"
                value={profile.preferensiMataPelajaran}
                onChange={(e) => handleChange('preferensiMataPelajaran', e.target.value)}
                placeholder="Contoh: Koding dan Kecerdasan Artifisial"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Mata pelajaran utama yang Anda ampu</span>
            </div>
          </div>
        </div>

        {/* Section 4: System ID & Metadata */}
        <div className="bg-slate-50/70 backdrop-blur-xs rounded-2xl p-4 border border-slate-200/80 text-xs text-[#64798B] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <span className="font-extrabold text-[#173B57]">User ID Sistem:</span>{' '}
            <code className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono text-[#173B57] shadow-2xs">
              {profile.id}
            </code>
          </div>
          <div>
            <span className="font-extrabold text-[#173B57]">Terakhir Diperbarui:</span>{' '}
            <span className="font-medium">{new Date(profile.updatedAt).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all flex items-center shadow-md hover:-translate-y-0.5 cursor-pointer"
          >
            <Save className="w-4 h-4 mr-2 text-cyan-200" />
            Simpan Profil Guru
          </button>
        </div>
      </form>

      {/* Section 5: Keamanan Akun & Manajemen Sesi */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7 shadow-xl border border-white/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-[#075080] border border-teal-200 shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#087FC1]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#173B57]">Keamanan Akun & Sesi Aktif</h3>
              <p className="text-xs text-[#64798B] mt-0.5 font-medium">
                Otentikasi terenkripsi Argon2id & token sesi HttpOnly tersimpan dalam format hash SHA-256.
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-emerald-50 text-[#159B79] font-extrabold px-3 py-1 rounded-full border border-emerald-200/80 shadow-2xs shrink-0">
            Aktif & Terlindungi
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-2xs space-y-3">
            <span className="text-xs font-extrabold text-[#173B57] block">
              Sesi Perangkat Saat Ini
            </span>
            <p className="text-xs text-[#64798B] leading-relaxed">
              Keluar dari sesi peramban ini. Cookie HttpOnly akan dibersihkan secara aman dari perangkat Anda.
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-[#173B57] hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
            >
              Keluar dari Sesi Ini
            </button>
          </div>

          <div className="p-4.5 rounded-2xl border border-rose-200/80 bg-rose-50/50 shadow-2xs space-y-3">
            <span className="text-xs font-extrabold text-rose-900 block">
              Cabut Semua Sesi (Logout All Devices)
            </span>
            <p className="text-xs text-rose-700 leading-relaxed">
              Putuskan seluruh koneksi akun Anda di seluruh komputer, laptop, dan ponsel yang pernah login.
            </p>
            <button
              type="button"
              onClick={onLogoutAll}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-sm"
            >
              Cabut Seluruh Sesi Perangkat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
