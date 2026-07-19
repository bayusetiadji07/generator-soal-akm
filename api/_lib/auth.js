// Helper bersama utk model akses "signup email + approval admin".
// Dipakai generate.js/generate-deepseek.js (gerbang server-side) dan api/admin-*.js.
//
// Tabel: sigatot_profiles (project Supabase "bayusetiadji07's Project", id wddfpmsurcftapbczise)
// RLS aktif, hanya policy SELECT utk baris milik sendiri — approve/reject HANYA lewat
// service_role di sini (server-side), tidak pernah dari client.

const SUPABASE_URL = 'https://wddfpmsurcftapbczise.supabase.co'
// Publishable/anon key — aman ditulis di server juga, dipakai khusus utk memvalidasi access
// token milik user (endpoint GoTrue /auth/v1/user butuh SATU apikey project yang valid,
// terpisah dari Authorization: Bearer <token milik user> yang membuktikan identitasnya).
const ANON_KEY = 'sb_publishable_kbPqKDodER85J6w3qls1UQ_iitjQFlm'

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export async function getUserFromToken(accessToken) {
  if (!accessToken) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getProfile(userId) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
      { headers: serviceHeaders() }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
  } catch {
    return null
  }
}

// Dipakai generate.js/generate-deepseek.js: pastikan token sesi valid DAN akunnya sudah
// disetujui admin, sebelum boleh memakai kuota AI berbayar.
export async function verifyApprovedUser(accessToken) {
  const user = await getUserFromToken(accessToken)
  if (!user || !user.id) {
    return { ok: false, status: 401, message: 'Sesi login tidak valid atau sudah kedaluwarsa. Silakan masuk ulang.' }
  }
  const profile = await getProfile(user.id)
  if (!profile) {
    return { ok: false, status: 403, message: 'Profil akun tidak ditemukan. Hubungi admin.' }
  }
  if (!profile.is_approved) {
    return { ok: false, status: 403, message: 'Akun Anda belum disetujui admin.' }
  }
  return { ok: true, user, profile }
}

// ===== Dipakai api/admin-*.js =====

export function checkAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD
  return !!expected && password === expected
}

export async function listProfiles() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?select=*&order=created_at.desc`,
      { headers: serviceHeaders() }
    )
    if (!res.ok) return { error: `fetch_failed_${res.status}` }
    return { rows: await res.json() }
  } catch (err) {
    return { error: `network_error: ${err?.message || err}` }
  }
}

export async function setApproval(userId, approve) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sigatot_profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify({ is_approved: !!approve, approved_at: approve ? new Date().toISOString() : null }),
      }
    )
    if (!res.ok) return { error: `patch_failed_${res.status}` }
    const rows = await res.json()
    return { row: Array.isArray(rows) && rows.length ? rows[0] : null }
  } catch (err) {
    return { error: `network_error: ${err?.message || err}` }
  }
}
