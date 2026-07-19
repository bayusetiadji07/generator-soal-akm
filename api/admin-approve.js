// Vercel Serverless Function — setujui/cabut akses satu akun. Dilindungi ADMIN_PASSWORD.

import { checkAdminPassword, setApproval } from './_lib/auth.js'

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
    const { row, error } = await setApproval(userId, !!approve)
    if (error || !row) {
      return res.status(200).json({ ok: false, message: 'Gagal memperbarui status akun.' })
    }
    return res.status(200).json({ ok: true, user: row })
  } catch (err) {
    console.error('admin-approve error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
