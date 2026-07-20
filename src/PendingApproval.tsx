import { useState } from 'react';
import { supabase } from './supabaseClient';

// Halaman waiting list - ditampilkan setelah user daftar & menunggu persetujuan admin
export default function PendingApproval({ email, onApproved }: { email: string; onApproved: () => void }) {
  const [checking, setChecking] = useState(false);
  const [showEmailInfo, setShowEmailInfo] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Menunggu Persetujuan</h1>
        <p className="text-gray-600 text-sm mb-6">
          Akun <b>{email}</b> sedang menunggu persetujuan dari admin.
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-800 text-xs font-medium mb-2">Apa yang perlu dilakukan?</p>
              <ol className="text-blue-700 text-xs space-y-1 list-decimal list-inside">
                <li>Hubungi penjual tempat Anda membeli untuk mempercepat proses persetujuan.</li>
                <li>Setelah disetujui, Anda akan mendapat <b>email konfirmasi</b>.</li>
                <li>Buka email &amp; klik link konfirmasi untuk login.</li>
              </ol>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={cekStatus}
          disabled={checking}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
            checking ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {checking ? 'Memeriksa...' : 'Cek Status Lagi'}
        </button>

        <button
          type="button"
          onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Keluar &amp; daftar dengan email lain
        </button>
      </div>
    </div>
  );
}
