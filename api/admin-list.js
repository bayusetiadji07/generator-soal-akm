// Vercel Serverless Function — daftar semua akun Si Gatot
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  try {
    // Ambil SEMUA user dari auth.users
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=500`,
      { headers }
    )

    if (!usersRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar akun.' })
    }

    const usersData = await usersRes.json()
    const allAuthUsers = usersData.users || []

    // Filter: hanya user yang punya app='sigatot' di metadata
    const siGatotAuthUsers = allAuthUsers.filter(u =>
      u.user_metadata?.app === 'sigatot'
    )

    // Ambil SEMUA profile dari sigatot_profiles
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?select=*`,
      { headers }
    )

    let profiles = []
    if (profilesRes.ok) {
      profiles = await profilesRes.json()
    }

    // Buat map profile berdasarkan user ID
    const profileMap = {}
    profiles.forEach(p => {
      profileMap[p.id] = p
    })

    // Gabungkan data - langsung dari profile, bukan dari auth filter
    // Ini lebih akurat karena is_approved ada di profile
    const users = []

    for (const profile of profiles) {
      const authUser = allAuthUsers.find(u => u.id === profile.id)
      if (authUser) {
        users.push({
          id: profile.id,
          email: authUser.email || profile.email || '',
          nama: authUser.user_metadata?.nama || profile.nama || '(tanpa nama)',
          is_approved: profile.is_approved || false,
          created_at: profile.created_at || authUser.created_at || new Date().toISOString(),
          approved_at: profile.approved_at || null,
        })
      }
    }

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
