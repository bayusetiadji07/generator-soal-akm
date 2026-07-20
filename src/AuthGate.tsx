import { useState } from 'react';
import { supabase } from './supabaseClient';

// Halaman Login / Daftar - pilih salah satu tab
export default function AuthGate({ initialError }: { initialError?: string }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [sent, setSent] = useState(false);
  const [sentType, setSentType] = useState<'login' | 'register'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Gagal mengirim link masuk. Coba lagi.');
      return;
    }
    setSent(true);
    setSentType('login');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) { setError('Nama wajib diisi.'); return; }
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        data: { nama: nama.trim() },
        emailRedirectTo: `${window.location.origin}/confirm`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Gagal mendaftar. Coba lagi.');
      return;
    }
    setSent(true);
    setSentType('register');
  };

  if (sent) {
    const isLogin = sentType === 'login';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Cek Email Anda' : 'Pendaftaran Berhasil!'}
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            {isLogin ? (
              <>Link masuk sudah dikirim ke <b>{email}</b>. Buka email itu &amp; klik link-nya untuk masuk.</>
            ) : (
              <>
                Kami telah mengirim link konfirmasi ke <b>{email}</b>. <br />
                Buka email tersebut dan klik link konfirmasi untuk melanjutkan.
              </>
            )}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-amber-800 text-xs">
              <strong>💡 Tips:</strong> Jika email tidak muncul, cek folder <strong>Spam</strong> atau <strong>Promosi</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(''); setNama(''); }}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            {isLogin ? 'Kirim ulang / ganti email' : 'Daftar dengan email lain'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-20 h-20 rounded-full shadow-inner object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Si Gatot</h1>
          <p className="text-gray-500 text-sm mt-1">Sistem Generator Tes Otomatis</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daftar
          </button>
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@anda.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? 'Mengirim...' : 'Kirim Link Masuk'}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              Belum punya akun?{' '}
              <button type="button" onClick={() => setTab('register')} className="text-blue-600 hover:underline">
                Daftar di sini
              </button>
            </p>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Masukkan nama lengkap Anda"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@anda.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
              <p className="text-blue-800 text-xs">
                <strong>ℹ️ Info:</strong> Setelah daftar, akun Anda akan menunggu persetujuan admin.
                Anda akan mendapat email konfirmasi setelah akun disetujui.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              Sudah punya akun?{' '}
              <button type="button" onClick={() => setTab('login')} className="text-blue-600 hover:underline">
                Masuk di sini
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
