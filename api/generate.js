// Vercel Serverless Function — proxy ke Gemini (teks).
// API key DIUTAMAKAN dari input pengguna (dikirim di body), fallback ke env server.
//
// PEMILIHAN MODEL OTOMATIS: daftar model tidak lagi ditulis manual. Server menanyakan ke Google
// (models.list) model apa saja yang tersedia untuk API key itu, memilih keluarga "Flash" dengan
// nomor versi tertinggi (3.8 > 3.7 > ... ), lalu mencobanya berurutan. Jadi kalau Google merilis
// Gemini 3.9 / 4.0 Flash, aplikasi otomatis memakainya tanpa perlu update kode. Hasil daftar
// di-cache sebentar (CACHE_MS) supaya tidak menambah satu request tiap generate.
// Kalau models.list gagal, dipakai daftar cadangan statis di FALLBACK_MODELS.

import { verifyApprovedUser, catatPemakaian } from './_lib/auth.js'

export const maxDuration = 60

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const CACHE_MS = 60 * 60 * 1000 // 1 jam
const MAX_CANDIDATES = 4 // berapa model teratas yang dicoba berurutan

// Cadangan bila models.list tidak bisa dipakai (nama sesuai dokumentasi Google per 2026-09).
// Model 2.5 sengaja tidak dimasukkan: Google membatasinya hanya untuk pengguna lama.
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
]

// Cache per API key (hash pendek, bukan key aslinya) — key berbeda bisa punya akses model berbeda.
const cache = new Map()
const keyId = (k) => k.slice(0, 6) + ':' + k.slice(-4)

// "gemini-3.8-flash" / "gemini-3.5-flash-lite" / "gemini-3-flash-preview" -> skor urut
function scoreModel(name) {
  const m = /^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(-preview[\w-]*)?$/.exec(name)
  if (!m) return null // bukan keluarga Flash teks biasa (mis. -image, -tts, -live, -pro) -> abaikan
  const version = parseFloat(m[1])
  const lite = m[2] ? 1 : 0
  const preview = m[3] ? 1 : 0
  // Versi tinggi dulu; pada versi sama: non-lite dulu, lalu stabil sebelum preview.
  return version * 100 - lite * 10 - preview * 5
}

async function discoverModels(apiKey) {
  const id = keyId(apiKey)
  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.models

  let models = []
  try {
    const r = await fetch(`${API_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': apiKey } })
    if (r.ok) {
      const data = await r.json()
      models = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => String(m.name || '').replace(/^models\//, ''))
        .map((name) => ({ name, score: scoreModel(name) }))
        .filter((m) => m.score !== null)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.name)
    }
  } catch {
    /* jatuh ke daftar cadangan */
  }
  if (models.length) cache.set(id, { at: Date.now(), models })
  return models
}

// Gemini 3.x bisa mengembalikan beberapa "part" (mis. bagian pikiran + jawaban). Frontend membaca
// parts[0].text, jadi gabungkan semua teks jawaban (bukan bagian pikiran) ke satu part.
function normalizeResponse(data) {
  try {
    const cand = data?.candidates?.[0]
    const parts = cand?.content?.parts
    if (Array.isArray(parts) && parts.length > 1) {
      const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('')
      if (text) cand.content.parts = [{ text }]
    }
  } catch { /* biarkan apa adanya */ }
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Dukung format baru { apiKey, payload }; tetap kompatibel dengan body lama (payload langsung)
  const body = req.body || {}

  // Gerbang akses: cek server-side (bukan cuma di tampilan) supaya akun yang dicabut penjual
  // benar-benar berhenti bisa memakai kuota AI berbayar ini.
  const access = await verifyApprovedUser(body.accessToken)
  if (!access.ok) {
    return res.status(access.status).json({ error: { message: access.message } })
  }

  const catat = (ok) => catatPemakaian(access.user.id, body.meta && body.meta.mode, ok)

  const userKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const payload = body.payload || body
  const apiKey = userKey || process.env.GEMINI_API_KEY
  if (!apiKey) {
    await catat(false)
    return res.status(400).json({ error: { message: 'API Key Gemini belum diisi. Masukkan API Key Anda di aplikasi (dapatkan gratis di aistudio.google.com/app/apikey).' } })
  }

  // Kandidat: hasil deteksi otomatis dulu, lalu cadangan statis (tanpa duplikat).
  const discovered = await discoverModels(apiKey)
  const candidates = [...new Set([...discovered.slice(0, MAX_CANDIDATES), ...FALLBACK_MODELS])]

  let lastErrorBody = null
  let lastStatus = 500
  const tried = []

  for (const model of candidates) {
    try {
      const response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (response.ok) {
        res.setHeader('x-gemini-model', model) // model yang benar-benar dipakai (utk pengecekan)
        await catat(true)
        return res.status(200).json(normalizeResponse(data))
      }

      tried.push(`${model}: ${response.status}`)
      lastStatus = response.status
      lastErrorBody = data
      const msg = (data && data.error && data.error.message) || ''

      // Masalah pada API KEY (bukan model) -> percuma mencoba model lain, beri pesan jelas.
      const keyInvalid = /api key not valid|api_key_invalid|api key expired|key.*(revoked|leaked|disabled)|permission.*denied|has been suspended/i.test(msg)
      if (keyInvalid || response.status === 401 || response.status === 403) {
        await catat(false)
        return res.status(response.status === 200 ? 400 : response.status).json({
          error: { message: `API Key Gemini ditolak Google: ${(msg || 'tidak valid').replace(/\.+$/, '')}. Buat key baru di aistudio.google.com/app/apikey lalu tempel ulang di aplikasi.` },
        })
      }

      // Overload (503), rate limit (429), atau model tak tersedia/pensiun -> coba model berikutnya.
      const modelUnavailable = response.status === 404 ||
        /no longer available|not found|not supported|deprecated|not available to new users|unavailable/i.test(msg)
      if (response.status !== 503 && response.status !== 429 && !modelUnavailable) {
        await catat(false)
        return res.status(response.status).json(data) // error permintaan lain -> berhenti
      }
    } catch (err) {
      lastStatus = 500
      lastErrorBody = { error: { message: err.message || 'Gagal menghubungi Gemini API.' } }
      tried.push(`${model}: ${err.message || 'network error'}`)
    }
  }

  await catat(false)
  const detail = (lastErrorBody && lastErrorBody.error && lastErrorBody.error.message) || 'Semua model Gemini sedang sibuk atau tidak tersedia.'
  return res.status(lastStatus).json({
    error: { message: `${detail} (dicoba: ${tried.join(', ') || 'tidak ada model'})` },
  })
}
