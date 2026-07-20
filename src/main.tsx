import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import AdminPanel from './AdminPanel'
import { supabase } from './supabaseClient'
import './index.css'

// Gerbang akses:
// 1. User belum login -> AuthGate (Login / Register)
// 2. User sudah daftar tapi belum disetujui -> AuthGate (hanya bisa login kalau sudah disetujui)
// 3. User disetujui admin -> App (generator)

const capturedAuthError: string = (() => {
  const hash = window.location.hash
  if (!hash || !hash.includes('error=')) return ''
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const desc = params.get('error_description')
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Link masuk tidak valid atau sudah kedaluwarsa.'
})()

function Root() {
  const [status, setStatus] = useState<'checking' | 'signed-out' | 'approved'>('checking')
  const [authError] = useState(capturedAuthError)

  const checkProfile = async (userId: string) => {
    const { data: profile } = await supabase.from('sigatot_profiles').select('is_approved').eq('id', userId).single()
    if (profile?.is_approved) {
      setStatus('approved')
    } else {
      // User belum disetujui - tetap signed out (harus tunggu approval)
      setStatus('signed-out')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session?.user) checkProfile(session.user.id)
      else setStatus('signed-out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) checkProfile(session.user.id)
      else setStatus('signed-out')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (status === 'signed-out') return <AuthGate initialError={authError} />
  return <App />
}

// Check route
const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : ''
const isAdminRoute = path === '/admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminPanel /> : <Root />}
  </React.StrictMode>,
)
