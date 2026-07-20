import { useState } from 'react';
import { supabase } from './supabaseClient';

// Halaman Login / Daftar - pilih salah satu tab
export default function AuthGate({ initialError }: { initialError?: string }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle Login dengan email + password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    if (!password.trim()) { setError('Password wajib diisi.'); return; }
    if (!isValidEmail(email)) { setError('Format email tidak valid.'); return; }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setLoading(false);
    if (err) {
      if (err.message.includes('Invalid login credentials')) {
        setError('Email atau password salah.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('Email belum dikonfirmasi. Hubungi admin untuk mengaktifkan akun.');
      } else {
        setError(err.message || 'Login gagal. Coba lagi.');
      }
      return;
    }
    // Login berhasil - redirect handled by auth state change
  };

  // Handle Register - signup dengan email + password
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!nama.trim()) { setError('Nama wajib diisi.'); return; }
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    if (!isValidEmail(email)) { setError('Format email tidak valid.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    setLoading(true);
    setError('');

    try {
      // 1. Sign up user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nama: nama.trim(),
            app: 'sigatot',
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already been registered') || signUpError.message.includes('already exists')) {
          setError('Email ini sudah terdaftar. Silakan login.');
        } else {
          setError(signUpError.message || 'Pendaftaran gagal. Coba lagi.');
        }
        setLoading(false);
        return;
      }

      // 2. Langsung buat profile di sigatot_profiles
      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from('sigatot_profiles')
          .upsert({
            id: signUpData.user.id,
            email: email.trim(),
            nama: nama.trim(),
            is_approved: false,
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error('Gagal membuat profile:', profileError);
          // Tidak block flow, lanjutkan saja
        }
      }

      setLoading(false);
      setSent(true);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pendaftaran Berhasil!</h1>
          <p className="text-gray-600 text-sm mb-6">
            Pendaftaran Anda dengan email <b>{email}</b> berhasil.<br />
            Mohon tunggu persetujuan dari admin. Anda akan mendapat notifikasi setelah akun disetujui.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-amber-800 text-xs">
              <strong>💡 Langkah selanjutnya:</strong><br />
              1. Hubungi admin untuk persetujuan<br />
              2. Setelah disetujui, cek email untuk membuat password<br />
              3. Login dengan email &amp; password
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(''); setNama(''); setPassword(''); setError(''); }}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Daftar dengan email lain
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
            onClick={() => { setTab('login'); setError(''); setEmailError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); setEmailError(''); }}
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
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                placeholder="email@anda.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
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
              {loading ? 'Memproses...' : 'Masuk'}
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
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                placeholder="email@anda.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
              <p className="text-blue-800 text-xs">
                <strong>ℹ️ Info:</strong> Setelah daftar, akun Anda akan menunggu persetujuan admin.
                Setelah disetujui, Anda akan mendapat email untuk membuat password.
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
