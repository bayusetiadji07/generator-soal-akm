// Pemeriksaan KODE (bukan AI) atas hasil: keselarasan TP dan jumlah menit (F6, F7).

import type { ModulAjar, Lkpd, FormModul } from './modulSchema'
import { NAMA_TAHAP } from './templat'

export interface Peringatan {
  tingkat: 'galat' | 'peringatan'
  kode: 'tp-kegiatan' | 'tp-lkpd' | 'tp-asesmen' | 'tp-asing' | 'menit' | 'jumlah-pertemuan' | 'tahap' | 'asesmen-jenis'
  pesan: string
  /** kunci bagian yang bisa dibuat ulang (lihat ModulMode), bila ada */
  bagian?: string
}

export interface BarisPeta {
  kode: string
  teks: string
  kegiatan: string[] // mis. "P1 Memahami"
  lkpd: string[] // mis. "LKPD 1 no. 2"
  asesmen: string[] // mis. "Proses"
}

export function totalMenitTarget(f: Pick<FormModul, 'jpPerPertemuan' | 'menitPerJp'>): number {
  return f.jpPerPertemuan * f.menitPerJp
}

export function petaKeselarasan(m: ModulAjar, lkpd: Lkpd[]): BarisPeta[] {
  return m.desain.tujuan.map((t) => {
    const kegiatan: string[] = []
    for (const p of m.pertemuan) {
      for (const k of p.kegiatan) {
        if (k.tp.includes(t.kode)) kegiatan.push(`P${p.ke} ${NAMA_TAHAP[k.tahap]?.replace('Inti — ', '') || k.tahap}`)
      }
    }
    const lk: string[] = []
    for (const l of lkpd) {
      for (const tg of l.mengaplikasi) {
        if (tg.tp.includes(t.kode)) lk.push(`LKPD ${l.ke} no. ${tg.no}`)
      }
    }
    const ases = m.asesmen.filter((a) => a.tp.includes(t.kode)).map((a) => a.jenis[0].toUpperCase() + a.jenis.slice(1))
    return { kode: t.kode, teks: t.teks, kegiatan, lkpd: lk, asesmen: ases }
  })
}

/**
 * @param lkpdDiminta apakah LKPD ikut diminta guru; bila ya, TP yang tak muncul di tugas LKPD diperingatkan
 */
export function periksaModul(m: ModulAjar, lkpd: Lkpd[], f: FormModul, lkpdDiminta: boolean): Peringatan[] {
  const out: Peringatan[] = []
  const kodeAda = new Set(m.desain.tujuan.map((t) => t.kode))

  if (m.pertemuan.length !== f.jumlahPertemuan) {
    out.push({
      tingkat: 'galat',
      kode: 'jumlah-pertemuan',
      pesan: `Jumlah pertemuan ${m.pertemuan.length}, padahal diminta ${f.jumlahPertemuan}.`,
    })
  }

  // F6 — tiap TP minimal muncul di satu kegiatan, satu tugas LKPD, satu asesmen
  const peta = petaKeselarasan(m, lkpd)
  for (const b of peta) {
    if (!b.kegiatan.length) out.push({ tingkat: 'peringatan', kode: 'tp-kegiatan', pesan: `${b.kode} belum muncul di kegiatan pembelajaran mana pun.`, bagian: 'pertemuan' })
    if (!b.asesmen.length) out.push({ tingkat: 'peringatan', kode: 'tp-asesmen', pesan: `${b.kode} belum diasesmen (tidak ada asesmen yang memuatnya).`, bagian: 'asesmen' })
    if (lkpdDiminta && lkpd.length && !b.lkpd.length) {
      out.push({ tingkat: 'peringatan', kode: 'tp-lkpd', pesan: `${b.kode} belum muncul di tugas LKPD mana pun.`, bagian: 'lkpd' })
    }
  }

  // Rujukan TP yang tidak ada di daftar tujuan
  const asing = new Set<string>()
  for (const p of m.pertemuan) for (const k of p.kegiatan) for (const c of k.tp) if (!kodeAda.has(c)) asing.add(c)
  for (const a of m.asesmen) for (const c of a.tp) if (!kodeAda.has(c)) asing.add(c)
  for (const l of lkpd) for (const t of l.mengaplikasi) for (const c of t.tp) if (!kodeAda.has(c)) asing.add(c)
  if (asing.size) {
    out.push({ tingkat: 'peringatan', kode: 'tp-asing', pesan: `Ada rujukan ke TP yang tidak terdaftar: ${[...asing].join(', ')}.` })
  }

  // F7 — jumlah menit tiap pertemuan = JP × menit per JP
  const target = totalMenitTarget(f)
  for (const p of m.pertemuan) {
    const total = p.kegiatan.reduce((s, k) => s + k.menit, 0)
    if (total !== target) {
      out.push({
        tingkat: 'galat',
        kode: 'menit',
        pesan: `Pertemuan ${p.ke}: total ${total} menit, seharusnya ${target} menit (${f.jpPerPertemuan} JP × ${f.menitPerJp} menit).`,
        bagian: `p:${p.ke}`,
      })
    }
    const adaTahap = new Set(p.kegiatan.map((k) => k.tahap))
    const kurang = (['memahami', 'mengaplikasi', 'merefleksi'] as const).filter((t) => !adaTahap.has(t))
    if (kurang.length) {
      out.push({
        tingkat: 'peringatan',
        kode: 'tahap',
        pesan: `Pertemuan ${p.ke} belum memuat tahap: ${kurang.join(', ')}.`,
        bagian: `p:${p.ke}`,
      })
    }
  }

  const jenis = new Set(m.asesmen.map((a) => a.jenis))
  const kurangAses = (['awal', 'proses', 'akhir'] as const).filter((j) => !jenis.has(j))
  if (kurangAses.length) {
    out.push({ tingkat: 'peringatan', kode: 'asesmen-jenis', pesan: `Asesmen ${kurangAses.join(', ')} belum ada.`, bagian: 'asesmen' })
  }

  return out
}

/**
 * Sesuaikan menit satu pertemuan ke target dengan skala proporsional (kelipatan 5 bila memungkinkan,
 * selisih sisa dimasukkan ke kegiatan terpanjang). Hanya angka menit yang berubah, bukan teks.
 */
export function sesuaikanMenit(m: ModulAjar, ke: number, target: number): ModulAjar {
  const salinan: ModulAjar = JSON.parse(JSON.stringify(m))
  const p = salinan.pertemuan.find((x) => x.ke === ke)
  if (!p || !p.kegiatan.length) return salinan
  const total = p.kegiatan.reduce((s, k) => s + k.menit, 0)
  if (total === target) return salinan
  if (total <= 0) {
    const bagi = Math.floor(target / p.kegiatan.length)
    p.kegiatan.forEach((k) => (k.menit = bagi))
  } else {
    p.kegiatan.forEach((k) => {
      const skala = (k.menit * target) / total
      k.menit = Math.max(1, Math.round(skala / 5) * 5 || 5)
    })
  }
  const sisa = target - p.kegiatan.reduce((s, k) => s + k.menit, 0)
  if (sisa !== 0) {
    const terpanjang = p.kegiatan.reduce((a, b) => (b.menit > a.menit ? b : a))
    terpanjang.menit = Math.max(1, terpanjang.menit + sisa)
  }
  return salinan
}
