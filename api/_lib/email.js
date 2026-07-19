// Kirim email transaksional via Resend (https://resend.com) — dipakai webhook Lynk.id untuk
// mengirim kode akses ke pembeli otomatis setelah pembayaran sukses.
//
// PENTING: sender default Resend (onboarding@resend.dev) HANYA bisa kirim ke email pemilik akun
// Resend sendiri (mode sandbox). Untuk kirim ke email pembeli sungguhan, WAJIB verifikasi domain
// sendiri di Resend Dashboard > Domains, lalu set RESEND_FROM_EMAIL ke alamat di domain itu.

export async function sendAccessCodeEmail({ to, nama, code, produk }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    return { ok: false, error: 'RESEND_API_KEY atau RESEND_FROM_EMAIL belum diset' }
  }

  const namaTampil = nama || 'Pelanggan'
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#1f2937;">Terima kasih, ${namaTampil}!</h2>
      <p>Berikut kode akses untuk ${produk || 'Si Gatot — Sistem Generator Tes Otomatis'}:</p>
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:16px;text-align:center;margin:16px 0;">
        <span style="font-size:22px;font-weight:800;letter-spacing:2px;color:#3730a3;">${code}</span>
      </div>
      <p>Cara pakai: buka aplikasinya, masukkan nama dan kode akses di atas, lalu klik "Masuk".</p>
      <p style="color:#6b7280;font-size:13px;">Kode ini hanya bisa dipakai di satu perangkat/browser. Simpan baik-baik dan jangan bagikan ke orang lain.</p>
    </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Kode Akses ${produk || 'Si Gatot'} Anda: ${code}`,
        html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      return { ok: false, error: `resend_failed_${res.status}: ${detail}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `network_error: ${err?.message || err}` }
  }
}
