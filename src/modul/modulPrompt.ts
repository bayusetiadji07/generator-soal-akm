// Penyusun prompt dari isian formulir. Keluaran AI selalu JSON (bukan HTML) supaya kode bisa
// memeriksa keselarasan, membuat ulang satu bagian, dan menyusun Word secara pasti.

import type { FormModul, ModulAjar, Lkpd } from './modulSchema'
import { DIMENSI_PROFIL, PRINSIP, PRAKTIK_PEDAGOGIS } from './templat'
import { totalMenitTarget } from './modulCheck'

export const SYSTEM_MODUL =
  'Anda adalah perancang pembelajaran berpengalaman untuk Kurikulum Merdeka dengan kerangka Pembelajaran Mendalam di Indonesia. ' +
  'Anda HANYA menjawab dengan satu objek JSON valid sesuai skema yang diminta — tanpa markdown, tanpa komentar, tanpa teks di luar JSON. ' +
  'Bahasa Indonesia baku, konkret, dan siap dipakai guru. Jangan menulis ulang atau mengarang Capaian Pembelajaran (CP).'

// Suhu rendah: dokumen perencanaan butuh konsistensi, bukan variasi seperti soal.
export function buatPayload(userText: string, maxOutputTokens = 16384) {
  return {
    contents: [{ parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: SYSTEM_MODUL }] },
    generationConfig: {
      maxOutputTokens,
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  }
}

function identitasBlok(f: FormModul): string {
  const baris = [
    `Jenjang: ${f.jenjang} | Fase ${f.fase} | Kelas ${f.kelas}`,
    `Mata pelajaran: ${f.mapel}`,
    `Topik: ${f.topik}`,
    `Jumlah pertemuan: ${f.jumlahPertemuan}; tiap pertemuan ${f.jpPerPertemuan} JP × ${f.menitPerJp} menit = ${totalMenitTarget(f)} menit.`,
  ]
  return baris.join('\n')
}

function konteksBlok(f: FormModul): string {
  const b: string[] = []
  if (f.kondisiMurid.trim()) b.push(`Kondisi murid: ${f.kondisiMurid.trim()}`)
  if (f.sarana.trim()) b.push(`Sarana yang tersedia: ${f.sarana.trim()}`)
  if (f.konteksLokal.trim()) b.push(`Konteks lokal: ${f.konteksLokal.trim()}`)
  const media = f.media.split('\n').map((s) => s.trim()).filter(Boolean)
  if (media.length) {
    b.push(
      'Media digital dari guru (Anda TIDAK bisa membukanya — rujuk persis sebagaimana ditulis, jangan mengarang isinya; ' +
        'rancang kegiatan yang memakai media itu secara umum, mis. "tonton/baca media lalu catat ..."):\n' +
        media.map((m) => `- ${m}`).join('\n')
    )
  }
  return b.length ? b.join('\n') : '(guru tidak mengisi konteks khusus — gunakan konteks umum yang wajar bagi murid fase ini)'
}

function pilihanBlok(f: FormModul): string {
  const dim = f.dimensi.length
    ? `Dimensi profil lulusan yang WAJIB dipakai (persis ini): ${f.dimensi.join('; ')}.`
    : `Pilih 2–3 dimensi profil lulusan yang paling relevan dengan topik, hanya dari daftar baku: ${DIMENSI_PROFIL.join('; ')}.`
  const pr = f.praktik.length
    ? `Praktik pedagogis yang WAJIB dipakai: ${f.praktik.join('; ')}.`
    : `Pilih 1 praktik pedagogis yang paling cocok, dari: ${PRAKTIK_PEDAGOGIS.join('; ')}.`
  return `${dim}\n${pr}`
}

const ATURAN_KEGIATAN = (f: FormModul) =>
  `Aturan "pertemuan":
- Tiap pertemuan berisi kegiatan berurutan dengan "tahap" HANYA salah satu dari: awal, memahami, mengaplikasi, merefleksi, penutup. Pakai kelima tahap itu, masing-masing minimal sekali.
- "menit" tiap kegiatan berupa bilangan bulat. JUMLAH menit semua kegiatan dalam satu pertemuan HARUS TEPAT ${totalMenitTarget(f)} (hitung ulang sebelum menjawab).
- "uraian": 2–4 kalimat konkret tentang apa yang dilakukan guru dan murid (bukan slogan).
- "prinsip": subset dari ${JSON.stringify(PRINSIP)} (isi minimal satu per kegiatan inti).
- "tp": kode TP yang dicapai kegiatan itu (mis. ["TP1"]); setiap kegiatan inti wajib merujuk minimal satu TP, dan setiap TP wajib muncul di minimal satu kegiatan.`

export function promptModul(f: FormModul, dari: number, sampai: number, tujuan?: { kode: string; teks: string }[]): string {
  const pertamaKali = !tujuan
  const rentang = dari === sampai ? `pertemuan ke-${dari}` : `pertemuan ke-${dari} sampai ke-${sampai}`

  if (!pertamaKali) {
    return `Lanjutkan perancangan modul ajar. Buat HANYA ${rentang} dari ${f.jumlahPertemuan} pertemuan.

${identitasBlok(f)}

Capaian Pembelajaran (hanya sebagai acuan, JANGAN ditulis ulang):
"""${f.cp.trim()}"""

Tujuan pembelajaran yang SUDAH ditetapkan (pakai kodenya apa adanya, bagi ke pertemuan yang dibuat):
${tujuan!.map((t) => `${t.kode}: ${t.teks}`).join('\n')}

Konteks:
${konteksBlok(f)}

${ATURAN_KEGIATAN(f)}

Keluarkan JSON: {"pertemuan":[{"ke":${dari},"kegiatan":[{"tahap":"awal","menit":10,"uraian":"...","prinsip":["berkesadaran"],"tp":["TP1"]}]}]}`
  }

  return `Rancang MODUL AJAR Pembelajaran Mendalam (empat komponen: identifikasi, desain pembelajaran, pengalaman belajar, asesmen) untuk satu topik.

${identitasBlok(f)}

Capaian Pembelajaran (ditempel guru dari dokumen resmi — hanya acuan, JANGAN ditulis ulang di keluaran):
"""${f.cp.trim()}"""

Konteks:
${konteksBlok(f)}

${pilihanBlok(f)}

Buat dalam SATU JSON dengan bagian: identifikasi, desain, pertemuan (HANYA ${rentang}), asesmen.

Aturan "desain.tujuan": ${Math.max(2, f.jumlahPertemuan)}–${Math.max(3, f.jumlahPertemuan * 2)} tujuan pembelajaran bernomor (kode "TP1", "TP2", …), diturunkan dari CP dan topik, memuat kompetensi + konten dengan kata kerja operasional ("Peserta didik dapat …"), dapat diukur, dan terbagi ke seluruh ${f.jumlahPertemuan} pertemuan.
${ATURAN_KEGIATAN(f)}
Aturan "asesmen": minimal tiga entri — jenis "awal" (diagnostik), "proses" (formatif), "akhir" (sumatif); tiap entri berisi "teknik" (instrumen konkret), "rubrik" (kriteria ringkas 3 level), dan "tp". Setiap TP wajib dinilai di minimal satu asesmen.
Isi semua kolom, tidak boleh ada yang kosong. Singkat dan padat (hemat kata).

Skema JSON:
{
 "identifikasi": {"kesiapanMurid":"", "karakteristikMateri":"", "dimensi":["..."]},
 "desain": {"tujuan":[{"kode":"TP1","teks":""}], "lintasDisiplin":"", "praktikPedagogis":"", "kemitraan":"", "lingkungan":"", "pemanfaatanDigital":""},
 "pertemuan": [{"ke":${dari},"kegiatan":[{"tahap":"awal","menit":10,"uraian":"","prinsip":["berkesadaran"],"tp":["TP1"]}]}],
 "asesmen": [{"jenis":"awal","teknik":"","rubrik":"","tp":["TP1"]}]
}`
}

export function promptLkpd(f: FormModul, m: ModulAjar, ke: number, catatan = ''): string {
  const p = m.pertemuan.find((x) => x.ke === ke)
  const kodeTp = [...new Set((p?.kegiatan || []).flatMap((k) => k.tp))]
  const tujuan = m.desain.tujuan.filter((t) => kodeTp.includes(t.kode))
  const tp = tujuan.length ? tujuan : m.desain.tujuan
  return `Susun LEMBAR KERJA PESERTA DIDIK (LKPD) untuk pertemuan ke-${ke} dari ${f.jumlahPertemuan}.

${identitasBlok(f)}

Tujuan pembelajaran pertemuan ini (pakai kodenya):
${tp.map((t) => `${t.kode}: ${t.teks}`).join('\n')}

Rencana kegiatan pertemuan ini (LKPD harus sejalan dengan ini):
${(p?.kegiatan || []).map((k) => `- [${k.tahap}, ${k.menit} menit] ${k.uraian}`).join('\n')}

Konteks:
${konteksBlok(f)}
${catatan.trim() ? `\nCatatan guru untuk bagian ini: ${catatan.trim()}\n` : ''}
Aturan:
- Tulis untuk MURID (bahasa sederhana sesuai kelas ${f.kelas}), kecuali bagian "guru".
- "pemantik": satu masalah/fenomena konkret dari konteks lokal di atas.
- "memahami": 2–4 langkah mengamati/mengumpulkan data + "tabelKolom" (2–4 judul kolom tabel isian) + "tabelBaris" (jumlah baris kosong, 3–6).
- "mengaplikasi": 2–4 tugas menerapkan konsep pada situasi BARU; tiap tugas wajib punya "tp" (kode TP yang diukur). Semua kode TP pertemuan ini harus terwakili.
- "merefleksi": 2–3 pertanyaan refleksi.
- "guru": "kunci" (jawaban/ contoh jawaban tiap tugas mengaplikasi sesuai "no"), "rubrik" (penskoran ringkas), "catatan" (tips fasilitasi singkat).

Skema JSON:
{"judul":"", "tujuanMurid":["Aku dapat ..."], "petunjuk":["..."], "pemantik":"",
 "memahami":{"kegiatan":["..."], "tabelKolom":["..."], "tabelBaris":4},
 "mengaplikasi":[{"teks":"","tp":["TP1"]}],
 "merefleksi":["..."],
 "guru":{"kunci":[{"no":1,"jawaban":""}], "rubrik":"", "catatan":""}}`
}

export type BagianRegen = 'identifikasi' | 'desain' | 'asesmen' | `p:${number}` | `l:${number}`

export function promptRegen(f: FormModul, m: ModulAjar, bagian: BagianRegen, catatan: string): string {
  if (bagian.startsWith('l:')) return promptLkpd(f, m, Number(bagian.slice(2)), catatan)

  const ringkas = JSON.stringify(m)
  const catatanBlok = catatan.trim() ? `Catatan guru: ${catatan.trim()}` : '(guru tidak menulis catatan — perbaiki mutu bagian ini)'

  let tugas = ''
  let skema = ''
  if (bagian === 'identifikasi') {
    tugas = `Tulis ulang HANYA bagian "identifikasi". ${pilihanBlok(f)}`
    skema = '{"identifikasi":{"kesiapanMurid":"","karakteristikMateri":"","dimensi":["..."]}}'
  } else if (bagian === 'desain') {
    tugas = `Tulis ulang HANYA bagian "desain". Daftar tujuan HARUS tetap memakai kode yang sama (${m.desain.tujuan.map((t) => t.kode).join(', ')}) agar kegiatan/asesmen tetap selaras; teks tujuan boleh dipertajam bila catatan guru memintanya.`
    skema = '{"desain":{"tujuan":[{"kode":"TP1","teks":""}],"lintasDisiplin":"","praktikPedagogis":"","kemitraan":"","lingkungan":"","pemanfaatanDigital":""}}'
  } else if (bagian === 'asesmen') {
    tugas = 'Tulis ulang HANYA bagian "asesmen" (jenis awal, proses, akhir; tiap TP minimal satu asesmen).'
    skema = '{"asesmen":[{"jenis":"awal","teknik":"","rubrik":"","tp":["TP1"]}]}'
  } else {
    const ke = Number(bagian.slice(2))
    tugas = `Tulis ulang HANYA kegiatan pertemuan ke-${ke}.\n${ATURAN_KEGIATAN(f)}`
    skema = `{"pertemuan":[{"ke":${ke},"kegiatan":[{"tahap":"awal","menit":10,"uraian":"","prinsip":["berkesadaran"],"tp":["TP1"]}]}]}`
  }

  return `Berikut modul ajar yang sudah ada (JSON). Perbaiki satu bagian saja; bagian lain TIDAK boleh berubah.

Data modul:
${ringkas}

${identitasBlok(f)}
Konteks:
${konteksBlok(f)}

${tugas}
${catatanBlok}

Keluarkan HANYA JSON bagian itu dengan skema:
${skema}`
}
