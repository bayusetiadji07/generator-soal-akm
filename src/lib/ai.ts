// Pemanggil AI bersama (dipakai App.tsx untuk AKM/TKA dan src/modul untuk Modul Ajar & LKPD).
// Lewat proxy server /api/generate (Gemini) atau /api/generate-deepseek, dengan gerbang akses akun.

import { supabase } from '../supabaseClient'

export interface OpsiAI {
  provider: 'gemini' | 'deepseek' | string
  apiKey: string
  apiKeySource: 'bawaan' | 'custom' | string
  /** nama mode untuk catatan pemakaian di server: 'akm' | 'tka' | 'modul' */
  mode?: string
  retries?: number
}

// Kesalahan yang tidak akan sembuh dengan mengulang (key salah, akun ditolak, permintaan keliru).
class GalatTetap extends Error {}

const JEDA = [1000, 2000, 4000, 8000, 16000]

async function bacaGalat(response: Response): Promise<string> {
  const status = response.status
  let teks = ''
  try {
    teks = await response.text()
  } catch { /* abaikan */ }
  try {
    const body = JSON.parse(teks)
    const msg = body?.error?.message || body?.error
    if (msg) return String(msg)
  } catch { /* bukan JSON */ }
  if (status === 504 || status === 502 || /FUNCTION_INVOCATION_TIMEOUT|timed? ?out/i.test(teks)) {
    return 'Server kehabisan waktu (batas 60 detik per panggilan). Coba lagi, kurangi jumlah pertemuan, atau pakai model yang lebih cepat.'
  }
  return `HTTP ${status}`
}

export async function kirimKeAI(payload: any, opsi: OpsiAI): Promise<any> {
  const retries = opsi.retries ?? 5
  const endpoint = opsi.provider === 'deepseek' ? '/api/generate-deepseek' : '/api/generate'
  for (let i = 0; i < retries; i++) {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: opsi.apiKeySource === 'bawaan' ? '' : opsi.apiKey,
          payload,
          accessToken: sessionData.session?.access_token || '',
          meta: { mode: opsi.mode || '' },
        }),
      })
      if (!response.ok) {
        const detail = await bacaGalat(response)
        if ([400, 401, 403, 404].includes(response.status)) throw new GalatTetap(detail)
        throw new Error(detail)
      }
      return await response.json()
    } catch (err) {
      if (err instanceof GalatTetap || i === retries - 1) throw err
      await new Promise((r) => setTimeout(r, JEDA[i] ?? 16000))
    }
  }
}

/** Teks jawaban pertama dari bentuk respons ala Gemini. */
export function teksDariHasil(result: any): string {
  return result?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}
