// Penyusun .docx (pustaka `docx`): tabel ASLI Word, bukan teks bertab. CP dicetak apa adanya dari isian guru.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType, HeightRule, Footer, PageNumber, PageBreak, VerticalAlign,
} from 'docx'
import type { FormModul, ModulAjar, Lkpd } from './modulSchema'
import { KOMPONEN, NAMA_TAHAP, NAMA_ASESMEN, CATATAN_DRAF } from './templat'
import { petaKeselarasan } from './modulCheck'

const FONT = 'Times New Roman'
const UKURAN = 24 // 12 pt (satuan half-point)
const LEBAR = 9638 // lebar isi A4 dgn margin 2 cm, dalam twips

const garis = { style: BorderStyle.SINGLE, size: 4, color: '808080' }
const bingkai = { top: garis, bottom: garis, left: garis, right: garis }

function run(text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, font: FONT, size: o.size ?? UKURAN, bold: o.bold, italics: o.italics, color: o.color })
}

function para(text: string, o: { bold?: boolean; italics?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; indent?: number } = {}) {
  return new Paragraph({
    children: [run(text, o)],
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 80, line: 276 },
    indent: o.indent ? { left: o.indent } : undefined,
  })
}

/** Teks bergaris baru -> beberapa paragraf (tanpa mengubah karakter). */
function paraBanyak(text: string, o: Parameters<typeof para>[1] = {}) {
  const baris = String(text).split(/\r?\n/)
  return baris.map((b) => para(b, o))
}

function judulBab(text: string) {
  return para(text, { bold: true, before: 240, after: 100 })
}

function butir(text: string, nomor?: string) {
  return new Paragraph({
    children: [run(nomor ? `${nomor}  ${text}` : `•  ${text}`)],
    spacing: { after: 60, line: 276 },
    indent: { left: 360, hanging: 360 },
  })
}

interface OpsiSel { bold?: boolean; shade?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; minTinggi?: number }

function sel(isi: string | Paragraph[], lebar: number, o: OpsiSel = {}) {
  const anak = typeof isi === 'string'
    ? paraBanyak(isi || ' ', { bold: o.bold, align: o.align, after: 40, size: 22 })
    : isi
  return new TableCell({
    children: anak.length ? anak : [para(' ')],
    width: { size: lebar, type: WidthType.DXA },
    borders: bingkai,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
  })
}

function tabel(lebarKolom: number[], header: string[] | null, baris: (string | Paragraph[])[][], o: { tinggiBaris?: number } = {}) {
  const rows: TableRow[] = []
  if (header) {
    rows.push(new TableRow({
      tableHeader: true,
      children: header.map((h, i) => sel(h, lebarKolom[i], { bold: true, shade: 'E7ECF4' })),
    }))
  }
  for (const b of baris) {
    rows.push(new TableRow({
      cantSplit: true,
      height: o.tinggiBaris ? { value: o.tinggiBaris, rule: HeightRule.ATLEAST } : undefined,
      children: b.map((c, i) => sel(c, lebarKolom[i])),
    }))
  }
  return new Table({
    width: { size: lebarKolom.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: lebarKolom,
    rows,
  })
}

function kotakCatatan(text: string) {
  return new Table({
    width: { size: LEBAR, type: WidthType.DXA },
    columnWidths: [LEBAR],
    rows: [new TableRow({ children: [sel([para(text, { italics: true, size: 20, after: 0 })], LEBAR, { shade: 'FFF4D6' })] })],
  })
}

function footer(teks: string) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run(`${teks} — Halaman `, { size: 18, color: '666666' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '666666' })],
    })],
  })
}

function dokumen(anak: (Paragraph | Table)[], teksFooter: string) {
  return new Document({
    creator: 'Si Gatot',
    title: teksFooter,
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: footer(teksFooter) },
      children: anak,
    }],
  })
}

const jarak = () => para('', { after: 60 })
const pecahHalaman = () => new Paragraph({ children: [new PageBreak()] })

// ===================================================================== MODUL AJAR

export async function bangunModulDocx(f: FormModul, m: ModulAjar, lkpd: Lkpd[]): Promise<Blob> {
  const a: (Paragraph | Table)[] = []

  a.push(para('MODUL AJAR PEMBELAJARAN MENDALAM', { bold: true, size: 30, align: AlignmentType.CENTER, after: 40 }))
  a.push(para(`${f.mapel} — ${f.topik}`, { bold: true, align: AlignmentType.CENTER, after: 120 }))
  a.push(kotakCatatan(CATATAN_DRAF))

  // A. Identitas
  a.push(judulBab(KOMPONEN.identitas))
  a.push(tabel([2800, LEBAR - 2800], null, [
    ['Satuan pendidikan', f.sekolah || '…………………………………'],
    ['Penyusun', f.penyusun || '…………………………………'],
    ['Mata pelajaran', f.mapel],
    ['Fase / Kelas', `Fase ${f.fase} / Kelas ${f.kelas}`],
    ['Topik', f.topik],
    ['Alokasi waktu', `${f.jumlahPertemuan} pertemuan × ${f.jpPerPertemuan} JP × ${f.menitPerJp} menit (${f.jpPerPertemuan * f.menitPerJp} menit per pertemuan)`],
  ]))

  // B. Identifikasi
  a.push(judulBab(KOMPONEN.identifikasi))
  a.push(para('Kesiapan murid', { bold: true }))
  a.push(...paraBanyak(m.identifikasi.kesiapanMurid))
  a.push(para('Karakteristik materi', { bold: true, before: 80 }))
  a.push(...paraBanyak(m.identifikasi.karakteristikMateri))
  a.push(para('Dimensi profil lulusan', { bold: true, before: 80 }))
  m.identifikasi.dimensi.forEach((d) => a.push(butir(d)))

  // C. Desain pembelajaran
  a.push(judulBab(KOMPONEN.desain))
  a.push(para('Capaian Pembelajaran (dikutip apa adanya dari dokumen resmi)', { bold: true }))
  a.push(...paraBanyak(f.cp, { italics: true, indent: 360 }))
  a.push(para('Tujuan pembelajaran', { bold: true, before: 80 }))
  m.desain.tujuan.forEach((t) => a.push(butir(t.teks, `${t.kode}.`)))
  a.push(tabel([2800, LEBAR - 2800], null, [
    ['Topik', f.topik],
    ['Lintas disiplin ilmu', m.desain.lintasDisiplin],
    ['Praktik pedagogis', m.desain.praktikPedagogis],
    ['Kemitraan pembelajaran', m.desain.kemitraan],
    ['Lingkungan pembelajaran', m.desain.lingkungan],
    ['Pemanfaatan digital', m.desain.pemanfaatanDigital],
  ]))

  // D. Pengalaman belajar
  a.push(judulBab(KOMPONEN.pengalaman))
  for (const p of m.pertemuan) {
    a.push(para(`Pertemuan ${p.ke}`, { bold: true, before: 120 }))
    const total = p.kegiatan.reduce((s, k) => s + k.menit, 0)
    a.push(tabel([1700, 4838, 800, 1500, 800], ['Tahap', 'Kegiatan', 'Menit', 'Prinsip', 'TP'],
      [
        ...p.kegiatan.map((k) => [NAMA_TAHAP[k.tahap] || k.tahap, k.uraian, String(k.menit), k.prinsip.join(', '), k.tp.join(', ')]),
        ['Jumlah', '', String(total), '', ''],
      ]))
  }

  // E. Asesmen
  a.push(judulBab(KOMPONEN.asesmen))
  a.push(tabel([1700, 2600, 4338, 1000], ['Jenis', 'Teknik', 'Rubrik ringkas', 'TP'],
    m.asesmen.map((x) => [NAMA_ASESMEN[x.jenis] || x.jenis, x.teknik, x.rubrik, x.tp.join(', ')])))

  // F. Peta keselarasan
  a.push(judulBab(KOMPONEN.peta))
  const peta = petaKeselarasan(m, lkpd)
  a.push(tabel([2300, 2500, 2638, 2200], ['Tujuan pembelajaran', 'Kegiatan', 'Tugas LKPD', 'Asesmen'],
    peta.map((b) => [`${b.kode}. ${b.teks}`, b.kegiatan.join('; ') || '—', b.lkpd.join('; ') || '—', b.asesmen.join('; ') || '—'])))

  // Pengesahan (kolom tanda tangan; kop sekolah ditambahkan guru sendiri di Word)
  a.push(jarak())
  a.push(tabel([LEBAR / 2, LEBAR / 2], null, [[
    [para('Mengetahui,', { after: 0 }), para('Kepala Sekolah', { after: 600 }), para('(…………………………………)', { after: 0 }), para('NIP. ………………………', { after: 0 })],
    [para('………………, ………………………', { after: 0 }), para('Guru Mata Pelajaran', { after: 600 }), para(f.penyusun ? `(${f.penyusun})` : '(…………………………………)', { after: 0 }), para('NIP. ………………………', { after: 0 })],
  ]]))

  return Packer.toBlob(dokumen(a, `Modul Ajar ${f.mapel} — ${f.topik}`))
}

// ===================================================================== LKPD MURID

function identitasLkpd(f: FormModul, l: Lkpd) {
  return tabel([2300, 3000, 1500, LEBAR - 6800], null, [
    ['Mata pelajaran', f.mapel, 'Kelas', `${f.kelas} (Fase ${f.fase})`],
    ['Topik', f.topik, 'Pertemuan', `ke-${l.ke}`],
    ['Nama / Kelompok', '', 'Hari, tanggal', ''],
  ])
}

export async function bangunLkpdDocx(f: FormModul, lkpds: Lkpd[]): Promise<Blob> {
  const a: (Paragraph | Table)[] = []
  const urut = [...lkpds].sort((x, y) => x.ke - y.ke)
  urut.forEach((l, idx) => {
    if (idx > 0) a.push(pecahHalaman())
    a.push(para('LEMBAR KERJA PESERTA DIDIK (LKPD)', { bold: true, size: 30, align: AlignmentType.CENTER, after: 40 }))
    a.push(para(l.judul || `Pertemuan ${l.ke}`, { bold: true, align: AlignmentType.CENTER, after: 120 }))
    a.push(identitasLkpd(f, l))

    a.push(para('Tujuan belajar', { bold: true, before: 160 }))
    l.tujuanMurid.forEach((t) => a.push(butir(t)))
    a.push(para('Petunjuk kerja', { bold: true, before: 100 }))
    l.petunjuk.forEach((t, i) => a.push(butir(t, `${i + 1}.`)))

    a.push(para('A. Pemantik', { bold: true, before: 160 }))
    a.push(new Table({
      width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [LEBAR],
      rows: [new TableRow({ children: [sel(l.pemantik, LEBAR, { shade: 'EEF6EE' })] })],
    }))

    a.push(para('B. Memahami', { bold: true, before: 160 }))
    l.memahami.kegiatan.forEach((t, i) => a.push(butir(t, `${i + 1}.`)))
    if (l.memahami.tabelKolom.length && l.memahami.tabelBaris > 0) {
      const kol = l.memahami.tabelKolom
      const w = Math.floor(LEBAR / kol.length)
      const lebar = kol.map((_, i) => (i === kol.length - 1 ? LEBAR - w * (kol.length - 1) : w))
      a.push(jarak())
      a.push(tabel(lebar, kol, Array.from({ length: l.memahami.tabelBaris }, () => kol.map(() => '')), { tinggiBaris: 520 }))
    }

    a.push(para('C. Mengaplikasi', { bold: true, before: 160 }))
    l.mengaplikasi.forEach((t) => {
      a.push(new Paragraph({ children: [run(`${t.no}.  ${t.teks}`)], spacing: { after: 60, line: 276 }, indent: { left: 360, hanging: 360 } }))
      a.push(tabel([LEBAR], null, [['']], { tinggiBaris: 1100 }))
      a.push(jarak())
    })

    a.push(para('D. Merefleksi', { bold: true, before: 120 }))
    l.merefleksi.forEach((t, i) => {
      a.push(new Paragraph({ children: [run(`${i + 1}.  ${t}`)], spacing: { after: 60, line: 276 }, indent: { left: 360, hanging: 360 } }))
      a.push(tabel([LEBAR], null, [['']], { tinggiBaris: 800 }))
      a.push(jarak())
    })
  })
  return Packer.toBlob(dokumen(a, `LKPD ${f.mapel} — ${f.topik}`))
}

// ===================================================================== LEMBAR GURU (terpisah dari LKPD murid)

export async function bangunLembarGuruDocx(f: FormModul, lkpds: Lkpd[]): Promise<Blob> {
  const a: (Paragraph | Table)[] = []
  const urut = [...lkpds].sort((x, y) => x.ke - y.ke)
  a.push(para('LEMBAR GURU — KUNCI, CONTOH JAWABAN, DAN RUBRIK LKPD', { bold: true, size: 28, align: AlignmentType.CENTER, after: 40 }))
  a.push(para(`${f.mapel} — ${f.topik} (Kelas ${f.kelas})`, { align: AlignmentType.CENTER, after: 120 }))
  a.push(kotakCatatan(`${CATATAN_DRAF} Dokumen ini khusus guru — jangan dibagikan ke murid.`))

  urut.forEach((l, idx) => {
    if (idx > 0) a.push(pecahHalaman())
    a.push(judulBab(`LKPD Pertemuan ${l.ke}${l.judul ? ` — ${l.judul}` : ''}`))
    a.push(para('Kunci dan contoh jawaban', { bold: true }))
    if (l.guru.kunci.length) {
      a.push(tabel([900, LEBAR - 900], ['No.', 'Jawaban'], l.guru.kunci.map((k) => [String(k.no), k.jawaban])))
    } else {
      a.push(para('(belum ada kunci — buat ulang LKPD ini)', { italics: true }))
    }
    a.push(para('Rubrik penskoran', { bold: true, before: 140 }))
    a.push(...paraBanyak(l.guru.rubrik || '—'))
    a.push(para('Catatan fasilitasi', { bold: true, before: 100 }))
    a.push(...paraBanyak(l.guru.catatan || '—'))
  })
  return Packer.toBlob(dokumen(a, `Lembar Guru ${f.mapel} — ${f.topik}`))
}

export function unduhBlob(blob: Blob, namaBerkas: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaBerkas
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function namaAman(s: string): string {
  return (s || 'dokumen').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'dokumen'
}
