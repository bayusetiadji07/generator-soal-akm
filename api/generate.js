// Vercel Serverless Function — proxy ke Gemini (teks).
// API key disimpan di server (process.env.GEMINI_API_KEY), tidak pernah terekspos ke browser.

const MODEL = 'gemini-2.5-flash-preview-09-2025'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di environment variable Vercel.' })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      }
    )

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menghubungi Gemini API.' })
  }
}
