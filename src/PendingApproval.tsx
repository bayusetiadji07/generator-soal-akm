import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function PendingApproval({ email, onApproved }: { email: string; onApproved: () => void }) {
  const [checking, setChecking] = useState(false);

  const cekStatus = async () => {
    setChecking(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) {
      const { data: profile } = await supabase.from('sigatot_profiles').select('is_approved').eq('id', userId).single();
      if (profile?.is_approved) { onApproved(); setChecking(false); return; }
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-20 h-20 rounded-full shadow-inner object-cover mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Menunggu Persetujuan</h1>
        <p className="text-gray-500 text-sm mt-2">
          Akun <b>{email}</b> sudah terdaftar, tapi belum disetujui admin. Hubungi penjual tempat Anda membeli untuk mempercepat proses.
        </p>
        <button
          type="button"
          onClick={cekStatus}
          disabled={checking}
          className={`mt-5 w-full py-3 rounded-xl font-medium text-white transition-all ${checking ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
        >
          {checking ? 'Memeriksa...' : 'Cek Status Lagi'}
        </button>
        <button
          type="button"
          onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="mt-3 text-sm text-gray-500 hover:underline"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}
