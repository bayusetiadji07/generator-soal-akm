import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import PendingApproval from './PendingApproval'
import AdminPanel from './AdminPanel'
import { supabase } from './supabaseClient'
import './index.css'

// Gerbang akses: signup/login pakai email (magic link, tanpa password) -> menunggu disetujui
// admin (lihat AdminPanel.tsx, diakses lewat /admin) -> baru bisa masuk ke generator.
function Root() {
  const [status, setStatus] = useState<'checking' | 'signed-out' | 'pending' | 'approved'>('checking')
  const [email, setEmail] = useState('')

  const checkProfile = async (userId: string, userEmail: string) => {
    const { data: profile } = await supabase.from('sigatot_profiles').select('is_approved').eq('id', userId).single()
    setEmail(userEmail)
    setStatus(profile?.is_approved ? 'approved' : 'pending')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session?.user) checkProfile(session.user.id, session.user.email || '')
      else setStatus('signed-out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) checkProfile(session.user.id, session.user.email || '')
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
  if (status === 'signed-out') return <AuthGate />
  if (status === 'pending') return <PendingApproval email={email} onApproved={() => setStatus('approved')} />
  return <App />
}

const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminPanel /> : <Root />}
  </React.StrictMode>,
)
