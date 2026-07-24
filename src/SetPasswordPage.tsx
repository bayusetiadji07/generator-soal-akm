import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Halaman untuk membuat password setelah user mengklik link invite dari email
// Link ini berasal dari redirect URL saat admin approve: /set-password?token=xxx
export default function SetPasswordPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'setting' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Parse token from URL
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    const emailParam = params.get('email');

    console.log('SetPasswordPage: params', { token_hash: tokenHash, type, email: emailParam });

    if (!tokenHash) {
      setStatus('error');
      setMessage('Link tidak valid atau sudah kedaluwarsa. Pastikan Anda mengklik link dari email yang dikirim admin.');
      return;
    }

    if (emailParam) {
      setEmail(emailParam);
    }

    setStatus('ready');
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password tidak sama. Pastikan password sama.');
      return;
    }

    setLoading(true);
    setStatus('setting');

    try {
      // Parse token from URL
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const emailParam = params.get('email') || email;

      if (!tokenHash || !emailParam) {
        throw new Error('Token atau email tidak ditemukan. Silakan klik link dari email lagi.');
      }

      console.log('Verifying OTP with:', { type: 'invite', email: emailParam, token: tokenHash });

      // Verify OTP token to complete the signup/invite
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        type: 'invite',
        email: emailParam,
        token: tokenHash,
      });

      console.log('Verify result:', { data: verifyData, error: verifyError });

      if (verifyError) {
        throw new Error(verifyError.message || 'Gagal memverifikasi token.');
      }

      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      console.log('Update password result:', { error: updateError });

      if (updateError) {
        throw new Error(updateError.message || 'Gagal membuat password.');
      }

      setStatus('success');
      setMessage('Password berhasil dibuat! Anda akan diarahkan ke halaman login.');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);

    } catch (err: any) {
      console.error('Set password error:', err);
      setStatus('ready');
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">

        {status === 'loading' && (
          <>
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Memuat...</h1>
            <p className="text-gray-500 text-sm">Mohon tunggu sebentar.</p>
          </>
        )}

        {status === 'ready' && (
          <>
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Buat Password Anda</h1>
            <p className="text-gray-600 text-sm mb-6">
              {email ? (
                <>Selamat datang! Buat password untuk akun <b>{email}</b>.</>
              ) : (
                'Buat password untuk akun Anda.'
              )}
            </p>

            <form onSubmit={handleSetPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Masukkan password lagi"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                }`}
              >
                {loading ? 'Memproses...' : 'Simpan Password'}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6">
              Password akan digunakan untuk login ke akun Anda.
            </p>
          </>
        )}

        {status === 'setting' && (
          <>
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Memproses...</h1>
            <p className="text-gray-500 text-sm">Mohon tunggu sebentar.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Berhasil Dibuat!</h1>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-green-800 text-sm">
                <strong>✨ Selamat!</strong> Password Anda sudah tersimpan.<br />
                Sekarang Anda bisa login dengan email dan password baru.
              </p>
            </div>
            <a
              href="/"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
            >
              Buka Halaman Login
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Tidak Valid</h1>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-red-800 text-xs">
                <strong>💡 Kemungkinan penyebab:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Link sudah kedaluwarsa (biasanya 1 jam)</li>
                  <li>Link sudah digunakan sebelumnya</li>
                  <li>Link tidak lengkap atau salah</li>
                </ul>
              </p>
            </div>
            <a
              href="/"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
            >
              Kembali ke Halaman Utama
            </a>
          </>
        )}
      </div>
    </div>
  );
}
