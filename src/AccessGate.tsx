import { useState } from 'react';

export const ACCESS_STORAGE_KEY = 'sigatot_access';

export interface AccessInfo {
  code: string;
  nama: string;
  deviceToken: string;
}

export function getStoredAccess(): AccessInfo | null {
  try {
    const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.code && parsed.deviceToken) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearStoredAccess() {
  try { localStorage.removeItem(ACCESS_STORAGE_KEY); } catch { /* ignore */ }
}

function randomDeviceToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Halaman gerbang akses sebelum masuk ke generator — nama + kode akses yang didapat pembeli
// setelah membeli (mis. lewat Lynk.id). Diverifikasi ke /api/verify-access (server memegang
// service_role key Supabase, tidak pernah diekspos ke browser).
export default function AccessGate({ onUnlocked, initialError }: { onUnlocked: (info: AccessInfo) => void; initialError?: string }) {
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kode.trim()) { setError('Kode akses wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      const deviceToken = getStoredAccess()?.deviceToken || randomDeviceToken();
      const res = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: kode.trim(), nama: nama.trim(), deviceToken }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Kode akses tidak valid.');
        setLoading(false);
        return;
      }
      const info: AccessInfo = { code: kode.trim().toUpperCase(), nama: nama.trim() || data.nama || '', deviceToken: data.deviceToken };
      try { localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(info)); } catch { /* ignore */ }
      onUnlocked(info);
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi internet Anda.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-20 h-20 rounded-full shadow-inner object-cover mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Si Gatot</h1>
        <p className="text-gray-400 text-sm mb-6">Sistem Generator Tes Otomatis</p>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Anda"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kode Akses</label>
            <input
              type="text"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              placeholder="Kode dari pembelian Anda"
              autoComplete="off"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-wide"
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
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-5">
          Belum punya kode akses? Hubungi penjual tempat Anda membeli aplikasi ini.
        </p>
      </div>
    </div>
  );
}
