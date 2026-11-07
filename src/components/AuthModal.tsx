import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  School,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  KeyRound,
  ShieldAlert,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { login, register, requestPasswordReset, AuthUser } from '../services/authClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  initialTab?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialTab = 'login',
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(initialTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regNama, setRegNama] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGelarBelakang, setRegGelarBelakang] = useState('');
  const [regNip, setRegNip] = useState('');
  const [regNpsn, setRegNpsn] = useState('20400012'); // default MAN 1 Gunungkidul NPSN

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResult, setForgotResult] = useState<string | null>(null);

  // Common UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await login(loginEmail, loginPassword);
      if (res.success && res.user) {
        setSuccessMessage('Login berhasil! Mengalihkan sesi...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
          onClose();
        }, 500);
      } else {
        setErrorMessage(res.error || 'Login gagal. Periksa kembali email dan password Anda.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await register({
        namaLengkap: regNama,
        email: regEmail,
        password: regPassword,
        gelarBelakang: regGelarBelakang || undefined,
        nip: regNip || undefined,
        npsn: regNpsn || undefined,
      });

      if (res.success && res.user) {
        setSuccessMessage('Pendaftaran berhasil! Sesi telah dibuat.');
        setTimeout(() => {
          onLoginSuccess(res.user!);
          onClose();
        }, 600);
      } else {
        setErrorMessage(res.error || 'Pendaftaran gagal.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await requestPasswordReset(forgotEmail);
      setForgotResult(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill helper for testing standard seed accounts
  const quickFill = (email: string) => {
    setLoginEmail(email);
    setLoginPassword('EduTaktis2025!');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A3A5C] via-[#0F766E] to-[#1A3A5C] p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1 pb-1">
            <div className="flex items-center bg-white/10 p-2 rounded-xl border border-white/20 shadow-sm">
              <img
                src="/edutaktis-logo.png"
                alt="EduTaktis - AI, Teknologi, Sains & Pengetahuan"
                className="h-9 w-auto object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-teal-100 tracking-wide">Autentikasi & Keamanan Multi-Tenant</p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex mt-4 bg-black/20 p-1 rounded-xl">
            <button
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'login' ? 'bg-white text-teal-900 shadow-xs' : 'text-teal-100 hover:text-white'
              }`}
            >
              Masuk (Login)
            </button>
            <button
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'register' ? 'bg-white text-teal-900 shadow-xs' : 'text-teal-100 hover:text-white'
              }`}
            >
              Daftar Akun
            </button>
            <button
              onClick={() => {
                setTab('forgot');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'forgot' ? 'bg-white text-teal-900 shadow-xs' : 'text-teal-100 hover:text-white'
              }`}
            >
              Lupa Password
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email Akun Madrasah
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="nama.guru@kemenag.go.id"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setTab('forgot')}
                    className="text-[11px] text-teal-600 hover:text-teal-800 cursor-pointer font-medium"
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-[#1A3A5C] text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Argon2id...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Akun</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick Fill Testing Box */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-2">
                  Akun Uji Coba Cepat (Password:{' '}
                  <code className="text-teal-700 bg-teal-50 px-1 rounded">EduTaktis2025!</code>):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => quickFill('pandu.kusumahadi@kemenag.go.id')}
                    className="text-left p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-[11px] cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800">Pandu Kusumahadi</div>
                    <div className="text-slate-500 text-[10px]">Guru (MAN 1 GK)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickFill('kholis.muhajir@kemenag.go.id')}
                    className="text-left p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-[11px] cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800">H. Kholis Muhajir</div>
                    <div className="text-slate-500 text-[10px]">Kepala Madrasah</div>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap (tanpa gelar) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regNama}
                    onChange={(e) => setRegNama(e.target.value)}
                    placeholder="Contoh: Muhammad Ihsan"
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Gelar Belakang
                  </label>
                  <input
                    type="text"
                    value={regGelarBelakang}
                    onChange={(e) => setRegGelarBelakang(e.target.value)}
                    placeholder="S.Pd., M.Pd."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    NIP / PegID
                  </label>
                  <input
                    type="text"
                    value={regNip}
                    onChange={(e) => setRegNip(e.target.value)}
                    placeholder="1985..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Kemenag / Madrasah *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="guru@kemenag.go.id"
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min. 8 karakter, huruf besar & angka) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPSN Madrasah / Sekolah
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={regNpsn}
                    onChange={(e) => setRegNpsn(e.target.value)}
                    placeholder="20400012 (MAN 1 Gunungkidul)"
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Akun publik otomatis ditetapkan sebagai peran <strong>GURU (TEACHER)</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <span>Daftar Akun Guru</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD */}
          {tab === 'forgot' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-0.5">Pemberitahuan Transparansi Infrastruktur:</strong>
                  Layanan pengiriman email SMTP sedang dalam proses penyetelan pada server VPS Hostinger. Permintaan token reset akan dicatat secara kriptografis pada audit log server.
                </div>
              </div>

              {forgotResult ? (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900">
                  <p>{forgotResult}</p>
                  <button
                    onClick={() => {
                      setTab('login');
                      setForgotResult(null);
                    }}
                    className="mt-3 text-teal-700 font-semibold hover:underline text-xs"
                  >
                    Kembali ke halaman login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Email Terdaftar
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nama.guru@kemenag.go.id"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses Token...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Kirim Permintaan Reset</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
