// Vercel Serverless Function — proxy ke Gemini (teks).
// API key disimpan di server (process.env.GEMINI_API_KEY), tidak pernah terekspos ke browser.
//
// Tahan banting: kalau model utama sedang overload (503) atau kena limit (429),
// otomatis mencoba model cadangan secara berurutan.

export const maxDuration = 60

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di environment variable Vercel.' })
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
          body: JSON.stringify(req.body),
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
