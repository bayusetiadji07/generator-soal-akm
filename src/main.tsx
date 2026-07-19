import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AccessGate, { getStoredAccess, clearStoredAccess, type AccessInfo } from './AccessGate'
import './index.css'

// Gerbang kode akses sebelum masuk ke generator. Kalau ada sesi tersimpan, cek ulang diam-diam
// ke server (supaya kode yang dinonaktifkan penjual langsung mengunci ulang aplikasi, bukan hanya
// diblokir sekali saat login pertama).
function Root() {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = getStoredAccess()
    if (!stored) { setStatus('locked'); return }
    fetch('/api/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: stored.code, deviceToken: stored.deviceToken }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) { setStatus('unlocked'); return }
        clearStoredAccess()
        setError(data.message || 'Sesi akses Anda tidak lagi berlaku. Silakan masuk ulang.')
        setStatus('locked')
      })
      .catch(() => {
        // Gagal menghubungi server (mis. offline) — tetap izinkan pakai sesi lama supaya
        // guru yang sedang mengerjakan sesuatu tidak tiba-tiba terkunci karena koneksi putus.
        setStatus('unlocked')
      })
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (status === 'locked') {
    return <AccessGate initialError={error} onUnlocked={() => setStatus('unlocked')} />
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
