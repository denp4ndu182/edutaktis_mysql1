import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Plus,
  Download,
  User,
  School,
  Users,
  LogOut,
  LogIn,
  Menu,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Project, TenantContext } from '../types';

export type AppTabType =
  | 'dashboard'
  | 'master_input'
  | 'ai_tools'
  | 'history'
  | 'user_profile'
  | 'institution_profile'
  | 'membership'
  | 'platform_admin';

interface NavbarProps {
  currentProject: Project;
  allProjects: Project[];
  activeTab: AppTabType;
  setActiveTab: (tab: AppTabType) => void;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  isSaved: boolean;
  onExportJson: () => void;
  tenantContext?: TenantContext;
  isAuthenticated?: boolean;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  children?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProject,
  allProjects,
  activeTab,
  setActiveTab,
  onSwitchProject,
  onNewProject,
  isSaved,
  onExportJson,
  tenantContext,
  isAuthenticated = false,
  onOpenAuthModal,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const isSuperAdmin =
    tenantContext?.userInstitutions?.some(
      (ui) => ui.membership.role === 'SUPER_ADMIN' && ui.membership.status === 'ACTIVE'
    ) || tenantContext?.currentMembership?.role === 'SUPER_ADMIN';

  const menuItems: { id: AppTabType; label: string; icon: any; desc: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: FolderKanban, desc: 'Ringkasan & status 6 dokumen' },
    { id: 'master_input', label: 'Master Input', icon: BookOpen, desc: 'Identitas madrasah & kurikulum' },
    { id: 'ai_tools', label: 'AI Tools (6 Dokumen)', icon: Sparkles, desc: 'Generator AI KBC & Modul' },
    { id: 'history', label: 'Proyek & Cadangan', icon: FileSpreadsheet, desc: 'Manajemen file & arsip proyek' },
    { id: 'user_profile', label: 'Profil Guru', icon: User, desc: 'Identitas & preferensi pengampu' },
    { id: 'institution_profile', label: 'Profil Institusi', icon: School, desc: 'Data resmi madrasah' },
    { id: 'membership', label: 'Keanggotaan', icon: Users, desc: 'Peran & hak akses tenant' },
    ...(isSuperAdmin
      ? [
          {
            id: 'platform_admin' as AppTabType,
            label: 'Platform Console',
            icon: ShieldAlert,
            desc: 'Super Admin Global Control',
          },
        ]
      : []),
  ];

  const getPageTitle = (tab: AppTabType) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard Utama';
      case 'master_input':
        return 'Master Input Kurikulum & Madrasah';
      case 'ai_tools':
        return 'Generator Administrasi AI (6 Dokumen)';
      case 'history':
        return 'Manajemen Proyek & Cadangan';
      case 'user_profile':
        return 'Profil Pengguna & Guru';
      case 'institution_profile':
        return 'Profil Institusi Madrasah';
      case 'membership':
        return 'Keanggotaan & Multi-Tenant';
      case 'platform_admin':
        return 'Platform Admin Console (Super Admin)';
      default:
        return 'Dashboard EduTaktis';
    }
  };

  const handleNavClick = (tab: AppTabType) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans flex flex-row selection:bg-cyan-200 w-full">
      {/* SIDEBAR DESKTOP — SOFT OCEAN BLUE-CYAN */}
      <aside className="hidden lg:flex flex-col w-[270px] sidebar-ocean text-white shrink-0 min-h-screen sticky top-0 z-30">
        {/* Logo Container (Directly on Sidebar, No Glow/Box) */}
        <div className="p-5 bg-transparent border-b border-white/20 flex flex-col items-center justify-center text-center">
          <div className="w-full py-2 px-1 flex items-center justify-center">
            <img
              src="/edutaktis-logo.png"
              alt="EduTaktis - AI, Teknologi, Sains & Pengetahuan"
              className="max-h-14 w-auto object-contain filter drop-shadow-md brightness-105"
            />
          </div>
          <span className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-cyan-100 bg-white/20 px-3 py-1 rounded-full border border-white/30 shadow-2xs">
            Kemenag RI • KBC SaaS
          </span>
        </div>

        {/* Vertical Menu Navigation */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-extrabold tracking-wider text-white/80 uppercase mb-2">
            Menu Utama SaaS
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer text-left group relative ${
                  isActive
                    ? 'bg-white/25 text-white shadow-md backdrop-blur-xs translate-x-1 border border-white/30'
                    : 'text-white/95 hover:bg-white/15 hover:text-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    isActive ? 'bg-white/30 text-white' : 'bg-white/15 text-white group-hover:bg-white/25'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.label}</p>
                  <p className={`text-[10px] truncate font-normal ${isActive ? 'text-cyan-100' : 'text-white/75'}`}>
                    {item.desc}
                  </p>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer / Tenant Info */}
        <div className="p-4 bg-white/15 backdrop-blur-md border-t border-white/20 space-y-2.5 shadow-inner">
          {tenantContext && (
            <div className="text-[11px] space-y-1">
              <div className="flex items-center text-white font-extrabold truncate">
                <School className="w-3.5 h-3.5 mr-1.5 shrink-0 text-cyan-200" />
                <span className="truncate">{tenantContext.currentInstitution.namaSingkat}</span>
              </div>
              <p className="text-white/90 text-[10px] font-medium truncate">
                {tenantContext.currentUser.namaLengkap}
              </p>
            </div>
          )}
          <div className="text-[10px] text-cyan-100 font-semibold text-center border-t border-white/20 pt-2">
            EduTaktis SaaS v2.5 • Soft Ocean
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-xs">
          <div className="w-[280px] sidebar-ocean text-white flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 bg-transparent border-b border-white/20 flex items-center justify-between">
              <img
                src="/edutaktis-logo.png"
                alt="EduTaktis"
                className="h-9 w-auto object-contain filter drop-shadow-md brightness-105"
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white/25 text-white shadow-xs border border-white/30'
                        : 'text-white/95 hover:bg-white/15'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/30 text-white' : 'bg-white/15 text-white'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* RIGHT MAIN CONTAINER (HEADER + CHILDREN + FOOTER) */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        {/* TOP CONTENT HEADER — PREMIUM OCEAN GLASS LIGHT HEADER */}
        <header className="sticky top-0 z-25 bg-white/85 backdrop-blur-md text-[#173B57] px-4 sm:px-6 py-3.5 shadow-xs border-b border-[#DCEAF2]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Left: Mobile Toggle & Page Title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded">
                    Kemenag RI
                  </span>
                  <span className="text-xs text-slate-400">/</span>
                  <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                    {getPageTitle(activeTab)}
                  </h1>
                </div>
              </div>
            </div>

            {/* Middle: Project Switcher */}
            <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-[#DCEAF2] shadow-2xs">
              <span className="text-[11px] text-slate-600 font-medium pl-2 hidden sm:inline">Proyek:</span>
              <select
                value={currentProject.id}
                onChange={(e) => onSwitchProject(e.target.value)}
                className="bg-white text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-teal-500 max-w-[180px] sm:max-w-[220px] truncate"
              >
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onNewProject}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
                title="Buat Proyek Baru"
              >
                <Plus className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            {/* Right: Actions, Storage Status, User */}
            <div className="flex items-center space-x-3 text-xs">
              {isSaved ? (
                <span className="hidden md:inline-flex items-center text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Tersimpan
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center text-amber-800 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[11px] animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Belum Disimpan
                </span>
              )}

              <button
                onClick={onExportJson}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-[#DCEAF2] px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                title="Backup Proyek JSON"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Backup</span>
              </button>

              {isAuthenticated && tenantContext ? (
                <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                  <button
                    onClick={() => setActiveTab('user_profile')}
                    className="flex items-center space-x-1.5 text-slate-700 hover:text-teal-700 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                      {tenantContext.currentUser.namaLengkap.charAt(0)}
                    </div>
                    <span className="hidden xl:inline font-semibold text-xs text-slate-800">
                      {tenantContext.currentUser.namaLengkap}
                    </span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Keluar"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="bg-[#087FC1] hover:bg-[#075080] text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <LogIn className="w-3.5 h-3.5 text-white" />
                  <span>Masuk</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* MAIN VIEW CHILDREN CONTAINER */}
        <div className="flex-1">
          {children}
        </div>

        {/* FOOTER */}
        <footer className="no-print bg-white border-t border-[#E2E8F0] py-6 text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="font-bold text-[#0F172A]">
                Generator Administrasi Guru KBC AI • Kementerian Agama RI
              </p>
              <p className="text-[11px] text-slate-500">
                Integrasi Kurikulum Merdeka, Kurikulum Berbasis Cinta (KBC), dan Profil Pelajar Rahmatan lil 'Alamin (PPRA).
              </p>
            </div>

            <div className="flex items-center space-x-3 text-[11px] font-semibold text-blue-700">
              <span>Ta'addub</span>
              <span>•</span>
              <span>Qudwah</span>
              <span>•</span>
              <span>Tawāzun</span>
              <span>•</span>
              <span>Tathawwur wa Ibtikār</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
