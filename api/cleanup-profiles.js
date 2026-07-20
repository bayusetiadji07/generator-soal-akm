// Vercel Serverless Function - Cleanup old profiles in sigatot_profiles
// Buka: /api/cleanup-profiles?secret=YOUR_ADMIN_PASSWORD
// Hapus profile yang bukan dari Si Gatot (app != 'sigatot')

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const { secret } = req.query
  if (secret !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password' })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  try {
    // Ambil semua user dari auth.users
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=500`,
      { headers }
    )

    if (!usersRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar user dari auth.users' })
    }

    const usersData = await usersRes.json()
    const allAuthUsers = usersData.users || []

    // Cek apakah auth.users dari Si Gatot (pakai app: 'sigatot')
    const siGatotIds = new Set(
      allAuthUsers
        .filter(u => u.user_metadata?.app === 'sigatot')
        .map(u => u.id)
    )

    // Ambil semua profile dari sigatot_profiles
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?select=id`,
      { headers }
    )

    if (!profilesRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar profile' })
    }

    const profiles = await profilesRes.json()

    // Filter profile yang ID-nya bukan dari Si Gatot
    const toDelete = profiles.filter(p => !siGatotIds.has(p.id))

    // Hapus profile yang bukan dari Si Gatot
    let deleted = 0
    for (const p of toDelete) {
      const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sigatot_profiles?id=eq.${p.id}`,
        {
          method: 'DELETE',
          headers
        }
      )
      if (deleteRes.ok) deleted++
    }

    return res.status(200).json({
      ok: true,
      message: `Berhasil hapus ${deleted} profile yang bukan dari Si Gatot`,
      totalProfiles: profiles.length,
      siGatotUsers: siGatotIds.size,
      deleted,
    })
  } catch (err) {
    console.error('cleanup error:', err)
    return res.status(200).json({ ok: false, message: `Error: ${err.message}` })
  }
}
