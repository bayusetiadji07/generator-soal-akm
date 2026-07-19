// Vercel Serverless Function — penerima webhook Lynk.id.
//
// Daftarkan URL ini di Lynk.id: Settings > Integrations > Webhooks, dengan format:
//   https://<domain-app-anda>/api/lynk-webhook?key=<LYNK_WEBHOOK_SECRET>
// Event yang dipilih: order.paid / order.completed (transaksi sukses).
//
// KEAMANAN: verifikasi dilakukan lewat secret di query URL (?key=...), BUKAN signature
// HMAC bawaan Lynk.id — karena rumus signature resmi Lynk.id tidak berhasil dipastikan dari
// dokumentasi publik saat fitur ini dibuat. Pola "URL rahasia" ini sama seperti dipakai
// integrasi Mailketing/StarSender ke Lynk.id, dan cukup aman selama LYNK_WEBHOOK_SECRET
// panjang & acak serta tidak pernah dibagikan.
//
// TOLERAN terhadap bentuk payload: struktur JSON asli dari Lynk.id belum bisa dipastikan
// 100% dari dokumentasi publik, jadi ekstraksi field mencoba beberapa kemungkinan nama field
// yang lazim dipakai (name/nama, email, product/product_title, ref_id/order_id, dst) dan body
// mentahnya di-log supaya bisa disesuaikan kalau ternyata ada field yang meleset.

import { generateAccessCode, findByRefId, insertAccessCode } from './_lib/access.js'
import { sendAccessCodeEmail } from './_lib/email.js'

function pick(obj, paths) {
  for (const path of paths) {
    const val = path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
    if (val !== undefined && val !== null && val !== '') return val
  }
  return null
}

export default async function handler(req, res) {
  // Beberapa penyedia webhook mem-ping URL dengan GET saat pertama didaftarkan, cukup balas ok.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Endpoint webhook Lynk.id siap.' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  try {
    const expectedKey = process.env.LYNK_WEBHOOK_SECRET
    const receivedKey = req.query?.key
    if (!expectedKey) {
      console.error('lynk-webhook: LYNK_WEBHOOK_SECRET belum diset di server')
      return res.status(500).json({ ok: false, message: 'Server belum dikonfigurasi.' })
    }
    if (receivedKey !== expectedKey) {
      console.error('lynk-webhook: key tidak cocok, request ditolak')
      return res.status(401).json({ ok: false, message: 'Unauthorized' })
    }

    const body = req.body || {}
    // Log mentah dulu (sebelum diproses) supaya bentuk payload asli Lynk.id bisa dicek di
    // Vercel > Runtime Logs kalau ternyata ada field yang tidak terbaca oleh pick() di bawah.
    console.log('lynk-webhook: payload diterima:', JSON.stringify(body))

    const eventName = pick(body, ['event', 'event_type', 'type']) || ''
    const isPaidEvent = !eventName || /paid|completed|success|sukses/i.test(String(eventName))
    if (!isPaidEvent) {
      // Event lain (mis. order.refunded) — terima tapi tidak bikin kode
      return res.status(200).json({ ok: true, skipped: true, reason: `event ${eventName} diabaikan` })
    }

    const refId = pick(body, ['data.ref_id', 'ref_id', 'data.order_id', 'order_id', 'data.id', 'id'])
    const nama = pick(body, ['data.name', 'name', 'data.nama', 'nama', 'data.customer_name', 'customer_name'])
    const email = pick(body, ['data.email', 'email', 'data.customer_email', 'customer_email'])
    const phone = pick(body, ['data.phone', 'phone', 'data.whatsapp', 'whatsapp', 'data.no_wa'])
    const produk = pick(body, ['data.product_title', 'product_title', 'data.product_name', 'product_name'])

    // Filter produk opsional: kalau akun Lynk.id juga menjual produk lain, hanya proses yang
    // namanya mengandung teks ini (set env LYNK_PRODUCT_FILTER, kosongkan utk proses semua).
    const filter = (process.env.LYNK_PRODUCT_FILTER || '').trim().toLowerCase()
    if (filter && produk && !String(produk).toLowerCase().includes(filter)) {
      return res.status(200).json({ ok: true, skipped: true, reason: `produk "${produk}" tidak cocok filter` })
    }

    if (!email) {
      console.error('lynk-webhook: tidak ada field email yang terbaca dari payload, kode tidak bisa dikirim')
      return res.status(200).json({ ok: false, message: 'Email pembeli tidak ditemukan di payload.' })
    }

    // Idempoten: kalau ref_id ini sudah pernah diproses (Lynk.id sering retry webhook), jangan
    // buat kode baru / kirim email lagi.
    if (refId) {
      const existing = await findByRefId(String(refId))
      if (existing) {
        return res.status(200).json({ ok: true, already_processed: true, code: existing.code })
      }
    }

    const code = generateAccessCode()
    const { row, error } = await insertAccessCode({
      code,
      nama_pembeli: nama || null,
      email: email || null,
      phone: phone || null,
      ref_id: refId ? String(refId) : null,
      source: 'lynk',
      is_active: true,
    })
    if (error || !row) {
      console.error('lynk-webhook: gagal simpan kode akses:', error)
      return res.status(500).json({ ok: false, message: 'Gagal membuat kode akses.' })
    }

    const emailResult = await sendAccessCodeEmail({ to: email, nama, code, produk })
    if (!emailResult.ok) {
      console.error('lynk-webhook: kode tersimpan tapi email gagal terkirim:', emailResult.error)
    }

    return res.status(200).json({ ok: true, code, email_sent: emailResult.ok })
  } catch (err) {
    console.error('lynk-webhook: error tak terduga:', err)
    return res.status(200).json({ ok: false, message: `Kesalahan server: ${err?.message || 'tidak diketahui'}` })
  }
}
