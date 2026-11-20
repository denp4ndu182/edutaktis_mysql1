import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { resetPassword } from '../services/authClient';

export const ResetPasswordView: React.FC = () => {
  const [token] = useState(() =>
    new URLSearchParams(window.location.search).get('token') || ''
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (value: string): string => {
    if (value.length < 8) return 'Password minimal 8 karakter.';
    if (!/[A-Z]/.test(value)) return 'Password harus memiliki huruf besar.';
    if (!/[a-z]/.test(value)) return 'Password harus memiliki huruf kecil.';
    if (!/[0-9]/.test(value)) return 'Password harus memiliki angka.';
    return '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Token reset tidak ditemukan. Silakan minta tautan reset baru.');
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmation) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);

      if (!result.success) {
        setError(result.error || result.message || 'Reset gagal. Tautan mungkin kedaluwarsa atau sudah digunakan.');
        return;
      }

      setSuccess(true);
      window.history.replaceState({}, document.title, '/reset-password');
      setPassword('');
      setConfirmation('');
    } catch {
      setError('Terjadi kesalahan jaringan. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#EAF4FA] via-[#F5FAFC] to-[#DDEFF4] flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header — konsisten dengan AuthModal */}
        <div className="bg-gradient-to-r from-[#1A3A5C] via-[#0F766E] to-[#1A3A5C] p-5 text-white relative">
          <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1 pb-1">
            <div className="flex items-center bg-white/10 p-2 rounded-xl border border-white/20 shadow-sm">
              <img
                src="/edutaktis-logo.png"
                alt="EduTaktis - AI, Teknologi, Sains & Pengetahuan"
                className="h-9 w-auto object-contain"
              />
            </div>
            <p className="text-xs font-medium text-teal-100 tracking-wide">
              Autentikasi & Keamanan Multi-Tenant
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-7">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 text-teal-700 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Atur Ulang Password</h1>
          <p className="text-sm text-slate-500 mt-2">
            Buat password baru untuk mengamankan akun EduTaktis Anda.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
            <p className="text-sm text-teal-800">
              Password berhasil diperbarui. Silakan masuk menggunakan password baru.
            </p>
            <a href="/" className="block w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white py-3 font-semibold text-sm">
              Kembali ke halaman utama
            </a>
          </div>
        ) : !token ? (
          <div className="space-y-4 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-700">
              Token reset tidak ditemukan. Silakan minta tautan reset password yang baru.
            </p>
            <a href="/" className="text-sm text-teal-700 font-semibold hover:underline">
              Kembali ke halaman utama
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Password Baru
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="Masukkan password baru"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Minimal 8 karakter, huruf besar, huruf kecil, dan angka.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Konfirmasi Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="Ulangi password baru"
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-3 font-semibold text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Simpan Password Baru'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-teal-700">
            <ArrowLeft className="w-3 h-3" />
            Kembali ke EduTaktis
          </a>
        </div>
        </div>
      </section>
    </main>
  );
};
