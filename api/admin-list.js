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

    // Ambil user dari auth.users yang punya nama di metadata (berarti daftar lewat Si Gatot)
    const usersRes = await fetch(
      `${process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'}/auth/v1/admin/users?per_page=100`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!usersRes.ok) {
      const errorText = await usersRes.text()
      console.error('Failed to fetch users:', errorText)
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar akun.' })
    }

    const usersData = await usersRes.json()
    const allAuthUsers = usersData.users || []

    // Filter: hanya user yang punya nama di metadata (daftar lewat Si Gatot)
    const siGatotUserIds = allAuthUsers
      .filter(u => u.raw_app_meta_data?.provider === 'email' && u.raw_user_meta_data?.nama)
      .map(u => u.id)

    if (siGatotUserIds.length === 0) {
      return res.status(200).json({ ok: true, users: [] })
    }

    // Ambil profile dari sigatot_profiles untuk user-user Si Gatot
    const idsQuery = siGatotUserIds.map(id => `id=eq.${id}`).join(',')
    const profilesRes = await fetch(
      `${process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'}/rest/v1/sigatot_profiles?${idsQuery}&select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!profilesRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil profil.' })
    }

    const profiles = await profilesRes.json()
    const profileMap = {}
    profiles.forEach(p => { profileMap[p.id] = p })

    // Gabungkan data auth.users dengan sigatot_profiles
    const users = siGatotUserIds.map(id => {
      const authUser = allAuthUsers.find(u => u.id === id)
      const profile = profileMap[id]
      return {
        id,
        email: authUser?.email || profile?.email || '',
        nama: authUser?.raw_user_meta_data?.nama || profile?.nama || '(tanpa nama)',
        is_approved: profile?.is_approved || false,
        created_at: profile?.created_at || authUser?.created_at || new Date().toISOString(),
        approved_at: profile?.approved_at || null,
      }
    })

    return res.status(200).json({ ok: true, users })
  } catch (err) {
    console.error('admin-list error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
