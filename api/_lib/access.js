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
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_access_codes?code=eq.${encodeURIComponent(codeNorm)}&select=*`,
      { headers: headers() }
    )
    if (!res.ok) return { error: `fetch_failed_${res.status}` }
    const rows = await res.json()
    return { row: Array.isArray(rows) && rows.length ? rows[0] : null }
  } catch (err) {
    return { error: `network_error: ${err?.message || err}` }
  }
}

export async function patchAccessCode(codeNorm, patch) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_access_codes?code=eq.${encodeURIComponent(codeNorm)}`,
      { method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' }, body: JSON.stringify(patch) }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
  } catch {
    return null
  }
}

// Bikin kode akses baru & simpan ke tabel. Dipakai webhook Lynk.id (source='lynk') dan nantinya
// halaman admin generate manual (source='manual'). refId dipakai utk cegah duplikat saat webhook
// yang sama terkirim ulang (Lynk.id lazim me-retry kalau tidak dapat respons 200 tepat waktu).
export function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa 0/O/1/I yg gampang salah baca
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `SIGATOT-${part()}-${part()}`
}

export async function findByRefId(refId) {
  if (!refId) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_access_codes?ref_id=eq.${encodeURIComponent(refId)}&select=*`,
      { headers: headers() }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
  } catch {
    return null
  }
}

export async function insertAccessCode(row) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sigatot_access_codes`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    if (!res.ok) return { error: `insert_failed_${res.status}: ${await res.text()}` }
    const rows = await res.json()
    return { row: Array.isArray(rows) && rows.length ? rows[0] : null }
  } catch (err) {
    return { error: `network_error: ${err?.message || err}` }
  }
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
