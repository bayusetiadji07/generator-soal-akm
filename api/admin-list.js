// Vercel Serverless Function — daftar semua akun (pending & sudah disetujui) utk AdminPanel.tsx.
// Dilindungi ADMIN_PASSWORD (env var) — dikirim di body tiap request, dibandingkan server-side.

import { checkAdminPassword, listProfiles } from './_lib/auth.js'

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
    const { rows, error } = await listProfiles()
    if (error) {
      return res.status(200).json({ ok: false, message: 'Gagal mengambil daftar akun.' })
    }
    return res.status(200).json({ ok: true, users: rows })
  } catch (err) {
    console.error('admin-list error:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
