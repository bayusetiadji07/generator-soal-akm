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
export default function AdminPanel() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('sigatot_admin_pw') || '');
  const [unlocked, setUnlocked] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    setNotification(null);
    try {
      const res = await fetch('/api/admin-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userId, approve }),
      });
      const data = await res.json();
      if (data.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_approved: approve, approved_at: data.user.approved_at } : u)));
        if (approve) {
          if (data.emailSent) {
            setNotification({ type: 'success', message: 'User berhasil disetujui! Invite email sudah dikirim.' });
          } else {
            setNotification({ type: 'error', message: 'User disetujui tapi gagal kirim email: ' + (data.emailError || 'Unknown error') });
          }
        } else {
          setNotification({ type: 'success', message: 'Akses user berhasil dicabut.' });
        }
      } else {
        setNotification({ type: 'error', message: data.message || 'Gagal memperbarui.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Gagal menghubungi server.' });
    }
    setBusyId(null);
  };

  const pending = users.filter((u) => !u.is_approved);
  const approved = users.filter((u) => u.is_approved);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel Admin — Si Gatot</h1>
            <p className="text-sm text-gray-500">Kelola akses pengguna</p>
          </div>
          <button
            onClick={() => muat(password)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? 'Memuat...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`p-4 rounded-xl border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800">
            {error}
          </div>
        )}

        {/* Pending Users */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Menunggu Persetujuan ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.length === 0 && !loading && (
              <p className="text-sm text-gray-400 bg-white p-4 rounded-xl border border-gray-100">Tidak ada yang menunggu.</p>
            )}
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{u.nama}</div>
                  <div className="text-sm text-gray-500 truncate">{u.email}</div>
                  <div className="text-xs text-gray-400 mt-1">Daftar: {formatDate(u.created_at)}</div>
                </div>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => setujui(u.id, true)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                    busyId === u.id
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  }`}
                >
                  {busyId === u.id ? '...' : '✅ Setujui'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Approved Users */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Sudah Disetujui ({approved.length})
          </h2>
          <div className="space-y-3">
            {approved.length === 0 && (
              <p className="text-sm text-gray-400 bg-white p-4 rounded-xl border border-gray-100">Belum ada.</p>
            )}
            {approved.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{u.nama}</div>
                  <div className="text-sm text-gray-500 truncate">{u.email}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Disetujui: {u.approved_at ? formatDate(u.approved_at) : '-'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => setujui(u.id, false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                    busyId === u.id
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {busyId === u.id ? '...' : '❌ Cabut'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
