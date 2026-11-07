import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  FileText,
  Activity,
  Search,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

export function PlatformAdminConsole() {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'institutions' | 'users' | 'memberships' | 'audit'>('stats');
  const [stats, setStats] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Institution Modal
  const [showNewInstModal, setShowNewInstModal] = useState(false);
  const [newInstForm, setNewInstForm] = useState({
    npsn: '',
    namaResmi: '',
    namaSingkat: '',
    jenjang: 'MA',
    kabupatenKota: '',
    provinsi: 'D.I. Yogyakarta',
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Get CSRF token first
      const csrfRes = await fetch('/api/auth/csrf');
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken;

      const headers = { 'X-CSRF-Token': csrfToken };

      if (activeSubTab === 'stats') {
        const res = await fetch('/api/platform/stats', { headers });
        const data = await res.json();
        if (data.success) setStats(data.stats);
        else setErrorMsg(data.error);
      } else if (activeSubTab === 'institutions') {
        const res = await fetch(`/api/platform/institutions?search=${encodeURIComponent(searchQuery)}`, { headers });
        const data = await res.json();
        if (data.success) setInstitutions(data.institutions);
        else setErrorMsg(data.error);
      } else if (activeSubTab === 'users') {
        const res = await fetch(`/api/platform/users?search=${encodeURIComponent(searchQuery)}`, { headers });
        const data = await res.json();
        if (data.success) setUsers(data.users);
        else setErrorMsg(data.error);
      } else if (activeSubTab === 'memberships') {
        const res = await fetch('/api/platform/memberships', { headers });
        const data = await res.json();
        if (data.success) setMemberships(data.memberships);
        else setErrorMsg(data.error);
      } else if (activeSubTab === 'audit') {
        const res = await fetch('/api/platform/audit-logs', { headers });
        const data = await res.json();
        if (data.success) setAuditLogs(data.logs);
        else setErrorMsg(data.error);
      }
    } catch (err: any) {
      setErrorMsg('Gagal memuat data platform admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab, searchQuery]);

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Yakin ingin ${currentStatus ? 'menonaktifkan' : 'mengaktifkan'} pengguna ini?`)) return;
    try {
      const csrfRes = await fetch('/api/auth/csrf');
      const csrfData = await csrfRes.json();

      const res = await fetch(`/api/platform/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Status pengguna berhasil diperbarui.');
        fetchData();
      } else {
        setErrorMsg(data.error);
      }
    } catch {
      setErrorMsg('Gagal mengubah status pengguna.');
    }
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const csrfRes = await fetch('/api/auth/csrf');
      const csrfData = await csrfRes.json();

      const res = await fetch('/api/platform/institutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        body: JSON.stringify(newInstForm),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Institusi baru berhasil didaftarkan.');
        setShowNewInstModal(false);
        setNewInstForm({ npsn: '', namaResmi: '', namaSingkat: '', jenjang: 'MA', kabupatenKota: '', provinsi: 'D.I. Yogyakarta' });
        fetchData();
      } else {
        setErrorMsg(data.error);
      }
    } catch {
      setErrorMsg('Gagal mendaftarkan institusi.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Admin Header Banner */}
      <div className="glass-surface rounded-3xl p-8 text-white shadow-md border border-white/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 text-cyan-200 text-[10px] font-black uppercase tracking-widest mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Platform Super Admin Control Center</span>
          </div>
          <h2 className="text-2xl font-black text-[#173B57]">EduTaktis Global Administration</h2>
          <p className="text-[#64798B] text-xs mt-2 font-medium max-w-2xl">
            Manajemen terpusat seluruh institusi madrasah, direktori pengguna global, keanggotaan lintas tenant, dan log audit keamanan.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-6 py-3 rounded-2xl text-[11px] font-black bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-sm text-[#173B57]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>MUAT ULANG DATA</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 glass-surface p-2.5 rounded-3xl shadow-md border border-white/60">
        {[
          { id: 'stats', icon: Activity, label: 'Statistik Platform' },
          { id: 'institutions', icon: Building2, label: 'Manajemen Institusi' },
          { id: 'users', icon: Users, label: 'Direktori Pengguna' },
          { id: 'memberships', icon: Sliders, label: 'Keanggotaan & Peran' },
          { id: 'audit', icon: FileText, label: 'Log Audit Platform' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-black transition-all cursor-pointer ${
              activeSubTab === tab.id ? 'bg-[#075080] text-white shadow-md' : 'text-[#64798B] hover:bg-white/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT: STATS */}
      {activeSubTab === 'stats' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Total Institusi', val: stats.totalInstitutions, icon: Building2, color: 'text-blue-600' },
            { label: 'Total Pengguna', val: stats.totalUsers, icon: Users, color: 'text-indigo-600' },
            { label: 'Total Proyek', val: stats.totalProjects, icon: FileText, color: 'text-cyan-600' },
            { label: 'Log Audit', val: stats.totalAuditLogs, icon: Activity, color: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className="glass-surface p-6 rounded-3xl border border-white/60 shadow-md space-y-3">
              <div className="flex items-center justify-between text-[#64798B]">
                <span className="text-[10px] font-black uppercase tracking-wider">{s.label}</span>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-black text-[#173B57]">{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: INSTITUTIONS */}
      {activeSubTab === 'institutions' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari NPSN, Nama, atau Kota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowNewInstModal(true)}
              className="bg-[#477F9D] hover:bg-[#3b6c86] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Daftarkan Institusi Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#DDF3FC] text-[#173B57] font-black uppercase tracking-wider">
                  <th className="p-4">NPSN & Nama Institusi</th>
                  <th className="p-4">Jenjang</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4">Anggota</th>
                  <th className="p-4">Proyek</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/40">
                {institutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-[#F1F9FC]">
                    <td className="p-4">
                      <p className="font-black text-[#173B57]">{inst.namaResmi}</p>
                      <p className="text-[10px] text-[#64798B] font-mono">NPSN: {inst.npsn}</p>
                    </td>
                    <td className="p-4 font-bold text-[#173B57]">{inst.jenjang}</td>
                    <td className="p-4 text-[#64798B] font-medium">{inst.kabupatenKota}, {inst.provinsi}</td>
                    <td className="p-4 font-black text-[#087FC1]">{inst._count?.memberships || 0}</td>
                    <td className="p-4 font-black text-[#075080]">{inst._count?.projects || 0}</td>
                    <td className="p-4 text-right">
                      <span className="text-[10px] font-black text-[#087FC1] hover:underline cursor-pointer uppercase">Detail</span>
                    </td>
                  </tr>
                ))}
                {institutions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#64798B] font-medium">
                      Tidak ada institusi ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: USERS */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari nama, email, atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#DDF3FC] text-[#173B57] font-black uppercase tracking-wider">
                  <th className="p-4">Pengguna</th>
                  <th className="p-4">NIP / NUPTK</th>
                  <th className="p-4">Status Akun</th>
                  <th className="p-4">Institusi</th>
                  <th className="p-4 text-right">Kontrol Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/40">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F1F9FC]">
                    <td className="p-4">
                      <p className="font-black text-[#173B57]">{u.namaLengkap}</p>
                      <p className="text-[10px] text-[#64798B] font-medium">{u.email}</p>
                    </td>
                    <td className="p-4 font-mono text-[#173B57] font-bold">{u.nip || '-'}</td>
                    <td className="p-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                          <CheckCircle className="w-3 h-3 mr-1.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider">
                          <XCircle className="w-3 h-3 mr-1.5" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-[#173B57]">{u._count?.memberships || 0} Terdaftar</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] cursor-pointer transition-all ${
                          u.isActive
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                        }`}
                      >
                        {u.isActive ? 'NONAKTIFKAN' : 'AKTIFKAN'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MEMBERSHIPS */}
      {activeSubTab === 'memberships' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Daftar Hubungan Pengguna dan Institusi</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#DDF3FC] text-[#173B57] font-black uppercase tracking-wider">
                  <th className="p-4">Pengguna</th>
                  <th className="p-4">Institusi</th>
                  <th className="p-4">Peran (Role)</th>
                  <th className="p-4">Status Keanggotaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/40">
                {memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F1F9FC]">
                    <td className="p-4">
                      <p className="font-black text-[#173B57]">{m.user?.namaLengkap}</p>
                      <p className="text-[10px] text-[#64798B] font-medium">{m.user?.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-[#173B57]">{m.institution?.namaResmi}</p>
                      <p className="text-[10px] text-[#64798B] font-mono font-bold">NPSN: {m.institution?.npsn}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full bg-[#EAF5FC] text-[#087FC1] font-black text-[10px] border border-[#DCEAF2] uppercase tracking-wider">
                        {m.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider border ${
                        m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Log Aktivitas Keamanan & Administratif Platform</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#DDF3FC] text-[#173B57] font-black uppercase tracking-wider">
                  <th className="p-4">Waktu</th>
                  <th className="p-4">Aksi</th>
                  <th className="p-4">Sumber Daya</th>
                  <th className="p-4">Detail</th>
                  <th className="p-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/40 font-mono text-[10px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F1F9FC]">
                    <td className="p-4 text-[#64798B]">{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                    <td className="p-4 font-black text-[#087FC1]">{log.action}</td>
                    <td className="p-4 font-bold text-[#173B57]">{log.resource}</td>
                    <td className="p-4 text-[#64798B] max-w-xs truncate">{JSON.stringify(log.details || {})}</td>
                    <td className="p-4 text-[#64798B]">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW INSTITUTION MODAL */}
      {showNewInstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4">
          <div className="glass-surface w-full max-w-lg rounded-3xl p-8 border border-white/60 shadow-2xl space-y-6">
            <h3 className="text-base font-black text-[#173B57]">Daftarkan Institusi Madrasah Baru</h3>
            <form onSubmit={handleCreateInstitution} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-[#64798B] mb-2 uppercase text-[10px]">NPSN</label>
                <input
                  type="text"
                  required
                  value={newInstForm.npsn}
                  onChange={(e) => setNewInstForm({ ...newInstForm, npsn: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#087FC1] text-[#173B57] font-semibold"
                  placeholder="Contoh: 20400999"
                />
              </div>
              <div>
                <label className="block font-black text-[#64798B] mb-2 uppercase text-[10px]">Nama Resmi Madrasah</label>
                <input
                  type="text"
                  required
                  value={newInstForm.namaResmi}
                  onChange={(e) => setNewInstForm({ ...newInstForm, namaResmi: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#087FC1] text-[#173B57] font-semibold"
                  placeholder="Contoh: MAN 2 Yogyakarta"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-black text-[#64798B] mb-2 uppercase text-[10px]">Jenjang</label>
                  <select
                    value={newInstForm.jenjang}
                    onChange={(e) => setNewInstForm({ ...newInstForm, jenjang: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#087FC1] text-[#173B57] font-black"
                  >
                    <option value="MI">MI</option>
                    <option value="MTs">MTs</option>
                    <option value="MA">MA</option>
                    <option value="MAK">MAK</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black text-[#64798B] mb-2 uppercase text-[10px]">Kabupaten / Kota</label>
                  <input
                    type="text"
                    required
                    value={newInstForm.kabupatenKota}
                    onChange={(e) => setNewInstForm({ ...newInstForm, kabupatenKota: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#087FC1] text-[#173B57] font-semibold"
                    placeholder="Contoh: Yogyakarta"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewInstModal(false)}
                  className="px-6 py-3 rounded-xl border border-slate-200 text-[#173B57] font-black hover:bg-slate-50 cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#075080] to-[#087FC1] text-white font-black hover:from-[#087FC1] hover:to-[#075080] cursor-pointer shadow-md"
                >
                  SIMPAN INSTITUSI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
