import React, { useState } from 'react';
import {
  School,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  ShieldAlert,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { InstitutionProfile, TenantContext, InstitutionRole } from '../types';
import { canEditInstitution } from '../services/tenantService';

interface InstitutionProfileViewProps {
  tenantContext: TenantContext;
  onSaveInstitutionProfile: (institution: InstitutionProfile, callerRole: InstitutionRole) => {
    success: boolean;
    error?: string;
  };
  onApplyToMasterInput?: () => void;
}

export const InstitutionProfileView: React.FC<InstitutionProfileViewProps> = ({
  tenantContext,
  onSaveInstitutionProfile,
  onApplyToMasterInput,
}) => {
  const currentRole = tenantContext.currentMembership.role;
  const isEditable = canEditInstitution(currentRole);

  const [institution, setInstitution] = useState<InstitutionProfile>(
    tenantContext.currentInstitution
  );
  const [savedToast, setSavedToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (field: keyof InstitutionProfile, value: any) => {
    if (!isEditable) return;
    setInstitution((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;

    const result = onSaveInstitutionProfile(institution, currentRole);
    if (result.success) {
      setErrorMessage(null);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3500);
    } else {
      setErrorMessage(result.error || 'Gagal menyimpan profil institusi.');
    }
  };

  const getRoleBadge = (role: InstitutionRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'SCHOOL_ADMIN':
        return { label: 'Admin Madrasah', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'HEADMASTER':
        return { label: 'Kepala Madrasah', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'TEACHER':
        return { label: 'Guru / Pendidik', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'OPERATOR':
        return { label: 'Operator Madrasah', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: role, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleBadge = getRoleBadge(currentRole);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner (Premium Ocean Glass) */}
      <div className="glass-surface rounded-3xl p-6 border border-white/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#075080] via-[#087FC1] to-[#168FCB] text-white flex items-center justify-center shrink-0 shadow-md">
            <School className="w-7 h-7 text-cyan-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h2 className="text-xl font-extrabold text-[#173B57]">
                Profil Institusi / Madrasah
              </h2>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border shadow-2xs ${roleBadge.color}`}>
                Peran: {roleBadge.label}
              </span>
            </div>
            <p className="text-xs text-[#64798B] mt-1 font-medium leading-relaxed">
              Data resmi satuan pendidikan. Informasi institusi dibagikan kepada seluruh guru yang tergabung di madrasah ini untuk memastikan keseragaman identitas dokumen.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onApplyToMasterInput && (
            <button
              type="button"
              onClick={onApplyToMasterInput}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-50/90 text-[#075080] border border-cyan-200/90 hover:bg-cyan-100 transition-all flex items-center cursor-pointer shadow-2xs hover:-translate-y-0.5"
              title="Perbarui Master Input dengan data institusi aktif"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-[#087FC1]" />
              Terapkan ke Master Input
            </button>
          )}
        </div>
      </div>

      {/* Role Access Indicator Banner */}
      {!isEditable ? (
        <div className="p-4.5 bg-amber-50/90 backdrop-blur-md border border-amber-200/90 rounded-2xl text-amber-900 text-xs flex items-start space-x-3.5 shadow-sm">
          <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-amber-950 flex items-center">
              Mode Akses Baca Saja (Read-Only) — Hak Akses Guru
            </p>
            <p className="text-amber-800 mt-0.5 leading-relaxed">
              Sebagai <strong>Guru ({tenantContext.currentUser.namaLengkap})</strong>, Anda berhak melihat dan memakai data identitas madrasah ini dalam penyusunan dokumen, namun <strong>tidak dapat menyunting profil institusi</strong>. Penyuntingan hanya dapat dilakukan oleh Kepala Madrasah atau Administrator Sekolah demi konsistensi data satu pintu.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4.5 bg-emerald-50/90 backdrop-blur-md border border-emerald-200/90 rounded-2xl text-emerald-900 text-xs flex items-start space-x-3.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-[#159B79] shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-emerald-950 flex items-center">
              Mode Pengelola Institusi Aktif (Hak Akses Penuh)
            </p>
            <p className="text-emerald-800 mt-0.5 leading-relaxed">
              Anda masuk dengan peran <strong>{roleBadge.label}</strong>. Anda memiliki otoritas penuh untuk memperbarui data satuan pendidikan, kepala madrasah, dan alamat institusi. Perubahan akan berlaku untuk seluruh administrasi guru.
            </p>
          </div>
        </div>
      )}

      {savedToast && (
        <div className="p-4 bg-emerald-50/90 backdrop-blur-md border border-emerald-200/90 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <span className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2.5 text-[#159B79] shrink-0" />
            Profil institusi madrasah berhasil diperbarui dan tersimpan di sistem!
          </span>
          <span className="text-[11px] bg-emerald-200/60 px-2.5 py-1 rounded-full text-emerald-900 font-bold">
            Tersimpan
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50/90 backdrop-blur-md border border-rose-200/90 rounded-2xl text-rose-900 text-xs font-semibold flex items-center justify-between shadow-sm">
          <span className="flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2.5 text-rose-600 shrink-0" />
            {errorMessage}
          </span>
        </div>
      )}

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="glass-surface rounded-3xl p-6 sm:p-7 shadow-xl border border-white/80 space-y-6">
        {/* Section 1: Identitas Pokok Madrasah */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <Building className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Identitas Pokok Satuan Pendidikan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Nama Resmi Satuan Pendidikan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isEditable}
                value={institution.namaResmi}
                onChange={(e) => handleChange('namaResmi', e.target.value)}
                placeholder="Contoh: Madrasah Aliyah Negeri 1 Gunungkidul"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] font-bold focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Nama Singkat / Panggilan
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.namaSingkat}
                onChange={(e) => handleChange('namaSingkat', e.target.value)}
                placeholder="Contoh: MAN 1 Gunungkidul"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed font-medium"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Jenjang Pendidikan
              </label>
              <select
                disabled={!isEditable}
                value={institution.jenjang}
                onChange={(e) => handleChange('jenjang', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
              >
                <option value="MI">Madrasah Ibtidaiyah (MI)</option>
                <option value="MTs">Madrasah Tsanawiyah (MTs)</option>
                <option value="MA">Madrasah Aliyah (MA)</option>
                <option value="MAK">Madrasah Aliyah Kejuruan (MAK)</option>
                <option value="SD">Sekolah Dasar (SD)</option>
                <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                <option value="SMA">Sekolah Menengah Atas (SMA)</option>
                <option value="SMK">Sekolah Menengah Kejuruan (SMK)</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Status / Jenis Institusi
              </label>
              <select
                disabled={!isEditable}
                value={institution.jenisInstitusi}
                onChange={(e) => handleChange('jenisInstitusi', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold"
              >
                <option value="Negeri">Negeri</option>
                <option value="Swasta">Swasta</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                NPSN (Nomor Pokok Sekolah Nasional)
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.npsn}
                onChange={(e) => handleChange('npsn', e.target.value)}
                placeholder="Contoh: 20400012 (8 digit)"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] font-mono focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-12">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Kantor Kementerian Agama / Dinas Pendidikan / Yayasan
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.kementerianDinas}
                onChange={(e) => handleChange('kementerianDinas', e.target.value)}
                placeholder="Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Alamat & Lokasi */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <MapPin className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Alamat & Lokasi Institusi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-12">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Alamat Jalan & Nomor
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.alamatLengkap}
                onChange={(e) => handleChange('alamatLengkap', e.target.value)}
                placeholder="Jl. KH. Agus Salim No. 65, Ledoksari"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Kelurahan / Desa
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.kelurahanDesa}
                onChange={(e) => handleChange('kelurahanDesa', e.target.value)}
                placeholder="Kepek"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Kecamatan / Kapanewon
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.kecamatan}
                onChange={(e) => handleChange('kecamatan', e.target.value)}
                placeholder="Wonosari"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Kabupaten / Kota
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.kabupatenKota}
                onChange={(e) => handleChange('kabupatenKota', e.target.value)}
                placeholder="Kab. Gunungkidul"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Provinsi & Kode Pos
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  disabled={!isEditable}
                  value={institution.provinsi}
                  onChange={(e) => handleChange('provinsi', e.target.value)}
                  placeholder="D.I. Yogyakarta"
                  className="w-full text-xs px-2.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  disabled={!isEditable}
                  value={institution.kodePos}
                  onChange={(e) => handleChange('kodePos', e.target.value)}
                  placeholder="55813"
                  className="w-full text-xs px-2.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Kontak Resmi */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <Phone className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Saluran Komunikasi Resmi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center">
                <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Telepon Kantor
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.telepon}
                onChange={(e) => handleChange('telepon', e.target.value)}
                placeholder="(0274) 391032"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Email Madrasah
              </label>
              <input
                type="email"
                disabled={!isEditable}
                value={institution.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="madrasah@kemenag.go.id"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-[#173B57] mb-1.5 flex items-center">
                <Globe className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Website Resmi
              </label>
              <input
                type="url"
                disabled={!isEditable}
                value={institution.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://man1gunungkidul.sch.id"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Pimpinan & Pengesahan Dokumen */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-[#173B57] flex items-center border-b border-slate-200/60 pb-2.5">
            <UserCheck className="w-4.5 h-4.5 mr-2 text-[#087FC1]" />
            Kepala Madrasah / Pejabat Pengesah Dokumen
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Nama Kepala Madrasah (Lengkap Gelar)
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.namaKepala}
                onChange={(e) => handleChange('namaKepala', e.target.value)}
                placeholder="Contoh: H. Kholis Muhajir, S.Ag., M.S.I."
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] font-bold focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                NIP Kepala Madrasah
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.nipKepala}
                onChange={(e) => handleChange('nipKepala', e.target.value)}
                placeholder="Contoh: 197505122003121003"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] font-mono focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#173B57] mb-1.5">
                Kota Tempat Tanda Tangan
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={institution.kotaTandaTangan}
                onChange={(e) => handleChange('kotaTandaTangan', e.target.value)}
                placeholder="Contoh: Gunungkidul"
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200/80 bg-white/90 rounded-xl text-[#173B57] focus:ring-2 focus:ring-[#087FC1]/20 focus:border-[#087FC1] focus:outline-hidden transition-all shadow-2xs disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Metadata Institusi */}
        <div className="bg-slate-50/70 backdrop-blur-xs rounded-2xl p-4 border border-slate-200/80 text-xs text-[#64798B] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <span className="font-extrabold text-[#173B57]">Institution ID:</span>{' '}
            <code className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono text-[#173B57] shadow-2xs">
              {institution.id}
            </code>
          </div>
          <div>
            <span className="font-extrabold text-[#173B57]">Terakhir Diperbarui:</span>{' '}
            <span className="font-medium">{new Date(institution.updatedAt).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Action Button */}
        {isEditable && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#075080] to-[#087FC1] hover:from-[#087FC1] hover:to-[#168FCB] text-white transition-all flex items-center shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <Save className="w-4 h-4 mr-2 text-cyan-200" />
              Simpan Profil Institusi
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
