// Debug endpoint - cek semua user
// Buka: /api/debug-users

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false })
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
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=100`,
      { headers }
    )
    const usersData = await usersRes.json()
    const allUsers = usersData.users || []

    // Ambil semua profile
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?select=*`,
      { headers }
    )
    const profiles = profilesRes.ok ? await profilesRes.json() : []

    return res.status(200).json({
      totalAuthUsers: allUsers.length,
      totalProfiles: Array.isArray(profiles) ? profiles.length : 0,
      authUsers: allUsers.map(u => ({
        id: u.id,
        email: u.email,
        app: u.user_metadata?.app,
        nama: u.user_metadata?.nama,
        confirmed: u.email_confirmed_at != null,
        created: u.created_at,
      })),
      profiles: profiles,
    })
  } catch (err) {
    return res.status(200).json({ error: err.message })
  }
}
