// Vercel Serverless Function — proxy ke Gemini Imagen (gambar ilustrasi).

const MODEL = 'imagen-4.0-generate-001'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di environment variable Vercel.' })
  }

  const { prompt } = req.body || {}
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt gambar kosong.' })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
        }),
      }
    )

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menghasilkan gambar.' })
  }
}
