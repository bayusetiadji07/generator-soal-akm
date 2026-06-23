// Vercel Serverless Function — proxy ke Pollinations.ai (generator gambar AI GRATIS, tanpa API key).
// Diambil di sisi server agar bebas masalah CORS, lalu dikembalikan sebagai data URL base64
// supaya bisa dikecilkan di browser & tertanam (embed) di file Word.

export const maxDuration = 60 // beri waktu cukup; generasi gambar bisa beberapa detik

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body || {}
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt gambar kosong.' })
  }

  const seed = Math.floor(Math.random() * 1_000_000)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=400&nologo=true&model=flux&seed=${seed}`

  try {
    const r = await fetch(url)
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return res.status(r.status).json({
        error: `Sumber gambar error ${r.status}${txt ? ': ' + txt.slice(0, 160) : ''}`,
      })
    }
    const arrayBuffer = await r.arrayBuffer()
    const contentType = r.headers.get('content-type') || 'image/jpeg'
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return res.status(200).json({ dataUrl: `data:${contentType};base64,${base64}` })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal mengambil gambar dari sumber.' })
  }
}
