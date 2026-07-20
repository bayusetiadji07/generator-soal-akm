import { useState } from 'react';
import { supabase } from './supabaseClient';

// Halaman gerbang sebelum masuk ke generator — form yang SAMA dipakai utk daftar (pertama kali)
// MAUPUN masuk (sudah pernah daftar): isi email, dapat link masuk lewat email, tanpa password.
// Lalu menunggu disetujui admin (lihat AdminPanel.tsx).
export default function AuthGate({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email wajib diisi.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        data: { nama: nama.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Gagal mengirim link masuk. Coba lagi.');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-20 h-20 rounded-full shadow-inner object-cover mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Cek Email Anda</h1>
          <p className="text-gray-500 text-sm mt-2">
            Link masuk sudah dikirim ke <b>{email}</b>. Buka email itu &amp; klik link-nya untuk masuk (tidak perlu password).
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-5 text-sm text-blue-600 hover:underline"
          >
            Kirim ulang / ganti email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-20 h-20 rounded-full shadow-inner object-cover mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Si Gatot</h1>
        <p className="text-gray-400 text-sm mb-1">Sistem Generator Tes Otomatis</p>
        <p className="text-gray-500 text-xs mb-6">Masuk atau daftar — cukup satu form ini, tidak perlu password.</p>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama <span className="text-gray-400 font-normal">(diisi saat daftar pertama kali)</span></label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Anda"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@anda.com"
              autoComplete="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-medium text-white transition-all ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
          >
            {loading ? 'Mengirim...' : 'Kirim Link Masuk / Daftar'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-5">
          Sudah pernah daftar? Isi email yang sama di atas — link masuk baru akan dikirim lagi. Belum pernah? Isi nama &amp; email — akun dibuat otomatis, lalu tunggu persetujuan admin sebelum bisa dipakai.
        </p>
      </div>
    </div>
  );
}
