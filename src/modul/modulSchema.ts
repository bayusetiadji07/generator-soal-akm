// Tipe data + normalisasi keluaran AI (JSON) untuk modul ajar dan LKPD.
// CP SENGAJA tidak ada di skema: kode menyisipkannya apa adanya dari isian guru.

import { DIMENSI_PROFIL, PRINSIP, TAHAP, JENIS_ASESMEN } from './templat'

export interface FormModul {
  sekolah: string
  penyusun: string
  jenjang: string // 'SD' | 'SMP' | 'SMA'
  kelas: string
  fase: string
  mapel: string
  topik: string
  jumlahPertemuan: number
  jpPerPertemuan: number
  menitPerJp: number
  cp: string // ditempel guru, dicetak apa adanya
  dimensi: string[] // kosong = sistem memilihkan
  praktik: string[] // kosong = sistem memilihkan
  kondisiMurid: string
  sarana: string
  konteksLokal: string
  media: string // tautan media digital, satu per baris
  keluaran: 'keduanya' | 'modul' | 'lkpd'
}

export interface Tujuan { kode: string; teks: string }
export interface Kegiatan { tahap: string; menit: number; uraian: string; prinsip: string[]; tp: string[] }
export interface Pertemuan { ke: number; kegiatan: Kegiatan[] }
export interface Asesmen { jenis: string; teknik: string; rubrik: string; tp: string[] }

export interface ModulAjar {
  identifikasi: { kesiapanMurid: string; karakteristikMateri: string; dimensi: string[] }
  desain: {
    tujuan: Tujuan[]
    lintasDisiplin: string
    praktikPedagogis: string
    kemitraan: string
    lingkungan: string
    pemanfaatanDigital: string
  }
  pertemuan: Pertemuan[]
  asesmen: Asesmen[]
}

export interface TugasLkpd { no: number; teks: string; tp: string[] }
export interface Lkpd {
  ke: number
  judul: string
  tujuanMurid: string[]
  petunjuk: string[]
  pemantik: string
  memahami: { kegiatan: string[]; tabelKolom: string[]; tabelBaris: number }
  mengaplikasi: TugasLkpd[]
  merefleksi: string[]
  guru: { kunci: { no: number; jawaban: string }[]; rubrik: string; catatan: string }
}

// ===== Pembacaan JSON dari teks AI =====

export function parseJsonLoose(text: string): any {
  let t = String(text || '').trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('Jawaban AI tidak berbentuk JSON (kemungkinan terpotong). Coba generate ulang, atau pakai Gemini bila memakai DeepSeek.')
  const potongan = t.slice(a, b + 1)
  try {
    return JSON.parse(potongan)
  } catch {
    // koma menggantung yang kadang dihasilkan model
    try {
      return JSON.parse(potongan.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      throw new Error('JSON dari AI rusak/terpotong. Coba generate ulang, atau pakai Gemini bila memakai DeepSeek.')
    }
  }
}

// ===== Normalisasi: paksa ke bentuk aman supaya tampilan & Word tidak pernah crash =====

const str = (v: any): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const arr = (v: any): any[] => (Array.isArray(v) ? v : [])
const strArr = (v: any): string[] => arr(v).map(str).filter(Boolean)
const kodeTp = (v: any): string => str(v).toUpperCase().replace(/\s+/g, '')
const tpArr = (v: any): string[] => {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]/) : []
  return [...new Set(raw.map(kodeTp).filter(Boolean))]
}
const num = (v: any, d = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? Math.round(n) : d
}

export function normalisasiModul(raw: any): ModulAjar {
  const r = raw && typeof raw === 'object' ? raw : {}
  const idf = r.identifikasi || {}
  const dsn = r.desain || {}
  const dimensi = strArr(idf.dimensi)
    .map((d) => DIMENSI_PROFIL.find((x) => x.toLowerCase() === d.toLowerCase()) || d)
    .slice(0, 3)
  return {
    identifikasi: {
      kesiapanMurid: str(idf.kesiapanMurid),
      karakteristikMateri: str(idf.karakteristikMateri),
      dimensi,
    },
    desain: {
      tujuan: arr(dsn.tujuan)
        .map((t: any, i: number) => ({ kode: kodeTp(t?.kode) || `TP${i + 1}`, teks: str(t?.teks) }))
        .filter((t) => t.teks),
      lintasDisiplin: str(dsn.lintasDisiplin),
      praktikPedagogis: str(dsn.praktikPedagogis),
      kemitraan: str(dsn.kemitraan),
      lingkungan: str(dsn.lingkungan),
      pemanfaatanDigital: str(dsn.pemanfaatanDigital),
    },
    pertemuan: arr(r.pertemuan).map((p: any, i: number) => normalisasiPertemuan(p, i + 1)),
    asesmen: arr(r.asesmen).map(normalisasiAsesmen).filter((a) => a.teknik || a.rubrik),
  }
}

export function normalisasiPertemuan(p: any, keDefault: number): Pertemuan {
  return {
    ke: num(p?.ke, keDefault) || keDefault,
    kegiatan: arr(p?.kegiatan)
      .map((k: any) => ({
        tahap: (TAHAP as readonly string[]).includes(str(k?.tahap).toLowerCase()) ? str(k.tahap).toLowerCase() : 'memahami',
        menit: Math.max(0, num(k?.menit, 0)),
        uraian: str(k?.uraian),
        prinsip: strArr(k?.prinsip)
          .map((x) => x.toLowerCase())
          .filter((x) => (PRINSIP as readonly string[]).includes(x)),
        tp: tpArr(k?.tp),
      }))
      .filter((k) => k.uraian),
  }
}

export function normalisasiAsesmen(a: any): Asesmen {
  const jenis = str(a?.jenis).toLowerCase()
  return {
    jenis: (JENIS_ASESMEN as readonly string[]).includes(jenis) ? jenis : 'proses',
    teknik: str(a?.teknik),
    rubrik: str(a?.rubrik),
    tp: tpArr(a?.tp),
  }
}

export function normalisasiLkpd(raw: any, ke: number): Lkpd {
  const r = raw && typeof raw === 'object' ? raw : {}
  const mm = r.memahami || {}
  const gr = r.guru || {}
  return {
    ke,
    judul: str(r.judul),
    tujuanMurid: strArr(r.tujuanMurid),
    petunjuk: strArr(r.petunjuk),
    pemantik: str(r.pemantik),
    memahami: {
      kegiatan: strArr(mm.kegiatan),
      tabelKolom: strArr(mm.tabelKolom).slice(0, 6),
      tabelBaris: Math.min(12, Math.max(0, num(mm.tabelBaris, 3))),
    },
    mengaplikasi: arr(r.mengaplikasi)
      .map((t: any, i: number) => ({ no: i + 1, teks: str(t?.teks), tp: tpArr(t?.tp) }))
      .filter((t) => t.teks),
    merefleksi: strArr(r.merefleksi).slice(0, 4),
    guru: {
      kunci: arr(gr.kunci)
        .map((k: any, i: number) => ({ no: num(k?.no, i + 1) || i + 1, jawaban: str(k?.jawaban) }))
        .filter((k) => k.jawaban),
      rubrik: str(gr.rubrik),
      catatan: str(gr.catatan),
    },
  }
}

/** Bagian kosong pada modul (F-uji: "tanpa bagian kosong"). Mengembalikan nama bagian yang kosong. */
export function bagianKosong(m: ModulAjar): string[] {
  const k: string[] = []
  if (!m.identifikasi.kesiapanMurid) k.push('Kesiapan murid')
  if (!m.identifikasi.karakteristikMateri) k.push('Karakteristik materi')
  if (!m.identifikasi.dimensi.length) k.push('Dimensi profil lulusan')
  if (!m.desain.tujuan.length) k.push('Tujuan pembelajaran')
  if (!m.desain.lintasDisiplin) k.push('Lintas disiplin ilmu')
  if (!m.desain.praktikPedagogis) k.push('Praktik pedagogis')
  if (!m.desain.kemitraan) k.push('Kemitraan pembelajaran')
  if (!m.desain.lingkungan) k.push('Lingkungan pembelajaran')
  if (!m.desain.pemanfaatanDigital) k.push('Pemanfaatan digital')
  if (!m.pertemuan.length) k.push('Pengalaman belajar')
  if (!m.asesmen.length) k.push('Asesmen')
  return k
}
