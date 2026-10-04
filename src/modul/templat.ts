// Istilah baku Generator Modul Ajar & LKPD Pembelajaran Mendalam — SATU-SATUNYA tempat istilah ditulis.
// Kalau regulasi/panduan berubah, cukup ubah berkas ini (dan modulSchema.ts bila bentuk data ikut berubah).
//
// Sumber: kerangka Pembelajaran Mendalam (Kemendikdasmen) lewat sumber sekunder imrantululi.net
// (delapan dimensi, tiga prinsip, tiga pengalaman belajar, empat komponen perencanaan).
// BELUM dicocokkan ke naskah resmi Panduan Pembelajaran dan Asesmen 2025 maupun Permendikdasmen
// No. 1/2026 — cocokkan dulu sebelum dokumen dipakai untuk administrasi yang diperiksa pengawas.

export const DIMENSI_PROFIL = [
  'Keimanan dan ketakwaan terhadap Tuhan YME',
  'Kewargaan',
  'Penalaran kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const

export const PRINSIP = ['berkesadaran', 'bermakna', 'menggembirakan'] as const

export const PENGALAMAN_BELAJAR = ['memahami', 'mengaplikasi', 'merefleksi'] as const

// Urutan tahap kegiatan dalam satu pertemuan: awal -> tiga pengalaman belajar -> penutup.
export const TAHAP = ['awal', 'memahami', 'mengaplikasi', 'merefleksi', 'penutup'] as const

export const NAMA_TAHAP: Record<string, string> = {
  awal: 'Kegiatan awal',
  memahami: 'Inti — Memahami',
  mengaplikasi: 'Inti — Mengaplikasi',
  merefleksi: 'Inti — Merefleksi',
  penutup: 'Penutup',
}

export const JENIS_ASESMEN = ['awal', 'proses', 'akhir'] as const

export const NAMA_ASESMEN: Record<string, string> = {
  awal: 'Asesmen awal (diagnostik)',
  proses: 'Asesmen proses (formatif)',
  akhir: 'Asesmen akhir (sumatif)',
}

export const PRAKTIK_PEDAGOGIS = [
  'Pembelajaran berbasis masalah',
  'Pembelajaran berbasis proyek',
  'Inkuiri',
  'Pembelajaran kontekstual',
  'Diskusi dan kolaborasi terstruktur',
] as const

// Nama komponen perencanaan (judul bagian di dokumen).
export const KOMPONEN = {
  identitas: 'A. Identitas Modul',
  identifikasi: 'B. Identifikasi',
  desain: 'C. Desain Pembelajaran',
  pengalaman: 'D. Pengalaman Belajar',
  asesmen: 'E. Asesmen Pembelajaran',
  peta: 'F. Peta Keselarasan',
} as const

export const CATATAN_DRAF = 'Draf AI, wajib ditelaah guru sebelum digunakan.'

// Jenjang -> pilihan kelas, fase, dan menit per JP bawaan.
export const JENJANG: Record<string, { label: string; kelas: { kelas: string; fase: string }[]; menitPerJp: number }> = {
  SD: {
    label: 'SD/MI',
    menitPerJp: 35,
    kelas: [
      { kelas: '1', fase: 'A' }, { kelas: '2', fase: 'A' },
      { kelas: '3', fase: 'B' }, { kelas: '4', fase: 'B' },
      { kelas: '5', fase: 'C' }, { kelas: '6', fase: 'C' },
    ],
  },
  SMP: {
    label: 'SMP/MTs',
    menitPerJp: 40,
    kelas: [{ kelas: '7', fase: 'D' }, { kelas: '8', fase: 'D' }, { kelas: '9', fase: 'D' }],
  },
  SMA: {
    label: 'SMA/SMK/MA',
    menitPerJp: 45,
    kelas: [
      { kelas: '10', fase: 'E' }, { kelas: '11', fase: 'F' }, { kelas: '12', fase: 'F' },
    ],
  },
}

export function faseDari(jenjang: string, kelas: string): string {
  return JENJANG[jenjang]?.kelas.find((k) => k.kelas === kelas)?.fase || ''
}
