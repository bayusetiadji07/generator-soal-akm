// Vercel Serverless Function — setujui/cabut akses satu akun. Dilindungi ADMIN_PASSWORD.
// Ketika approve, akan mengirim email login ke user.

import { checkAdminPassword, setApproval, getProfile, SUPABASE_URL, ANON_KEY } from './_lib/auth.js'

async function sendLoginLinkEmail(userEmail) {
  try {
    // Kirim magic link untuk login menggunakan Supabase Auth API
    const redirectTo = encodeURIComponent(process.env.REDIRECT_URL || 'https://generator-soal-akm.vercel.app');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      },
      body: JSON.stringify({
        email: userEmail,
        options: {
          emailRedirectTo: process.env.REDIRECT_URL || 'https://generator-soal-akm.vercel.app',
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send login email:', errorText);
      return { success: false, error: errorText };
    }
    return { success: true };
  } catch (err) {
    console.error('Error sending login email:', err);
    return { success: false, error: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }
  try {
    const { password, userId, approve } = req.body || {}
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(200).json({ ok: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD belum diset).' })
    }
    if (!checkAdminPassword(password)) {
      return res.status(401).json({ ok: false, message: 'Password admin salah.' })
    }
    if (!userId) {
      return res.status(200).json({ ok: false, message: 'userId wajib diisi.' })
    }

    // Get user email before approval
    let userEmail = null;
    if (approve) {
      const profile = await getProfile(userId);
      if (profile) {
        userEmail = profile.email;
      }
    }

    const { row, error } = await setApproval(userId, !!approve)
    if (error || !row) {
      return res.status(200).json({ ok: false, message: 'Gagal memperbarui status akun.' })
    }

    // Send login email if approved
    let emailResult = null;
    if (approve && userEmail) {
      emailResult = await sendLoginLinkEmail(userEmail);
    }

    return res.status(200).json({
      ok: true,
      user: row,
      emailSent: emailResult?.success || false,
      emailError: emailResult?.error || null
    })
  } catch (err) {
    console.error('admin-approve error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
