// Mode keempat Si Gatot: Generator Modul Ajar & LKPD Pembelajaran Mendalam.
// Keluaran AI = JSON berskema; tampilan memakai teks React biasa (tanpa dangerouslySetInnerHTML).

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { teksDariHasil } from '../lib/ai'
import {
  type FormModul, type ModulAjar, type Lkpd,
  parseJsonLoose, normalisasiModul, normalisasiPertemuan, normalisasiLkpd, bagianKosong,
} from './modulSchema'
import { buatPayload, promptModul, promptLkpd, promptRegen, type BagianRegen } from './modulPrompt'
import { periksaModul, petaKeselarasan, sesuaikanMenit, totalMenitTarget, type Peringatan } from './modulCheck'
import {
  DIMENSI_PROFIL, PRAKTIK_PEDAGOGIS, JENJANG, NAMA_TAHAP, NAMA_ASESMEN, CATATAN_DRAF, faseDari,
} from './templat'

interface Props {
  callAI: (payload: any, opsi?: { retries?: number }) => Promise<any>
  onBuatSoal: (d: { mapel: string; fase: string; kelas: string; materi: string; iktp: string }) => void
}

interface Riwayat { id: string; waktu: number; form: FormModul; modul: ModulAjar; lkpd: Record<number, Lkpd> }

const FORM_AWAL: FormModul = {
  sekolah: '', penyusun: '', jenjang: 'SMP', kelas: '7', fase: 'D', mapel: '', topik: '',
  jumlahPertemuan: 2, jpPerPertemuan: 3, menitPerJp: 40, cp: '',
  dimensi: [], praktik: [], kondisiMurid: '', sarana: '', konteksLokal: '', media: '', keluaran: 'keduanya',
}

const MAKS_RIWAYAT = 10
const kInput = 'w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white'
const kLabel = 'block text-sm font-medium text-gray-700 mb-1'
const kKartu = 'bg-white rounded-2xl p-6 shadow-sm border border-gray-100'

function simpanLokal(kunci: string, nilai: unknown) {
  try { localStorage.setItem(kunci, JSON.stringify(nilai)) } catch { /* penyimpanan penuh/diblokir */ }
}
function bacaLokal<T>(kunci: string, cadangan: T): T {
  try {
    const t = localStorage.getItem(kunci)
    return t ? (JSON.parse(t) as T) : cadangan
  } catch { return cadangan }
}

function validasi(f: FormModul): string[] {
  const e: string[] = []
  if (!f.mapel.trim()) e.push('Mata pelajaran wajib diisi.')
  if (!f.topik.trim()) e.push('Topik wajib diisi.')
  if (!f.kelas || !f.fase) e.push('Pilih jenjang dan kelas.')
  if (f.cp.trim().length < 30) e.push('Capaian Pembelajaran wajib ditempel dari dokumen resmi (minimal satu kalimat utuh).')
  if (!Number.isInteger(f.jumlahPertemuan) || f.jumlahPertemuan < 1 || f.jumlahPertemuan > 6) e.push('Jumlah pertemuan harus bilangan bulat 1–6.')
  if (!Number.isInteger(f.jpPerPertemuan) || f.jpPerPertemuan < 1 || f.jpPerPertemuan > 10) e.push('JP per pertemuan harus bilangan bulat 1–10.')
  if (!Number.isInteger(f.menitPerJp) || f.menitPerJp < 15 || f.menitPerJp > 60) e.push('Menit per JP harus bilangan bulat 15–60.')
  return e
}

const renomori = (arr: ModulAjar['pertemuan'], mulai: number) => arr.map((p, i) => ({ ...p, ke: mulai + i }))

export default function ModulMode({ callAI, onBuatSoal }: Props) {
  const [uid, setUid] = useState<string | null>(null)
  const [form, setForm] = useState<FormModul>(FORM_AWAL)
  const [galatForm, setGalatForm] = useState<string[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [status, setStatus] = useState('')
  const [galatAI, setGalatAI] = useState('')
  const [formHasil, setFormHasil] = useState<FormModul | null>(null) // isian yang dipakai untuk hasil di layar
  const [modul, setModul] = useState<ModulAjar | null>(null)
  const [lkpd, setLkpd] = useState<Record<number, Lkpd>>({})
  const [galatLkpd, setGalatLkpd] = useState<Record<number, string>>({})
  const [tab, setTab] = useState<'modul' | 'periksa' | number>('modul')
  const [catatan, setCatatan] = useState<Record<string, string>>({})
  const [buka, setBuka] = useState<string | null>(null) // panel "buat ulang" yang sedang terbuka
  const [ulangSibuk, setUlangSibuk] = useState<string | null>(null)
  const [pesanUlang, setPesanUlang] = useState('')
  const [riwayat, setRiwayat] = useState<Riwayat[]>([])
  const [tampilRiwayat, setTampilRiwayat] = useState(false)
  const idSaatIni = useRef<string>('')
  const berhenti = useRef(false)

  // ---- identitas akun (kunci penyimpanan per akun) ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id || 'anon'))
  }, [])

  const kunciDraf = `sigatot_modul_draf_v1_${uid}`
  const kunciRiwayat = `sigatot_modul_riwayat_v1_${uid}`

  useEffect(() => {
    if (!uid) return
    const draf = bacaLokal<Partial<FormModul> | null>(kunciDraf, null)
    if (draf) setForm({ ...FORM_AWAL, ...draf })
    setRiwayat(bacaLokal<Riwayat[]>(kunciRiwayat, []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // Isian tidak boleh hilang: simpan draf tiap berubah (juga bila generate gagal / pindah halaman)
  useEffect(() => {
    if (uid) simpanLokal(kunciDraf, form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, uid])

  // Riwayat 10 dokumen terakhir di perangkat guru (F13)
  useEffect(() => {
    if (!uid || !modul || !formHasil || sibuk || ulangSibuk) return
    const id = idSaatIni.current || (idSaatIni.current = String(Date.now()))
    setRiwayat((prev) => {
      const baru: Riwayat = { id, waktu: Date.now(), form: formHasil, modul, lkpd }
      const lain = prev.filter((r) => r.id !== id)
      let daftar = [baru, ...lain].slice(0, MAKS_RIWAYAT)
      try {
        localStorage.setItem(kunciRiwayat, JSON.stringify(daftar))
      } catch {
        daftar = daftar.slice(0, Math.max(1, Math.floor(daftar.length / 2)))
        simpanLokal(kunciRiwayat, daftar)
      }
      return daftar
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modul, lkpd, sibuk, ulangSibuk])

  const ubah = <K extends keyof FormModul>(k: K, v: FormModul[K]) => setForm((p) => ({ ...p, [k]: v }))
  const ubahAngka = (k: 'jumlahPertemuan' | 'jpPerPertemuan' | 'menitPerJp', v: string) => ubah(k, v === '' ? 0 : Number(v))

  const pilihJenjang = (j: string) => {
    const k = JENJANG[j].kelas[0]
    setForm((p) => ({ ...p, jenjang: j, kelas: k.kelas, fase: k.fase, menitPerJp: JENJANG[j].menitPerJp }))
  }
  const pilihKelas = (kelas: string) => setForm((p) => ({ ...p, kelas, fase: faseDari(p.jenjang, kelas) }))

  const toggleBatas = (k: 'dimensi' | 'praktik', nilai: string, maks: number) =>
    setForm((p) => {
      const ada = p[k].includes(nilai)
      if (ada) return { ...p, [k]: p[k].filter((x) => x !== nilai) }
      if (p[k].length >= maks) return p
      return { ...p, [k]: [...p[k], nilai] }
    })

  // ===================================================================== GENERATE

  const panggilJson = async (prompt: string, maksToken = 16384) => {
    const hasil = await callAI(buatPayload(prompt, maksToken), { retries: 2 })
    return parseJsonLoose(teksDariHasil(hasil))
  }

  const jalankan = async () => {
    const gal = validasi(form)
    setGalatForm(gal)
    if (gal.length) return
    const f: FormModul = { ...form }
    berhenti.current = false
    idSaatIni.current = String(Date.now())
    setSibuk(true); setGalatAI(''); setPesanUlang('')
    setFormHasil(f); setModul(null); setLkpd({}); setGalatLkpd({}); setTab('modul'); setBuka(null)
    const n = f.jumlahPertemuan
    const potong = Math.min(n, 3) // satu panggilan memuat paling banyak 3 pertemuan agar < 60 detik
    try {
      setStatus('Menyusun modul ajar…')
      const j1 = await panggilJson(promptModul(f, 1, potong))
      const m = normalisasiModul(j1)
      m.pertemuan = renomori(m.pertemuan.slice(0, potong), 1)
      setModul({ ...m })

      if (n > potong && !berhenti.current) {
        setStatus(`Menyusun pertemuan ${potong + 1}–${n}…`)
        const j2 = await panggilJson(promptModul(f, potong + 1, n, m.desain.tujuan))
        const lanjut = normalisasiModul({ pertemuan: j2.pertemuan }).pertemuan
        m.pertemuan = [...m.pertemuan, ...renomori(lanjut.slice(0, n - potong), potong + 1)]
        setModul({ ...m })
      }

      if (f.keluaran !== 'modul') {
        for (let ke = 1; ke <= m.pertemuan.length; ke++) {
          if (berhenti.current) break
          setStatus(`Menyusun LKPD pertemuan ${ke} dari ${m.pertemuan.length}…`)
          try {
            const jl = await panggilJson(promptLkpd(f, m, ke), 12000)
            setLkpd((prev) => ({ ...prev, [ke]: normalisasiLkpd(jl, ke) }))
          } catch (e: any) {
            setGalatLkpd((prev) => ({ ...prev, [ke]: e?.message || 'Gagal membuat LKPD.' }))
          }
        }
      }
    } catch (e: any) {
      // Isian formulir tetap utuh (state `form` tidak disentuh); hanya pesan yang tampil.
      setGalatAI(e?.message || 'Gagal membuat dokumen.')
    } finally {
      setSibuk(false); setStatus('')
    }
  }

  // ===================================================================== BUAT ULANG SATU BAGIAN (F10)

  const buatUlang = async (bagian: BagianRegen) => {
    if (!modul || !formHasil) return
    setUlangSibuk(bagian); setPesanUlang('')
    try {
      if (bagian.startsWith('l:')) {
        const ke = Number(bagian.slice(2))
        const j = await panggilJson(promptRegen(formHasil, modul, bagian, catatan[bagian] || ''), 12000)
        setLkpd((p) => ({ ...p, [ke]: normalisasiLkpd(j, ke) }))
        setGalatLkpd((p) => { const c = { ...p }; delete c[ke]; return c })
      } else {
        const j = await panggilJson(promptRegen(formHasil, modul, bagian, catatan[bagian] || ''), 8000)
        const baru: ModulAjar = JSON.parse(JSON.stringify(modul))
        if (bagian === 'identifikasi') {
          const n = normalisasiModul({ identifikasi: j.identifikasi }).identifikasi
          if (n.kesiapanMurid || n.karakteristikMateri) baru.identifikasi = n
        } else if (bagian === 'desain') {
          const n = normalisasiModul({ desain: j.desain }).desain
          if (n.tujuan.length) baru.desain = n
        } else if (bagian === 'asesmen') {
          const n = normalisasiModul({ asesmen: j.asesmen }).asesmen
          if (n.length) baru.asesmen = n
        } else {
          const ke = Number(bagian.slice(2))
          const p = normalisasiPertemuan((j.pertemuan || [])[0], ke)
          if (p.kegiatan.length) baru.pertemuan = baru.pertemuan.map((x) => (x.ke === ke ? { ...p, ke } : x))
          if (lkpd[ke]) setPesanUlang(`Kegiatan pertemuan ${ke} berubah — buat ulang LKPD ${ke} juga agar tetap selaras.`)
        }
        setModul(baru)
      }
      setBuka(null)
    } catch (e: any) {
      setPesanUlang(`Gagal membuat ulang bagian: ${e?.message || 'galat tak dikenal'}. Bagian lama dipertahankan.`)
    } finally {
      setUlangSibuk(null)
    }
  }

  const perbaikiMenit = (ke: number) => {
    if (!modul || !formHasil) return
    setModul(sesuaikanMenit(modul, ke, totalMenitTarget(formHasil)))
  }

  // ===================================================================== UNDUH & TERUSKAN

  const unduh = async (jenis: 'modul' | 'lkpd' | 'guru') => {
    if (!modul || !formHasil) return
    const w = await import('./modulDocx')
    const daftar = Object.values(lkpd)
    const dasar = w.namaAman(`${formHasil.mapel}-${formHasil.topik}`)
    if (jenis === 'modul') w.unduhBlob(await w.bangunModulDocx(formHasil, modul, daftar), `modul-ajar-${dasar}.docx`)
    if (jenis === 'lkpd') w.unduhBlob(await w.bangunLkpdDocx(formHasil, daftar), `lkpd-${dasar}.docx`)
    if (jenis === 'guru') w.unduhBlob(await w.bangunLembarGuruDocx(formHasil, daftar), `lembar-guru-lkpd-${dasar}.docx`)
  }

  const [pesanUnduh, setPesanUnduh] = useState('')
  const unduhAman = async (jenis: 'modul' | 'lkpd' | 'guru') => {
    setPesanUnduh('')
    try { await unduh(jenis) } catch (e: any) { setPesanUnduh(`Gagal menyusun Word: ${e?.message || 'galat tak dikenal'}`) }
  }

  const buatSoal = () => {
    if (!modul || !formHasil) return
    onBuatSoal({
      mapel: formHasil.mapel,
      fase: formHasil.fase,
      kelas: formHasil.kelas,
      materi: formHasil.topik,
      iktp: modul.desain.tujuan.map((t) => `${t.kode}. ${t.teks}`).join('\n'),
    })
  }

  const bukaRiwayat = (r: Riwayat) => {
    idSaatIni.current = r.id
    setForm({ ...FORM_AWAL, ...r.form })
    setFormHasil(r.form); setModul(r.modul); setLkpd(r.lkpd || {}); setGalatLkpd({}); setGalatAI('')
    setTab('modul'); setTampilRiwayat(false)
  }
  const hapusRiwayat = (id: string) => {
    const baru = riwayat.filter((r) => r.id !== id)
    setRiwayat(baru); simpanLokal(kunciRiwayat, baru)
  }

  // ===================================================================== TURUNAN TAMPILAN

  const daftarLkpd = Object.values(lkpd)
  const lkpdDiminta = !!formHasil && formHasil.keluaran !== 'modul'
  const peringatan: Peringatan[] = modul && formHasil ? periksaModul(modul, daftarLkpd, formHasil, lkpdDiminta) : []
  const kosong = modul ? bagianKosong(modul) : []
  const jumlahMasalah = peringatan.length + (kosong.length ? 1 : 0)
  const selesaiGenerate = !!modul && !sibuk

  const panelUlang = (bagian: BagianRegen, label: string) => {
    if (!selesaiGenerate) return null
    const terbuka = buka === bagian
    return (
      <div className="mt-2">
        {!terbuka ? (
          <button type="button" onClick={() => setBuka(bagian)} disabled={!!ulangSibuk} className="text-xs text-blue-600 hover:underline disabled:opacity-40">
            ↻ Buat ulang {label}
          </button>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <textarea
              value={catatan[bagian] || ''}
              onChange={(e) => setCatatan((p) => ({ ...p, [bagian]: e.target.value }))}
              rows={2}
              placeholder="Catatan singkat untuk AI (opsional), mis. 'lebih banyak diskusi kelompok'"
              className={kInput}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => buatUlang(bagian)} disabled={!!ulangSibuk}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                {ulangSibuk === bagian ? 'Membuat ulang…' : `Buat ulang ${label}`}
              </button>
              <button type="button" onClick={() => setBuka(null)} disabled={!!ulangSibuk} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600">Batal</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const baris = (judul: string, isi: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-1 sm:gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="text-sm font-medium text-gray-600">{judul}</div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap">{isi || '—'}</div>
    </div>
  )

  // ===================================================================== RENDER

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ============ FORMULIR ============ */}
      <div className="lg:col-span-4 space-y-6">
        <div className={kKartu}>
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-900">Formulir Modul Ajar & LKPD</h2>
            {riwayat.length > 0 && (
              <button type="button" onClick={() => setTampilRiwayat((s) => !s)} className="text-xs text-blue-600 hover:underline">
                Riwayat ({riwayat.length})
              </button>
            )}
          </div>

          {tampilRiwayat && (
            <div className="mb-4 rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              {riwayat.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 truncate">{r.form.mapel} — {r.form.topik}</div>
                    <div className="text-xs text-gray-400">Kelas {r.form.kelas} · {new Date(r.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <button type="button" onClick={() => bukaRiwayat(r)} className="text-xs text-blue-600 hover:underline">Buka</button>
                  <button type="button" onClick={() => hapusRiwayat(r.id)} className="text-xs text-red-500 hover:underline">Hapus</button>
                </div>
              ))}
              <p className="p-2 text-[11px] text-gray-400">Tersimpan hanya di perangkat ini (10 dokumen terakhir).</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={kLabel}>Satuan pendidikan (opsional)</label>
                <input className={kInput} value={form.sekolah} onChange={(e) => ubah('sekolah', e.target.value)} placeholder="mis. SMPN 3 Besuki" />
              </div>
              <div>
                <label className={kLabel}>Nama penyusun (opsional)</label>
                <input className={kInput} value={form.penyusun} onChange={(e) => ubah('penyusun', e.target.value)} placeholder="Nama guru" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={kLabel}>Jenjang</label>
                <select className={kInput} value={form.jenjang} onChange={(e) => pilihJenjang(e.target.value)}>
                  {Object.entries(JENJANG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className={kLabel}>Kelas (Fase {form.fase})</label>
                <select className={kInput} value={form.kelas} onChange={(e) => pilihKelas(e.target.value)}>
                  {JENJANG[form.jenjang].kelas.map((k) => <option key={k.kelas} value={k.kelas}>Kelas {k.kelas}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={kLabel}>Mata pelajaran</label>
              <input className={kInput} value={form.mapel} onChange={(e) => ubah('mapel', e.target.value)} placeholder="mis. IPA" />
            </div>
            <div>
              <label className={kLabel}>Topik</label>
              <input className={kInput} value={form.topik} onChange={(e) => ubah('topik', e.target.value)} placeholder="mis. Suhu dan Kalor" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={kLabel}>Pertemuan</label>
                <input type="number" min={1} max={6} className={kInput} value={form.jumlahPertemuan || ''} onChange={(e) => ubahAngka('jumlahPertemuan', e.target.value)} />
              </div>
              <div>
                <label className={kLabel}>JP / pertemuan</label>
                <input type="number" min={1} max={10} className={kInput} value={form.jpPerPertemuan || ''} onChange={(e) => ubahAngka('jpPerPertemuan', e.target.value)} />
              </div>
              <div>
                <label className={kLabel}>Menit / JP</label>
                <input type="number" min={15} max={60} className={kInput} value={form.menitPerJp || ''} onChange={(e) => ubahAngka('menitPerJp', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Alokasi per pertemuan: <b>{(form.jpPerPertemuan || 0) * (form.menitPerJp || 0)} menit</b>
            </p>

            <div>
              <label className={kLabel}>Capaian Pembelajaran (CP) <span className="text-red-500">*</span></label>
              <textarea
                className={kInput} rows={5} value={form.cp} onChange={(e) => ubah('cp', e.target.value)}
                placeholder="Tempel teks CP dari dokumen resmi. Akan dicetak apa adanya — AI tidak menulis ulang CP."
              />
            </div>
          </div>
        </div>

        <div className={kKartu}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Dimensi profil lulusan <span className="text-gray-400 font-normal">(pilih 1–3, atau kosongkan agar sistem memilihkan)</span></h3>
          <div className="space-y-1.5">
            {DIMENSI_PROFIL.map((d) => (
              <label key={d} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.dimensi.includes(d)} onChange={() => toggleBatas('dimensi', d, 3)} className="mt-0.5 rounded text-blue-600" />
                {d}
              </label>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-5 mb-3">Praktik pedagogis <span className="text-gray-400 font-normal">(maks. 3, atau kosongkan)</span></h3>
          <div className="space-y-1.5">
            {PRAKTIK_PEDAGOGIS.map((d) => (
              <label key={d} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.praktik.includes(d)} onChange={() => toggleBatas('praktik', d, 3)} className="mt-0.5 rounded text-blue-600" />
                {d}
              </label>
            ))}
          </div>
        </div>

        <div className={kKartu}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Konteks <span className="text-gray-400 font-normal">(makin rinci, makin sesuai)</span></h3>
          <div className="space-y-3">
            <div>
              <label className={kLabel}>Kondisi murid</label>
              <textarea className={kInput} rows={2} value={form.kondisiMurid} onChange={(e) => ubah('kondisiMurid', e.target.value)} placeholder="mis. 32 murid, sebagian belum lancar membaca grafik" />
            </div>
            <div>
              <label className={kLabel}>Sarana yang ada</label>
              <textarea className={kInput} rows={2} value={form.sarana} onChange={(e) => ubah('sarana', e.target.value)} placeholder="mis. proyektor, lab sederhana, 5 HP untuk kelompok" />
            </div>
            <div>
              <label className={kLabel}>Konteks lokal</label>
              <textarea className={kInput} rows={2} value={form.konteksLokal} onChange={(e) => ubah('konteksLokal', e.target.value)} placeholder="mis. daerah pesisir, petani garam, pasar tradisional" />
            </div>
            <div>
              <label className={kLabel}>Tautan media digital (satu per baris)</label>
              <textarea className={kInput} rows={2} value={form.media} onChange={(e) => ubah('media', e.target.value)} placeholder="https://… (judul media)" />
              <p className="text-[11px] text-gray-400 mt-1">AI tidak bisa membuka tautan; ia hanya merancang kegiatan yang memakai media itu. Cek kecocokannya sendiri.</p>
            </div>
          </div>
        </div>

        <div className={kKartu}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Keluaran</h3>
          <div className="space-y-1.5">
            {([['keduanya', 'Modul ajar + LKPD'], ['modul', 'Modul ajar saja'], ['lkpd', 'LKPD saja (modul disusun sebagai kerangka)']] as const).map(([v, t]) => (
              <label key={v} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="keluaranModul" checked={form.keluaran === v} onChange={() => ubah('keluaran', v)} className="text-blue-600" />
                {t}
              </label>
            ))}
          </div>

          {galatForm.length > 0 && (
            <ul className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 list-disc list-inside space-y-0.5">
              {galatForm.map((g) => <li key={g}>{g}</li>)}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button" onClick={jalankan} disabled={sibuk || !!ulangSibuk}
              className={`flex-1 py-3 rounded-xl font-semibold text-white transition ${sibuk ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}`}
            >
              {sibuk ? 'Sedang menyusun…' : 'Generate'}
            </button>
            {sibuk && (
              <button type="button" onClick={() => { berhenti.current = true }} className="px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">
                Hentikan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ HASIL ============ */}
      <div className="lg:col-span-8 space-y-4">
        {!modul && !sibuk && !galatAI && (
          <div className={`${kKartu} text-center text-gray-500`}>
            <div className="text-4xl mb-2">📘</div>
            <p className="font-medium text-gray-700">Isi formulir, lalu tekan Generate.</p>
            <p className="text-sm mt-1">Modul ajar muncul lebih dulu, LKPD menyusul per pertemuan. CP Anda dicetak apa adanya, dan keselarasan TP diperiksa otomatis.</p>
          </div>
        )}

        {sibuk && (
          <div className={`${kKartu} flex items-center gap-3`}>
            <span className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-gray-700">{status || 'Memproses…'}</div>
          </div>
        )}

        {galatAI && (
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
            <b>Gagal:</b> {galatAI}
            <div className="text-xs text-red-500 mt-1">Isian formulir Anda tidak hilang. Perbaiki lalu tekan Generate lagi.</div>
          </div>
        )}

        {pesanUlang && <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">{pesanUlang}</div>}

        {modul && formHasil && (
          <>
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 font-medium">⚠️ {CATATAN_DRAF}</div>

            {/* Tab */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTab('modul')} className={`px-4 py-2 rounded-xl text-sm font-medium border ${tab === 'modul' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>Modul Ajar</button>
              {lkpdDiminta && modul.pertemuan.map((p) => (
                <button key={p.ke} type="button" onClick={() => setTab(p.ke)} className={`px-4 py-2 rounded-xl text-sm font-medium border ${tab === p.ke ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  LKPD {p.ke}{galatLkpd[p.ke] ? ' ⚠' : !lkpd[p.ke] && sibuk ? ' …' : ''}
                </button>
              ))}
              <button type="button" onClick={() => setTab('periksa')} className={`px-4 py-2 rounded-xl text-sm font-medium border ${tab === 'periksa' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                Keselarasan {jumlahMasalah > 0 ? <span className={`ml-1 px-1.5 rounded-full text-xs ${tab === 'periksa' ? 'bg-white text-blue-700' : 'bg-red-100 text-red-700'}`}>{jumlahMasalah}</span> : <span className="ml-1">✓</span>}
              </button>
            </div>

            {/* ---- Tab Modul ---- */}
            {tab === 'modul' && (
              <div className="space-y-4">
                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-2">A. Identitas Modul</h3>
                  {baris("Satuan pendidikan", formHasil.sekolah)}
                  {baris("Penyusun", formHasil.penyusun)}
                  {baris("Mata pelajaran", formHasil.mapel)}
                  {baris("Fase / Kelas", `Fase ${formHasil.fase} / Kelas ${formHasil.kelas}`)}
                  {baris("Topik", formHasil.topik)}
                  {baris("Alokasi waktu", `${formHasil.jumlahPertemuan} pertemuan × ${formHasil.jpPerPertemuan} JP × ${formHasil.menitPerJp} menit`)}
                </div>

                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-2">B. Identifikasi</h3>
                  {baris("Kesiapan murid", modul.identifikasi.kesiapanMurid)}
                  {baris("Karakteristik materi", modul.identifikasi.karakteristikMateri)}
                  {baris("Dimensi profil lulusan", modul.identifikasi.dimensi.join('; '))}
                  {panelUlang("identifikasi", "identifikasi")}
                </div>

                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-2">C. Desain Pembelajaran</h3>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 mb-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Capaian Pembelajaran — dikutip apa adanya dari isian Anda, tidak diubah AI</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap italic">{formHasil.cp}</div>
                  </div>
                  <div className="py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-600 mb-1">Tujuan pembelajaran</div>
                    <ul className="space-y-1">
                      {modul.desain.tujuan.map((t) => (
                        <li key={t.kode} className="text-sm text-gray-800"><b>{t.kode}.</b> {t.teks}</li>
                      ))}
                    </ul>
                  </div>
                  {baris("Lintas disiplin ilmu", modul.desain.lintasDisiplin)}
                  {baris("Praktik pedagogis", modul.desain.praktikPedagogis)}
                  {baris("Kemitraan pembelajaran", modul.desain.kemitraan)}
                  {baris("Lingkungan pembelajaran", modul.desain.lingkungan)}
                  {baris("Pemanfaatan digital", modul.desain.pemanfaatanDigital)}
                  {panelUlang("desain", "desain pembelajaran")}
                </div>

                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-3">D. Pengalaman Belajar</h3>
                  <div className="space-y-5">
                    {modul.pertemuan.map((p) => {
                      const total = p.kegiatan.reduce((s, k) => s + k.menit, 0)
                      const target = totalMenitTarget(formHasil)
                      return (
                        <div key={p.ke}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-800">Pertemuan {p.ke}</div>
                            <div className={`text-xs px-2 py-0.5 rounded-full ${total === target ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{total} / {target} menit</div>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-gray-600 text-left">
                                <tr><th className="p-2 w-32">Tahap</th><th className="p-2">Kegiatan</th><th className="p-2 w-16">Menit</th><th className="p-2 w-32">Prinsip</th><th className="p-2 w-20">TP</th></tr>
                              </thead>
                              <tbody>
                                {p.kegiatan.map((k, i) => (
                                  <tr key={i} className="border-t border-gray-100 align-top">
                                    <td className="p-2 text-gray-700">{NAMA_TAHAP[k.tahap] || k.tahap}</td>
                                    <td className="p-2 text-gray-800 whitespace-pre-wrap">{k.uraian}</td>
                                    <td className="p-2">{k.menit}</td>
                                    <td className="p-2 text-gray-600">{k.prinsip.join(', ')}</td>
                                    <td className="p-2 text-gray-600">{k.tp.join(', ')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {panelUlang(`p:${p.ke}`, `pertemuan ${p.ke}`)}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-3">E. Asesmen Pembelajaran</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-left">
                        <tr><th className="p-2 w-36">Jenis</th><th className="p-2">Teknik</th><th className="p-2">Rubrik ringkas</th><th className="p-2 w-20">TP</th></tr>
                      </thead>
                      <tbody>
                        {modul.asesmen.map((a, i) => (
                          <tr key={i} className="border-t border-gray-100 align-top">
                            <td className="p-2 text-gray-700">{NAMA_ASESMEN[a.jenis] || a.jenis}</td>
                            <td className="p-2 text-gray-800 whitespace-pre-wrap">{a.teknik}</td>
                            <td className="p-2 text-gray-800 whitespace-pre-wrap">{a.rubrik}</td>
                            <td className="p-2 text-gray-600">{a.tp.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {panelUlang("asesmen", "asesmen")}
                </div>
              </div>
            )}

            {/* ---- Tab LKPD per pertemuan ---- */}
            {typeof tab === 'number' && (() => {
              const l = lkpd[tab]
              if (!l) {
                return (
                  <div className={kKartu}>
                    {galatLkpd[tab] ? (
                      <>
                        <p className="text-sm text-red-700"><b>LKPD pertemuan {tab} gagal dibuat:</b> {galatLkpd[tab]}</p>
                        <div className="mt-2">{panelUlang(`l:${tab}`, `LKPD ${tab}`)}</div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">{sibuk ? 'LKPD ini sedang disusun…' : 'LKPD pertemuan ini belum dibuat.'}</p>
                    )}
                  </div>
                )
              }
              return (
                <div className="space-y-4">
                  <div className={kKartu}>
                    <h3 className="font-semibold text-gray-900">LKPD Pertemuan {l.ke}{l.judul ? ` — ${l.judul}` : ''}</h3>
                    <div className="mt-3 space-y-3 text-sm text-gray-800">
                      <div><div className="font-medium text-gray-600">Tujuan belajar</div><ul className="list-disc list-inside">{l.tujuanMurid.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                      <div><div className="font-medium text-gray-600">Petunjuk kerja</div><ol className="list-decimal list-inside">{l.petunjuk.map((t, i) => <li key={i}>{t}</li>)}</ol></div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"><div className="font-medium text-emerald-800 mb-1">Pemantik</div><div className="whitespace-pre-wrap">{l.pemantik}</div></div>
                      <div>
                        <div className="font-medium text-gray-600">Memahami</div>
                        <ol className="list-decimal list-inside">{l.memahami.kegiatan.map((t, i) => <li key={i}>{t}</li>)}</ol>
                        {l.memahami.tabelKolom.length > 0 && (
                          <div className="overflow-x-auto mt-2 rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50"><tr>{l.memahami.tabelKolom.map((c, i) => <th key={i} className="p-2 text-left font-medium">{c}</th>)}</tr></thead>
                              <tbody>{Array.from({ length: l.memahami.tabelBaris }).map((_, r) => <tr key={r} className="border-t border-gray-100">{l.memahami.tabelKolom.map((_, c) => <td key={c} className="p-3">&nbsp;</td>)}</tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-600">Mengaplikasi</div>
                        <ol className="space-y-1">{l.mengaplikasi.map((t) => <li key={t.no}><b>{t.no}.</b> {t.teks} <span className="text-xs text-gray-400">[{t.tp.join(', ')}]</span></li>)}</ol>
                      </div>
                      <div><div className="font-medium text-gray-600">Merefleksi</div><ol className="list-decimal list-inside">{l.merefleksi.map((t, i) => <li key={i}>{t}</li>)}</ol></div>
                    </div>
                    {panelUlang(`l:${l.ke}`, `LKPD ${l.ke}`)}
                  </div>

                  <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-5">
                    <h4 className="font-semibold text-gray-800 mb-2">🔒 Lembar Guru (dicetak terpisah dari LKPD murid)</h4>
                    <div className="space-y-2 text-sm text-gray-800">
                      <div><div className="font-medium text-gray-600">Kunci / contoh jawaban</div>
                        <ol className="space-y-1">{l.guru.kunci.map((k) => <li key={k.no}><b>{k.no}.</b> {k.jawaban}</li>)}</ol></div>
                      <div><div className="font-medium text-gray-600">Rubrik</div><div className="whitespace-pre-wrap">{l.guru.rubrik || '—'}</div></div>
                      <div><div className="font-medium text-gray-600">Catatan fasilitasi</div><div className="whitespace-pre-wrap">{l.guru.catatan || '—'}</div></div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ---- Tab Keselarasan ---- */}
            {tab === 'periksa' && (
              <div className="space-y-4">
                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-3">Hasil pemeriksaan (oleh kode, bukan AI)</h3>
                  {jumlahMasalah === 0 ? (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">✓ Semua TP muncul di kegiatan, asesmen{lkpdDiminta ? ', dan tugas LKPD' : ''}; jumlah menit tiap pertemuan sesuai alokasi.</p>
                  ) : (
                    <ul className="space-y-2">
                      {kosong.length > 0 && (
                        <li className="text-sm rounded-xl border border-red-200 bg-red-50 text-red-800 p-3">Bagian masih kosong: {kosong.join(', ')}. Buat ulang bagian terkait.</li>
                      )}
                      {peringatan.map((w, i) => (
                        <li key={i} className={`text-sm rounded-xl border p-3 flex items-start gap-3 ${w.tingkat === 'galat' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                          <span className="flex-1">{w.pesan}</span>
                          {w.kode === 'menit' && w.bagian?.startsWith('p:') && (
                            <button type="button" onClick={() => perbaikiMenit(Number(w.bagian!.slice(2)))} className="text-xs px-2 py-1 rounded-lg bg-white border border-red-300 text-red-700 whitespace-nowrap hover:bg-red-100">
                              Sesuaikan menit
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-gray-400 mt-3">Peringatan tidak menghalangi unduhan. Perbaiki lewat "Buat ulang" di tiap bagian, atau sunting langsung di Word.</p>
                </div>

                <div className={kKartu}>
                  <h3 className="font-semibold text-gray-900 mb-3">F. Peta Keselarasan</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-left"><tr><th className="p-2">Tujuan</th><th className="p-2">Kegiatan</th><th className="p-2">Tugas LKPD</th><th className="p-2">Asesmen</th></tr></thead>
                      <tbody>
                        {petaKeselarasan(modul, daftarLkpd).map((b) => (
                          <tr key={b.kode} className="border-t border-gray-100 align-top">
                            <td className="p-2"><b>{b.kode}.</b> {b.teks}</td>
                            <td className={`p-2 ${b.kegiatan.length ? '' : 'text-red-600'}`}>{b.kegiatan.join('; ') || '—'}</td>
                            <td className={`p-2 ${b.lkpd.length || !lkpdDiminta ? '' : 'text-red-600'}`}>{b.lkpd.join('; ') || '—'}</td>
                            <td className={`p-2 ${b.asesmen.length ? '' : 'text-red-600'}`}>{b.asesmen.join('; ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ---- Aksi ---- */}
            <div className={`${kKartu} space-y-3`}>
              <div className="flex flex-wrap gap-2">
                {formHasil.keluaran !== 'lkpd' && (
                  <button type="button" onClick={() => unduhAman('modul')} disabled={!selesaiGenerate} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">⬇ Modul Ajar (.docx)</button>
                )}
                {lkpdDiminta && daftarLkpd.length > 0 && (
                  <>
                    <button type="button" onClick={() => unduhAman('lkpd')} disabled={!selesaiGenerate} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">⬇ LKPD Murid (.docx)</button>
                    <button type="button" onClick={() => unduhAman('guru')} disabled={!selesaiGenerate} className="px-4 py-2 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50">⬇ Lembar Guru (.docx)</button>
                  </>
                )}
                <button type="button" onClick={buatSoal} disabled={!selesaiGenerate} className="px-4 py-2 rounded-xl border-2 border-purple-500 text-purple-700 text-sm font-medium hover:bg-purple-50 disabled:opacity-50">
                  ✍ Buat soal dari modul ini
                </button>
              </div>
              {pesanUnduh && <p className="text-sm text-red-600">{pesanUnduh}</p>}
              <p className="text-xs text-gray-400">Tombol "Buat soal" memindahkan mapel, fase, topik, dan tujuan pembelajaran ke Generator AKM.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
