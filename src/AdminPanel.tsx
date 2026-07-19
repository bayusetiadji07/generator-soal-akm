import { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  email: string;
  nama: string;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
}

// Panel admin sederhana — diakses lewat /admin, dilindungi ADMIN_PASSWORD (env var server).
// Bukan sistem role/permission penuh, cukup utk satu admin (penjual) menyetujui akun pembeli.
export default function AdminPanel() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('sigatot_admin_pw') || '');
  const [unlocked, setUnlocked] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const muat = async (pw: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.message || 'Gagal memuat.'); setUnlocked(false); setLoading(false); return; }
      setUsers(data.users || []);
      setUnlocked(true);
      sessionStorage.setItem('sigatot_admin_pw', pw);
    } catch {
      setError('Gagal menghubungi server.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (password) muat(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setujui = async (userId: string, approve: boolean) => {
    setBusyId(userId);
    try {
      const res = await fetch('/api/admin-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userId, approve }),
      });
      const data = await res.json();
      if (data.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_approved: approve, approved_at: data.user.approved_at } : u)));
      } else {
        alert(data.message || 'Gagal memperbarui.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
    setBusyId(null);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <form
          onSubmit={(e) => { e.preventDefault(); muat(password); }}
          className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
        >
          <h1 className="text-lg font-bold text-gray-900 mb-4 text-center">Panel Admin — Si Gatot</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password admin"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-3"
          />
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 mb-3">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-medium text-white ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>
      </div>
    );
  }

  const pending = users.filter((u) => !u.is_approved);
  const approved = users.filter((u) => u.is_approved);

  const renderRow = (u: AdminUser) => (
    <div key={u.id} className="flex items-center justify-between gap-3 p-4 border border-gray-100 rounded-xl bg-white">
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{u.nama || '(tanpa nama)'}</div>
        <div className="text-sm text-gray-500 truncate">{u.email}</div>
        <div className="text-xs text-gray-400 mt-0.5">Daftar: {new Date(u.created_at).toLocaleString('id-ID')}</div>
      </div>
      <button
        type="button"
        disabled={busyId === u.id}
        onClick={() => setujui(u.id, !u.is_approved)}
        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
          u.is_approved
            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {busyId === u.id ? '...' : u.is_approved ? 'Cabut Akses' : 'Setujui'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Panel Admin — Si Gatot</h1>
          <button onClick={() => muat(password)} className="text-sm text-blue-600 hover:underline">Muat Ulang</button>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Menunggu Persetujuan ({pending.length})</h2>
          <div className="space-y-2">
            {pending.length === 0 && <p className="text-sm text-gray-400">Tidak ada yang menunggu.</p>}
            {pending.map(renderRow)}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Sudah Disetujui ({approved.length})</h2>
          <div className="space-y-2">
            {approved.length === 0 && <p className="text-sm text-gray-400">Belum ada.</p>}
            {approved.map(renderRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
