// Vercel Serverless Function - Cleanup all old non-Si Gatot users
// Buka: /api/cleanup-all?secret=YOUR_ADMIN_PASSWORD
// Hapus semua user yang bukan dari Si Gatot (tanpa app: 'sigatot' di metadata)

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
    // Ambil semua user
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=500`,
      { headers }
    )

    if (!usersRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar user' })
    }

    const usersData = await usersRes.json()
    const allUsers = usersData.users || []

    // Filter: user yang BUKAN dari Si Gatot
    const nonSiGatotUsers = allUsers.filter(u => u.user_metadata?.app !== 'sigatot')

    // Hapus profile non-Si Gatot dari sigatot_profiles
    let deletedProfiles = 0
    for (const u of nonSiGatotUsers) {
      const delProfile = await fetch(
        `${SUPABASE_URL}/rest/v1/sigatot_profiles?id=eq.${u.id}`,
        { method: 'DELETE', headers }
      )
      if (delProfile.ok) deletedProfiles++
    }

    // Hapus user non-Si Gatot dari auth.users
    let deletedUsers = 0
    for (const u of nonSiGatotUsers) {
      const delUser = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${u.id}`,
        { method: 'DELETE', headers }
      )
      if (delUser.ok) deletedUsers++
    }

    // Hitung sisa
    const remainingUsers = usersData.users?.length || 0
    const siGatotUsers = remainingUsers - deletedUsers

    return res.status(200).json({
      ok: true,
      message: `Berhasil!`,
      deletedUsers,
      deletedProfiles,
      remainingSiGatotUsers: siGatotUsers,
      deletedUserEmails: nonSiGatotUsers.map(u => u.email).slice(0, 20), // preview
    })
  } catch (err) {
    console.error('cleanup error:', err)
    return res.status(200).json({ ok: false, message: `Error: ${err.message}` })
  }
}
