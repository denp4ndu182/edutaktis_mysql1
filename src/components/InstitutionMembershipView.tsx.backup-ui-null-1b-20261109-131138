import React from 'react';
import {
  Users,
  School,
  CheckCircle2,
  ArrowRightLeft,
  ShieldCheck,
  Building,
  UserCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { TenantContext, InstitutionRole } from '../types';

interface InstitutionMembershipViewProps {
  tenantContext: TenantContext;
  onSwitchActiveInstitution: (institutionId: string) => void;
  onSwitchActiveUser: (userId: string) => void;
  availableUsers: Array<{
    id: string;
    namaLengkap: string;
    email: string;
    gelarBelakang?: string;
  }>;
}

export const InstitutionMembershipView: React.FC<InstitutionMembershipViewProps> = ({
  tenantContext,
  onSwitchActiveInstitution,
  onSwitchActiveUser,
  availableUsers,
}) => {
  const { currentUser, currentMembership, currentInstitution, userInstitutions } = tenantContext;

  const getRoleBadge = (role: InstitutionRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'SCHOOL_ADMIN':
        return { label: 'Admin Madrasah', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'HEADMASTER':
        return { label: 'Kepala Madrasah', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'TEACHER':
        return { label: 'Guru / Pendidik', color: 'bg-teal-100 text-teal-800 border-teal-200' };
      case 'OPERATOR':
        return { label: 'Operator Madrasah', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      default:
        return { label: role, color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const activeRoleBadge = getRoleBadge(currentMembership.role);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="glass-surface rounded-3xl border border-white/60 p-8 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#087FC1] to-[#075080] text-white flex items-center justify-center shrink-0 shadow-lg">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-black text-[#173B57]">
                Keanggotaan Institusi & Multi-Tenant
              </h2>
              <span className="bg-[#EAF5FC] text-[#087FC1] text-[10px] font-black px-3 py-1 rounded-full border border-[#DCEAF2] uppercase tracking-wider">
                Multi-School Context
              </span>
            </div>
            <p className="text-xs text-[#64798B] font-medium mt-2 max-w-2xl">
              Kelola afiliasi madrasah tempat Anda bertugas. Sistem mendukung guru yang mengajar di lebih dari satu madrasah (lintas satker) dengan isolasi data penuh tanpa kebocoran antar institusi.
            </p>
          </div>
        </div>
      </div>

      {/* Active Tenant Context Card */}
      <div className="glass-surface rounded-3xl border border-white/60 p-8 shadow-md text-[#173B57]">
        <div className="flex items-center justify-between border-b border-[#DCEAF2] pb-5 mb-5">
          <span className="text-[11px] font-black tracking-wider uppercase text-[#075080] flex items-center">
            <ShieldCheck className="w-4 h-4 mr-2 text-[#087FC1]" />
            Konteks Tenant Aktif Saat Ini
          </span>
          <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">
            STATUS: {currentMembership.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider">Pengguna Aktif (Guru)</span>
            <p className="text-sm font-black text-[#173B57]">
              {currentUser.namaLengkap}
              {currentUser.gelarBelakang ? `, ${currentUser.gelarBelakang}` : ''}
            </p>
            <p className="text-xs font-bold text-[#087FC1] font-mono">
              NIP: {currentUser.nip || '-'}
            </p>
            <p className="text-xs text-[#64798B] font-medium">{currentUser.email}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider">Institusi / Madrasah Aktif</span>
            <p className="text-sm font-black text-[#173B57]">
              {currentInstitution.namaSingkat || currentInstitution.namaResmi}
            </p>
            <p className="text-xs font-bold text-[#087FC1] mt-0.5">
              NPSN: {currentInstitution.npsn} • {currentInstitution.jenjang}
            </p>
            <p className="text-xs text-[#64798B] font-medium">
              {currentInstitution.kabupatenKota}, {currentInstitution.provinsi}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider">Peran & Hak Akses (RBAC)</span>
            <div>
              <span className={`inline-block text-[11px] font-black px-4 py-1.5 rounded-xl border ${activeRoleBadge.color}`}>
                {activeRoleBadge.label}
              </span>
            </div>
            <p className="text-xs text-[#64798B] font-medium leading-relaxed">
              {currentMembership.role === 'TEACHER'
                ? 'Hak akses menyusun administrasi & melihat profil madrasah.'
                : 'Hak akses penuh mengelola profil institusi dan kurikulum.'}
            </p>
          </div>
        </div>
      </div>

      {/* List of User's Institutions */}
      <div className="glass-surface rounded-3xl border border-white/60 p-8 shadow-md space-y-6">
        <div>
          <h3 className="text-sm font-black text-[#173B57] uppercase tracking-wider flex items-center">
            <School className="w-5 h-5 mr-3 text-[#087FC1]" />
            Daftar Institusi Terdaftar
          </h3>
          <p className="text-xs text-[#64798B] font-medium mt-1">
            Pilih institusi aktif untuk mengarahkan Master Input dan dokumen baru ke satuan pendidikan tersebut.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {userInstitutions.map(({ institution, membership }) => {
            const isActive = institution.id === currentInstitution.id;
            const roleBadge = getRoleBadge(membership.role);

            return (
              <div
                key={institution.id}
                className={`p-6 rounded-3xl border transition-all ${
                  isActive
                    ? 'border-[#087FC1] bg-white shadow-lg'
                    : 'border-[#DCEAF2] bg-white/60 hover:border-[#087FC1]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#EAF5FC] text-[#075080] text-[10px] font-black px-3 py-1 rounded-full border border-[#DCEAF2]">
                        {institution.jenjang}
                      </span>
                      <h4 className="text-sm font-black text-[#173B57]">
                        {institution.namaSingkat}
                      </h4>
                    </div>
                    <p className="text-xs font-medium text-[#173B57] mt-2">{institution.namaResmi}</p>
                    <p className="text-[11px] text-[#64798B] font-medium mt-0.5">
                      NPSN: {institution.npsn} • {institution.kabupatenKota}
                    </p>
                  </div>

                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border shrink-0 ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>

                <div className="mt-6 pt-5 border-t border-[#DCEAF2] flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#64798B]">
                    Kepala: <strong className="text-[#173B57]">{institution.namaKepala}</strong>
                  </span>

                  {isActive ? (
                    <span className="inline-flex items-center text-[11px] font-black text-[#159B79] bg-[#DDF7EC] px-4 py-2 rounded-xl border border-[#B3E5D4]">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-[#159B79]" />
                      AKTIF
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchActiveInstitution(institution.id)}
                      className="px-5 py-2.5 rounded-xl text-[11px] font-black bg-gradient-to-r from-[#075080] to-[#087FC1] text-white hover:from-[#087FC1] hover:to-[#075080] transition-all flex items-center cursor-pointer shadow-md"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
                      PILIH INSTITUSI
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Server-Verified Security & Session Status */}
      <div className="glass-surface rounded-3xl border border-white/60 p-8 shadow-md space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-[#173B57] uppercase tracking-wider flex items-center">
              <ShieldCheck className="w-5 h-5 mr-3 text-[#159B79]" />
              Keamanan Sesi & Otorisasi Server-Side
            </h3>
            <p className="text-xs text-[#64798B] font-medium mt-1">
              Identitas pengguna dan peran institusi diverifikasi langsung oleh backend. Simulasi pergantian identitas di frontend dinonaktifkan.
            </p>
          </div>
          <span className="text-[10px] font-black bg-[#DDF7EC] text-[#159B79] px-3 py-1.5 rounded-full border border-[#B3E5D4] uppercase tracking-wider shrink-0">
            RBAC TERPROTEKSI
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl border border-[#DCEAF2] bg-white">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider block mb-2">
              Otentikasi Kredensial
            </span>
            <div className="text-xs font-black text-[#159B79] flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              ARGON2ID HASH
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#DCEAF2] bg-white">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider block mb-2">
              Token Sesi
            </span>
            <div className="text-xs font-black text-[#087FC1] flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              SHA-256 (HTTPONLY)
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#DCEAF2] bg-white">
            <span className="text-[10px] font-black text-[#64798B] uppercase tracking-wider block mb-2">
              Isolasi Tenant
            </span>
            <div className="text-xs font-black text-[#075080] flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              DATABASE ENFORCED
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#EAF5FC] border border-[#DCEAF2] rounded-2xl text-[#075080] text-xs font-bold flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 text-[#087FC1] shrink-0" />
          <span>
            Untuk berpindah pengguna, gunakan tombol <strong>Keluar (Logout)</strong> pada bilah atas dan masuk dengan kredensial akun yang bersangkutan.
          </span>
        </div>
      </div>
    </div>
  );
};
