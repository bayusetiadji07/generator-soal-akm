// Helper bersama untuk cek/aktivasi kode akses (dipakai verify-access.js dan sebagai gerbang
// di generate.js/generate-deepseek.js agar kode yang dinonaktifkan penjual benar-benar berhenti
// bisa memakai kuota AI, bukan cuma diblokir di tampilan).
//
// Tabel: sigatot_access_codes (project Supabase "bayusetiadji07's Project", id wddfpmsurcftapbczise)
// RLS aktif tanpa policy apapun — HANYA bisa diakses lewat service_role key di sini (server-side).

const SUPABASE_URL = 'https://wddfpmsurcftapbczise.supabase.co'

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

export async function findAccessCode(codeNorm) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'no_service_key' }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sigatot_access_codes?code=eq.${encodeURIComponent(codeNorm)}&select=*`,
    { headers: headers() }
  )
  if (!res.ok) return { error: 'fetch_failed' }
  const rows = await res.json()
  return { row: Array.isArray(rows) && rows.length ? rows[0] : null }
}

export async function patchAccessCode(codeNorm, patch) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sigatot_access_codes?code=eq.${encodeURIComponent(codeNorm)}`,
    { method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' }, body: JSON.stringify(patch) }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Dipakai generate.js/generate-deepseek.js: kembalikan {ok:true} kalau kode+deviceToken valid & aktif,
// {ok:false, message} kalau tidak (belum aktivasi, dinonaktifkan, atau device tidak cocok).
export async function verifyAccessForApi(code, deviceToken) {
  if (!code || !deviceToken) {
    return { ok: false, status: 401, message: 'Sesi akses tidak ditemukan. Silakan masuk ulang dengan kode akses Anda.' }
  }
  const { row, error } = await findAccessCode(normalizeCode(code))
  if (error) return { ok: false, status: 500, message: 'Gagal memeriksa akses ke server. Coba lagi.' }
  if (!row || !row.is_active) {
    return { ok: false, status: 403, message: 'Kode akses tidak valid atau sudah dinonaktifkan. Hubungi penjual.' }
  }
  if (row.device_token && row.device_token !== deviceToken) {
    return { ok: false, status: 403, message: 'Kode akses ini sedang aktif di perangkat lain. Hubungi penjual untuk memindahkan akses.' }
  }
  return { ok: true }
}
