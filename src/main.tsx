import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './AuthGate'
import AdminPanel from './AdminPanel'
import ModernLoader from './ModernLoader'
import Particles from './Particles'
import DarkModeToggle from './DarkModeToggle'
import { supabase } from './supabaseClient'
import './index.css'

// Check if dark mode is enabled
const isDarkMode = typeof window !== 'undefined' && localStorage.getItem('darkMode') === 'true'
if (isDarkMode) {
  document.documentElement.classList.add('dark')
}

function Root() {
  const [status, setStatus] = useState<'checking' | 'signed-out' | 'approved'>('checking')
  const [authError] = useState('')

  const checkProfile = async (userId: string) => {
    const { data: profile } = await supabase.from('sigatot_profiles').select('is_approved').eq('id', userId).single()
    if (profile?.is_approved) {
      setStatus('approved')
    } else {
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
    return <ModernLoader />
  }
  if (status === 'signed-out') return <AuthGate initialError={authError} />
  return <App />
}

// Check route
const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : ''
const isAdminRoute = path === '/admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Show particles and dark mode toggle for non-admin routes */}
    {!isAdminRoute && (
      <>
        <Particles />
        <DarkModeToggle />
      </>
    )}
    {isAdminRoute ? <AdminPanel /> : <Root />}
  </React.StrictMode>,
)
