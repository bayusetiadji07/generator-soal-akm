// Vercel Serverless Function — verifikasi/aktivasi kode akses (gerbang login sebelum ke generator).
// Dipanggil dari AccessGate.tsx (login pertama kali) dan dari main.tsx (cek ulang saat app dibuka).

import { findAccessCode, patchAccessCode, normalizeCode } from './_lib/access.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const { code, nama, deviceToken } = req.body || {}
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(200).json({ ok: false, message: 'Kode akses wajib diisi.' })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: false, message: 'Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY belum diset). Hubungi penjual.' })
  }

  const codeNorm = normalizeCode(code)
  const { row, error } = await findAccessCode(codeNorm)
  if (error) {
    return res.status(200).json({ ok: false, message: 'Gagal menghubungi server verifikasi. Coba lagi.' })
  }
  if (!row) {
    return res.status(200).json({ ok: false, message: 'Kode akses tidak ditemukan. Periksa kembali penulisannya.' })
  }
  if (!row.is_active) {
    return res.status(200).json({ ok: false, message: 'Kode akses ini sudah dinonaktifkan. Hubungi penjual.' })
  }

  // Belum pernah diaktivasi sama sekali → aktivasi ke perangkat ini
  if (!row.device_token) {
    const newToken = deviceToken || randomToken()
    const updated = await patchAccessCode(codeNorm, {
      device_token: newToken,
      activated_at: new Date().toISOString(),
      nama_pembeli: (nama && String(nama).trim()) || row.nama_pembeli || null,
    })
    if (!updated) {
      return res.status(200).json({ ok: false, message: 'Gagal mengaktifkan kode akses. Coba lagi.' })
    }
    return res.status(200).json({ ok: true, deviceToken: newToken, nama: updated.nama_pembeli || '' })
  }

  // Sudah pernah diaktivasi — device token dari browser ini harus cocok
  if (deviceToken && deviceToken === row.device_token) {
    return res.status(200).json({ ok: true, deviceToken: row.device_token, nama: row.nama_pembeli || '' })
  }

  return res.status(200).json({
    ok: false,
    message: 'Kode akses ini sedang aktif di perangkat/browser lain. Hubungi penjual jika ingin memindahkan akses ke perangkat ini.',
  })
}

function randomToken() {
  const bytes = new Uint8Array(24)
  const g = globalThis.crypto
  if (g && g.getRandomValues) g.getRandomValues(bytes)
  else { const nodeCrypto = require('crypto'); nodeCrypto.randomFillSync(bytes) }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
