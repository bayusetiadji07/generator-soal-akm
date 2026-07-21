// Vercel Serverless Function — proxy ke Gemini (teks).
// API key DIUTAMAKAN dari input pengguna (dikirim di body), fallback ke env server.
//
// Tahan banting: kalau model utama sedang overload (503) atau kena limit (429),
// otomatis mencoba model cadangan secara berurutan.

import { verifyApprovedUser } from './_lib/auth.js'

export const maxDuration = 60

// Model yang tersedia — coba dari terbaik-tercepat.
// Kalau model utama error, otomatis coba model cadangan berikutnya.
const MODELS = ['gemini-2.0-flash-exp', 'gemini-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Dukung format baru { apiKey, payload }; tetap kompatibel dengan body lama (payload langsung)
  const body = req.body || {}

  // Gerbang kode akses: cek server-side (bukan cuma di tampilan) supaya kode yang dinonaktifkan
  // penjual benar-benar berhenti bisa memakai kuota AI berbayar ini.
  const access = await verifyApprovedUser(body.accessToken)
  if (!access.ok) {
    return res.status(access.status).json({ error: { message: access.message } })
  }

  const userKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const payload = body.payload || body
  const apiKey = userKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key Gemini belum diisi. Masukkan API Key Anda di aplikasi (dapatkan gratis di aistudio.google.com/app/apikey).' })
  }

  let lastErrorBody = null
  let lastStatus = 500

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = await response.json()

      if (response.ok) {
        return res.status(200).json(data)
      }

      lastStatus = response.status
      lastErrorBody = data

      // Overload (503) atau rate limit (429) → coba model cadangan berikutnya.
      // Error lain (key salah, request invalid) → langsung berhenti, percuma dicoba model lain.
      if (response.status !== 503 && response.status !== 429) {
        return res.status(response.status).json(data)
      }
    } catch (err) {
      lastStatus = 500
      lastErrorBody = { error: { message: err.message || 'Gagal menghubungi Gemini API.' } }
    }
  }

  // Semua model gagal (kemungkinan semua sedang overload)
  return res.status(lastStatus).json(
    lastErrorBody || { error: { message: 'Semua model Gemini sedang sibuk. Coba lagi beberapa saat.' } }
  )
}
