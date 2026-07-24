// Vercel Serverless Function — setujui/cabut akses satu akun.
// Buka: /api/admin-approve

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({})
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const { userId, approve } = req.body || {}

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(200).json({ ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' })
    }
    if (!userId) {
      return res.status(200).json({ ok: false, message: 'userId wajib diisi.' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'
    const headers = {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    }

    // Ambil semua user lalu filter berdasarkan ID
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=500`,
      { headers }
    )

    if (!usersRes.ok) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil data user.' })
    }

    const usersData = await usersRes.json()
    const allUsers = usersData.users || []
    const userData = allUsers.find(u => u.id === userId)

    if (!userData) {
      return res.status(200).json({ ok: false, message: 'User tidak ditemukan.' })
    }

    const userEmail = userData.email
    const userName = userData.user_metadata?.nama || ''

    // Update approval status di sigatot_profiles
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ is_approved: !!approve, approved_at: approve ? new Date().toISOString() : null }),
      }
    )

    const updateData = await updateRes.json().catch(() => null)

    // Kirim invite email (user belum punya password, jadi invite akan buat password)
    let emailResult = null;
    if (approve && userEmail) {
      console.log('Sending invite to:', userEmail);

      const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: userEmail,
          data: { nama: userName, app: 'sigatot' },
          options: {
            email_redirect_to: `${process.env.REDIRECT_URL || 'https://sigatot.vercel.app'}/set-password`,
          }
        }),
      });

      console.log('Invite response status:', inviteRes.status);
      const inviteText = await inviteRes.text();
      console.log('Invite response:', inviteText);

      let inviteData;
      try {
        inviteData = JSON.parse(inviteText);
      } catch {
        inviteData = { raw: inviteText };
      }

      emailResult = {
        success: inviteRes.ok,
        status: inviteRes.status,
        data: inviteData,
      };
    }

    return res.status(200).json({
      ok: true,
      user: updateData?.[0] || { id: userId, is_approved: !!approve },
      emailSent: emailResult?.success || false,
      emailError: emailResult?.success ? null : (emailResult?.data?.msg || emailResult?.data?.message || 'Unknown error'),
    })
  } catch (err) {
    console.error('admin-approve error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
