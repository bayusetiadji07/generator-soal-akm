// Vercel Serverless Function — daftar semua akun Si Gatot (pending & sudah disetujui) utk AdminPanel.tsx.
// HANYA menampilkan user yang punya nama (daftar lewat Si Gatot), bukan semua user di project Supabase.
// Dilindungi ADMIN_PASSWORD (env var) — dikirim di body tiap request, dibandingkan server-side.

import { checkAdminPassword } from './_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }
  try {
    const { password } = req.body || {}
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(200).json({ ok: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD belum diset).' })
    }
    if (!checkAdminPassword(password)) {
      return res.status(401).json({ ok: false, message: 'Password admin salah.' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'
    const headers = {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }

    // Ambil SEMUA user dari auth.users (bisa dapat semua aplikasi dalam project)
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=100`,
      { headers }
    )

    if (!usersRes.ok) {
      const errorText = await usersRes.text()
      console.error('Failed to fetch users:', errorText)
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar akun.' })
    }

    const usersData = await usersRes.json()
    const allAuthUsers = usersData.users || []

    // Filter: hanya user email provider yang punya app='sigatot' di metadata (daftar lewat Si Gatot)
    const siGatotAuthUsers = allAuthUsers.filter(u =>
      u.app_meta_data?.provider === 'email' &&
      u.user_metadata?.app === 'sigatot'
    )

    if (siGatotAuthUsers.length === 0) {
      return res.status(200).json({ ok: true, users: [] })
    }

    const userIds = siGatotAuthUsers.map(u => u.id)

    // Ambil profile dari sigatot_profiles
    let profileMap = {}
    try {
      const idsQuery = userIds.map(id => `id=eq.${id}`).join('&')
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sigatot_profiles?${idsQuery}&select=*`,
        { headers }
      )
      if (profilesRes.ok) {
        const profiles = await profilesRes.json()
        profiles.forEach(p => { profileMap[p.id] = p })
      }
    } catch (e) {
      console.error('Failed to fetch profiles:', e)
    }

    // Gabungkan data auth.users dengan sigatot_profiles
    const users = siGatotAuthUsers.map(authUser => {
      const profile = profileMap[authUser.id]
      return {
        id: authUser.id,
        email: authUser.email || profile?.email || '',
        nama: authUser.user_metadata?.nama || profile?.nama || '(tanpa nama)',
        is_approved: profile?.is_approved || false,
        created_at: profile?.created_at || authUser.created_at || new Date().toISOString(),
        approved_at: profile?.approved_at || null,
      }
    })

    // Urutkan: belum disetujui duluan, lalu sudah disetujui
    users.sort((a, b) => {
      if (a.is_approved !== b.is_approved) return a.is_approved ? 1 : -1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return res.status(200).json({ ok: true, users })
  } catch (err) {
    console.error('admin-list error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
