import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Halaman konfirmasi email - ditampilkan setelah user klik link konfirmasi di email
// Link ini berasal dari redirect URL saat register: /confirm
export default function ConfirmationPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleConfirmation = async () => {
      // Parse URL parameters from the confirmation URL
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      const email = params.get('email');

      if (!tokenHash || type !== 'signup') {
        setStatus('error');
        setMessage('Link konfirmasi tidak valid atau sudah kedaluwarsa.');
        return;
      }

      try {
        // Verify the OTP token to complete the signup
        const { error } = await supabase.auth.verifyOtp({
          type: 'signup',
          email: email || '',
          token: tokenHash,
        });

        if (error) {
          // Check if already confirmed
          if (error.message.includes('already') || error.message.includes('Invalid')) {
            setStatus('already');
            setMessage('Email ini sudah dikonfirmasi sebelumnya. Silakan login.');
          } else {
            setStatus('error');
            setMessage(error.message || 'Gagal mengkonfirmasi email.');
          }
          return;
        }

        setStatus('success');
        setMessage('Email berhasil dikonfirmasi! Anda akan diarahkan ke halaman login.');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } catch (err) {
        setStatus('error');
        setMessage('Terjadi kesalahan saat mengkonfirmasi email.');
      }
    };

    handleConfirmation();
  }, []);

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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Memproses Konfirmasi...</h1>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Konfirmasi Berhasil!</h1>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-800 text-sm">
                <strong>✨ Selamat!</strong> Email Anda sudah terkonfirmasi.<br />
                Anda akan diarahkan ke halaman login dalam beberapa detik...
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Tidak dialihkan?{' '}
              <a href="/" className="text-blue-600 hover:underline font-medium">
                Klik di sini
              </a>
            </p>
          </>
        )}

        {status === 'already' && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Sudah Dikonfirmasi</h1>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <a
              href="/"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Konfirmasi Gagal</h1>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-red-800 text-xs">
                <strong>💡 Kemungkinan penyebab:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Link sudah kadaluwarsa (biasanya 1 jam)</li>
                  <li>Link sudah digunakan sebelumnya</li>
                  <li>Link tidak lengkap atau salah</li>
                </ul>
              </p>
            </div>
            <a
              href="/"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
            >
              Kembali ke Halaman Utama
            </a>
          </>
        )}
      </div>
    </div>
  );
}
