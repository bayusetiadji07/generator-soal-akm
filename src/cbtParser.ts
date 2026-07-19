// ===================== Parser Naskah Soal (docx -> struktur soal) =====================
// Dipakai oleh mode "Generator CBT" di App.tsx.
// Format yang dikenali per paragraf:
//   "1. [PG] teks soal"      -> mulai soal baru, tipe PG/PGK/ISIAN/ESSAY
//   "A. teks opsi" / "*A. teks opsi" (bintang = kunci benar) -> opsi PG/PGK
//   "Kunci: jawaban | alternatif"  -> kunci ISIAN (boleh beberapa dipisah "|")
//   "Pembahasan: teks"        -> pembahasan (opsional, semua tipe)
// Baris lain sebelum opsi/kunci/pembahasan pertama dianggap lanjutan teks soal (stimulus).
// Baris polos setelah "Pembahasan:" dianggap lanjutan pembahasan.
// Gambar yang disisipkan pada suatu paragraf ikut ditempel ke field yang sedang aktif.

export type TipeSoal = 'PG' | 'PGK' | 'ISIAN' | 'ESSAY';

export interface OpsiSoal {
  teks: string;
  benar: boolean;
  gambar?: string[];
}

export interface SoalParsed {
  nomorAsli: string;
  tipe: TipeSoal;
  tanya: string;
  opsi: OpsiSoal[];
  kunciIsian: string[];
  pembahasan: string;
  gambar: string[];
  errors: string[];
  valid: boolean;
}

const RX_SOAL_START = /^(\d+)[.)]\s*\[(PG|PGK|ISIAN|ESSAY)\]\s*(.*)$/i;
const RX_OPSI = /^(\*?)\s*([A-Ea-e])[.)]\s*(.*)$/;
const RX_KUNCI = /^Kunci\s*:\s*(.*)$/i;
const RX_PEMBAHASAN = /^Pembahasan\s*:\s*(.*)$/i;

export function parseSoalDariHtml(htmlString: string): SoalParsed[] {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const blocks = Array.from(doc.body.children).filter((el) => el.tagName !== 'IMG');

  const soalList: SoalParsed[] = [];
  let cur: SoalParsed | null = null;
  let mode: 'tanya' | 'opsi' | 'kunci' | 'pembahasan' | null = null;

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
        kunciIsian: [],
        pembahasan: '',
        gambar: [],
        errors: [],
        valid: false,
      };
      mode = 'tanya';
      attachImages(block, cur);
      return;
    }
    if (!cur) return;

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

function validateSoal(s: SoalParsed): SoalParsed {
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
  }
  s.errors = errors;
  s.valid = errors.length === 0;
  return s;
}
