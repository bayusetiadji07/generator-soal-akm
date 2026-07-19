// Vercel Serverless Function — proxy ke DeepSeek (teks, kompatibel format OpenAI chat).
// API key DIUTAMAKAN dari input pengguna (dikirim di body), fallback ke env server DEEPSEEK_API_KEY.
//
// CATATAN: DeepSeek TIDAK mendukung gambar (vision/multimodal). Bagian inlineData (gambar upload
// guru) diabaikan di sini — validasi & peringatan ke user sudah dilakukan di frontend sebelum kirim.
//
// Respons dikonversi ke BENTUK YANG SAMA seperti Gemini (candidates[0].content.parts[0].text)
// supaya kode frontend (fetchWithRetry, dst.) tidak perlu cabang logika terpisah per provider.

import { verifyApprovedUser } from './_lib/auth.js'

export const maxDuration = 60

const MODELS = ['deepseek-chat', 'deepseek-reasoner']

// Gabungkan payload bergaya Gemini (contents[].parts[].text) jadi teks polos untuk DeepSeek
function extractText(payload) {
  const contents = payload?.contents || []
  const chunks = []
  for (const c of contents) {
    for (const p of c.parts || []) {
      if (typeof p.text === 'string') chunks.push(p.text)
      // p.inlineData (gambar) sengaja dilewati — DeepSeek tidak bisa melihat gambar
    }
  }
  return chunks.join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}

  const access = await verifyApprovedUser(body.accessToken)
  if (!access.ok) {
    return res.status(access.status).json({ error: { message: access.message } })
  }

  const userKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const payload = body.payload || body
  const apiKey = userKey || process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key DeepSeek belum diisi. Masukkan API Key Anda di aplikasi (dapatkan di platform.deepseek.com/api_keys).' })
  }

  const systemText = payload?.systemInstruction?.parts?.[0]?.text || ''
  const userText = extractText(payload)
  const maxTokensRequested = payload?.generationConfig?.maxOutputTokens
  // DeepSeek membatasi output jauh lebih rendah dari Gemini (maks 8K token keluaran)
  const maxTokens = Math.min(typeof maxTokensRequested === 'number' ? maxTokensRequested : 8192, 8192)
  const temperature = payload?.generationConfig?.temperature ?? 0.9

  const messages = []
  if (systemText) messages.push({ role: 'system', content: systemText })
  messages.push({ role: 'user', content: userText })

  let lastErrorBody = null
  let lastStatus = 500

  for (const model of MODELS) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const text = data?.choices?.[0]?.message?.content || ''
        // Bentuk ulang jadi struktur ala Gemini agar frontend tak perlu logika terpisah
        return res.status(200).json({
          candidates: [{ content: { parts: [{ text }] } }],
        })
      }

      lastStatus = response.status
      lastErrorBody = { error: { message: data?.error?.message || `HTTP ${response.status}` } }

      // Overload/rate-limit → coba model cadangan; error lain (key salah, dll) langsung berhenti
      if (response.status !== 503 && response.status !== 429) {
        return res.status(response.status).json(lastErrorBody)
      }
    } catch (err) {
      lastStatus = 500
      lastErrorBody = { error: { message: err.message || 'Gagal menghubungi DeepSeek API.' } }
    }
  }

  return res.status(lastStatus).json(
    lastErrorBody || { error: { message: 'Semua model DeepSeek sedang sibuk. Coba lagi beberapa saat.' } }
  )
}
