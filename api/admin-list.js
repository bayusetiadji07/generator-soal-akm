// Vercel Serverless Function — daftar semua akun Si Gatot. POST (bukan GET) supaya password
// dikirim di body, bukan query string (query string gampang tercatat di access log/riwayat browser).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const { password } = req.body || {}
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ ok: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD belum diset).' })
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Password admin salah.' })
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

    // Ambil SEMUA profile dari sigatot_profiles
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?select=*`,
      { headers }
    )

    let profiles = []
    if (profilesRes.ok) {
      profiles = await profilesRes.json()
    }

    // Gabungkan data, TAPI hanya user yang metadata-nya benar-benar app='sigatot' yang ditampilkan.
    // Lapis pengaman kedua ini penting: project Supabase ini dipakai bersama aplikasi lain
    // (e-asesmen, si-diswa) yg berbagi tabel auth.users yang sama — pernah kejadian tabel
    // sigatot_profiles ikut kemasukan ratusan akun aplikasi lain krn bug di trigger DB.
    // Filter di sini jadi jaring pengaman kedua di luar perbaikan triggernya sendiri.
    const users = []

    for (const profile of profiles) {
      const authUser = allAuthUsers.find(u => u.id === profile.id)
      if (authUser && authUser.user_metadata?.app === 'sigatot') {
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
