// ===================== Parser Naskah Soal (docx -> struktur soal) =====================
// Dipakai oleh mode "Generator CBT" di App.tsx.
// Format yang dikenali per paragraf:
//   "1. [PG] teks soal"      -> mulai soal baru, tipe PG/PGK/ISIAN/ESSAY/BS/JODOH
//   "A. teks opsi" / "*A. teks opsi" (bintang = kunci benar) -> opsi PG/PGK
//   "- pernyataan | BENAR"   -> baris anak Benar-Salah (BS)
//   "- pernyataan | jawaban" -> baris anak Menjodohkan (JODOH)
//   "Kunci: jawaban | alternatif"  -> kunci ISIAN (boleh beberapa dipisah "|")
//   "Pembahasan: teks"        -> pembahasan (opsional, semua tipe)
// Baris lain sebelum opsi/kunci/pembahasan pertama dianggap lanjutan teks soal (stimulus).
// Baris polos setelah "Pembahasan:" dianggap lanjutan pembahasan.
// Gambar yang disisipkan pada suatu paragraf ikut ditempel ke field yang sedang aktif.

export type TipeSoal = 'PG' | 'PGK' | 'ISIAN' | 'ESSAY' | 'BS' | 'JODOH';

export interface OpsiSoal {
  teks: string;
  benar: boolean;
  gambar?: string[];
}

// Baris anak untuk Benar-Salah & Menjodohkan: "pernyataan | jawaban"
// BS   -> jawab 'BENAR' | 'SALAH'
// JODOH-> jawab = teks pasangan yang benar
export interface SubItemSoal {
  teks: string;
  jawab: string;
}

export interface SoalParsed {
  nomorAsli: string;
  tipe: TipeSoal;
  tanya: string;
  opsi: OpsiSoal[];
  subItem: SubItemSoal[];
  kunciIsian: string[];
  pembahasan: string;
  gambar: string[];
  tabel: string[];
  errors: string[];
  valid: boolean;
  // Dipakai fitur "Ekspor Word (Format CBT)" di mode AKM/TKA (lihat App.tsx) — tidak diisi
  // saat parsing naskah .docx yang diupload guru.
  skip?: boolean;                // bentuk soal tak didukung CBT (Benar-Salah / Menjodohkan)
  kunciTidakTerbaca?: boolean;   // kunci gagal dicocokkan dari bagian D, perlu dicek guru
}

const RX_SOAL_START = /^(\d+)[.)]\s*\[(PG|PGK|ISIAN|ESSAY|BS|JODOH)\]\s*(.*)$/i;
const RX_OPSI = /^(\*?)\s*([A-Ea-e])[.)]\s*(.*)$/;
const RX_KUNCI = /^Kunci\s*:\s*(.*)$/i;
const RX_PEMBAHASAN = /^Pembahasan\s*:\s*(.*)$/i;
// Baris anak BS/JODOH: "- pernyataan | jawaban" (penanda depan boleh "-", "1.", "1)", atau kosong)
const RX_SUBITEM = /^(?:[-–•*]\s*|\d{1,2}[.)]\s*)?(.+?)\s*\|\s*(.+?)\s*$/;

const normalizeBenarSalah = (s: string) => {
  const t = s.trim().toUpperCase();
  if (/^(BENAR|B|TRUE|YA)$/.test(t)) return 'BENAR';
  if (/^(SALAH|S|FALSE|TIDAK)$/.test(t)) return 'SALAH';
  return '';
};

export function parseSoalDariHtml(htmlString: string): SoalParsed[] {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const blocks = Array.from(doc.body.children).filter((el) => el.tagName !== 'IMG');

  const soalList: SoalParsed[] = [];
  let cur: SoalParsed | null = null;
  let mode: 'tanya' | 'opsi' | 'subitem' | 'kunci' | 'pembahasan' | null = null;

  function pushCur() {
    if (cur) {
      cur.tanya = cur.tanya.trim();
      cur.pembahasan = (cur.pembahasan || '').trim();
      soalList.push(cur);
    }
  }

  function attachImages(el: Element, target: { gambar: string[] }) {
    const imgs = el.querySelectorAll('img');
    imgs.forEach((img) => target.gambar.push(img.getAttribute('src') || ''));
  }

  blocks.forEach((block) => {
    // Tabel (mis. disisipkan lewat Insert > Table di Word) dipertahankan sbg HTML utuh, bukan
    // diratakan jadi teks — supaya tampil sbg tabel sungguhan di aplikasi CBT, bukan kalimat acak.
    if (block.tagName === 'TABLE') {
      if (cur && mode === 'tanya') cur.tabel.push(block.outerHTML);
      return;
    }

    const text = (block.textContent || '').replace(/\s+/g, ' ').trim();
    const hasImgOnly = !text && block.querySelector('img');
    if (!text && !hasImgOnly) return;

    let m: RegExpMatchArray | null;
    if ((m = text.match(RX_SOAL_START))) {
      pushCur();
      cur = {
        nomorAsli: m[1],
        tipe: m[2].toUpperCase() as TipeSoal,
        tanya: m[3] || '',
        opsi: [],
        subItem: [],
        kunciIsian: [],
        pembahasan: '',
        gambar: [],
        tabel: [],
        errors: [],
        valid: false,
      };
      mode = 'tanya';
      attachImages(block, cur);
      return;
    }
    if (!cur) return;

    // Baris anak BS/JODOH dicek LEBIH DULU: "A. Ibu kota | Jakarta" juga cocok pola opsi biasa,
    // jadi untuk kedua tipe ini pola "teks | jawaban" harus menang.
    if ((cur.tipe === 'BS' || cur.tipe === 'JODOH') && (m = text.match(RX_SUBITEM))) {
      const teks = (m[1] || '').trim();
      const jawabRaw = (m[2] || '').trim();
      const jawab = cur.tipe === 'BS' ? normalizeBenarSalah(jawabRaw) : jawabRaw;
      if (teks && jawab) {
        cur.subItem.push({ teks, jawab });
        mode = 'subitem';
        return;
      }
    }

    if ((m = text.match(RX_OPSI))) {
      cur.opsi.push({ teks: m[3] || '', benar: m[1] === '*' });
      mode = 'opsi';
      const lastOpsi = cur.opsi[cur.opsi.length - 1];
      const imgs = Array.from(block.querySelectorAll('img')).map((i) => i.getAttribute('src') || '');
      lastOpsi.gambar = imgs;
      return;
    }
    if ((m = text.match(RX_KUNCI))) {
      cur.kunciIsian = m[1].split('|').map((s) => s.trim()).filter(Boolean);
      mode = 'kunci';
      return;
    }
    if ((m = text.match(RX_PEMBAHASAN))) {
      cur.pembahasan = m[1] || '';
      mode = 'pembahasan';
      attachImages(block, cur);
      return;
    }

    if (mode === 'tanya') {
      cur.tanya += (cur.tanya ? ' ' : '') + text;
      attachImages(block, cur);
    } else if (mode === 'opsi' && cur.opsi.length) {
      const lastOpsi = cur.opsi[cur.opsi.length - 1];
      lastOpsi.teks += (lastOpsi.teks ? ' ' : '') + text;
    } else if (mode === 'pembahasan') {
      cur.pembahasan += (cur.pembahasan ? ' ' : '') + text;
      attachImages(block, cur);
    }
  });
  pushCur();

  return soalList.map(validateSoal);
}

export function validateSoal(s: SoalParsed): SoalParsed {
  const errors: string[] = [];
  if (!s.tanya) errors.push('Teks soal kosong.');
  if (s.tipe === 'PG') {
    const benar = s.opsi.filter((o) => o.benar).length;
    if (s.opsi.length < 2) errors.push('Opsi PG minimal 2.');
    if (benar !== 1) errors.push(`PG harus tepat 1 opsi kunci (ditemukan ${benar}).`);
  } else if (s.tipe === 'PGK') {
    const benar = s.opsi.filter((o) => o.benar).length;
    if (s.opsi.length < 2) errors.push('Opsi PGK minimal 2.');
    if (benar < 1) errors.push('PGK butuh minimal 1 opsi kunci bertanda *.');
  } else if (s.tipe === 'ISIAN') {
    if (s.kunciIsian.length === 0) errors.push('ISIAN butuh baris "Kunci: ...".');
  } else if (s.tipe === 'BS') {
    if (s.subItem.length < 2) errors.push('Benar-Salah butuh minimal 2 pernyataan berformat "pernyataan | BENAR/SALAH".');
    else if (s.subItem.some((it) => it.jawab !== 'BENAR' && it.jawab !== 'SALAH')) errors.push('Jawaban Benar-Salah harus BENAR atau SALAH.');
  } else if (s.tipe === 'JODOH') {
    if (s.subItem.length < 2) errors.push('Menjodohkan butuh minimal 2 pasangan berformat "pernyataan | jawaban".');
    else if (s.subItem.some((it) => !it.jawab)) errors.push('Ada pasangan Menjodohkan yang jawabannya kosong.');
  }
  s.errors = errors;
  s.valid = errors.length === 0;
  return s;
}
