import { useState, useRef } from 'react';
import { parseSoalDariHtml, validateSoal, type SoalParsed } from './cbtParser';
import { buildCbtHtml } from './cbtTemplate';
import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell } from 'docx';

declare const mammoth: any;

// Pemetaan Fase Kurikulum Merdeka → jenjang & pilihan kelas
const FASE = {
  A: { jenjang: 'SD', kelas: ['1', '2'] },
  B: { jenjang: 'SD', kelas: ['3', '4'] },
  C: { jenjang: 'SD', kelas: ['5', '6'] },
  D: { jenjang: 'SMP', kelas: ['7', '8', '9'] },
  E: { jenjang: 'SMA/SMK', kelas: ['10'] },
  F: { jenjang: 'SMA/SMK', kelas: ['11', '12'] },
};

// ===== Konstanta khusus Generator TKA (mengikuti TKA Assessment Engine Manual) =====
// Ruang lingkup TKA: jenjang SD & SMP, 4 mapel inti. TKA selalu di akhir jenjang (SD=kelas 6, SMP=kelas 9) — tidak perlu pilih kelas/semester.
const TKA_JENJANG = {
  SD: { kelasAkhir: '6' },
  SMP: { kelasAkhir: '9' },
};

const TKA_SUBJECTS = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA'];

// Kerangka kompetensi per domain (BAB 3-6 manual)
const TKA_KOMPETENSI = {
  Matematika: [
    'Knowing (Mengetahui fakta, prosedur, dan konsep dasar)',
    'Applying (Menerapkan konsep dalam situasi rutin)',
    'Reasoning (Menalar dalam situasi non-rutin dan kompleks)',
  ],
  'Bahasa Indonesia': [
    'Pemahaman Literal (menemukan informasi tersurat)',
    'Pemahaman Inferensial (menyimpulkan informasi tersirat)',
    'Evaluasi dan Apresiasi (menilai isi dan kualitas teks)',
  ],
  'Bahasa Inggris': [
    'Literal Comprehension',
    'Inferential Comprehension',
    'Evaluation',
    'Vocabulary in Context',
    'Main Idea',
    'Supporting Details',
    'Reference',
    'Text Organization',
    'Communicative Purpose',
  ],
  IPA: [
    'Menjelaskan Fenomena Ilmiah',
    'Menginterpretasi Data dan Bukti Ilmiah',
    'Mengevaluasi Penyelidikan Ilmiah',
    'Menggunakan Bukti Ilmiah',
  ],
};

// Bank Konteks (BAB 7 manual + Context Engine v5): 30+ kategori konteks Indonesia
const TKA_KONTEKS = [
  'Acak / Bebas dipilih AI (disarankan, variatif)',
  'Kehidupan Sekolah', 'Perpustakaan', 'Masa Pengenalan Lingkungan Sekolah (MPLS)', 'Pramuka',
  'Keluarga dan Rumah Tangga', 'Budaya dan Tradisi Indonesia', 'Museum',
  'Kesehatan dan Gaya Hidup', 'Teknologi dan Digitalisasi', 'Lingkungan dan Ekologi',
  'Ekonomi dan Keuangan', 'Koperasi', 'Transportasi', 'Energi dan Sumber Daya',
  'Pertanian dan Perkebunan', 'UMKM dan Kewirausahaan', 'Pasar', 'Pariwisata',
  'Olahraga', 'Seni dan Kreativitas', 'Sejarah Indonesia',
  'Geografi dan Kewilayahan', 'Kehidupan Sosial dan Masyarakat', 'Komunikasi dan Media',
  'Industri dan Manufaktur', 'Perdagangan dan Pasar', 'Kuliner dan Pangan',
  'Cuaca dan Iklim', 'Kependudukan', 'Hukum dan Tata Tertib',
  'Keagamaan dan Toleransi', 'Konservasi Alam', 'Bencana Alam dan Mitigasi',
  'Kesehatan Mental dan Sosial-Emosional', 'Keselamatan Kerja', 'Perikanan dan Kelautan',
  'Peternakan', 'Ruang Angkasa dan Astronomi',
];

// Bank Referensi Submateri & Jenis Teks per jenjang (Subject Engine, v5 Master Prompt) —
// dipakai sebagai ACUAN internal AI, bukan pilihan UI, agar submateri & jenis teks sesuai standar TKA.
const TKA_REFERENSI = {
  Matematika: {
    SD: 'Ruang lingkup: Bilangan, Geometri, Pengukuran, Data.',
    SMP: 'Ruang lingkup: Bilangan, Aljabar, Geometri, Pengukuran, Data, Peluang.',
    catatan: 'Distribusi default level Knowing : Applying : Reasoning = 20% : 40% : 40% bila tidak dispesifikkan lain.',
  },
  'Bahasa Indonesia': {
    SD: 'Teks 150-200 kata. Jenis teks: cerita, informasi, petunjuk, pengumuman, biografi sederhana.',
    SMP: 'Teks 200-250 kata. Jenis teks: artikel, berita, laporan, prosedur, biografi, cerita (boleh dua teks terkait bila diperlukan).',
  },
  'Bahasa Inggris': {
    SD: 'Teks 80-150 words. Text types: Announcement, Notice, Greeting Card, Short Message, Procedure, Narrative, Descriptive, Recount.',
    SMP: 'Teks 150-250 words. Text types: Report, Email, Advertisement, Poster, Schedule, Narrative, Descriptive, Recount, Procedure.',
  },
  IPA: {
    SD: 'Ruang lingkup: makhluk hidup, energi, gaya, cahaya, bunyi, bumi & antariksa, lingkungan, perubahan wujud.',
    SMP: 'Ruang lingkup: sistem organ, genetika, ekosistem, bioteknologi, zat, reaksi kimia, asam basa, tekanan, gelombang, listrik, kemagnetan, tata surya, perubahan iklim, pencemaran.',
  },
};

// Bank Kategori Materi (checkbox) per mapel & jenjang. Guru hanya memilih KATEGORI;
// daftar "submateri" di dalamnya HANYA acuan internal — AI yang otomatis memilih submateri spesifik.
const TKA_MATERI_KATEGORI = {
  Matematika: {
    SD: [
      { id: 'bilangan', label: 'A. Bilangan', submateri: ['Operasi hitung campuran', 'Bilangan bulat', 'Pecahan', 'Desimal', 'Persen', 'KPK', 'FPB', 'Faktor dan kelipatan', 'Pola bilangan', 'Perbandingan', 'Skala'] },
      { id: 'geometri_pengukuran', label: 'B. Geometri dan Pengukuran', submateri: ['Bangun datar: persegi, persegi panjang, segitiga, jajar genjang, trapesium, layang-layang, belah ketupat, lingkaran', 'Bangun ruang: kubus, balok, tabung sederhana', 'Pengukuran: panjang, berat, waktu, sudut, luas, keliling, volume'] },
      { id: 'data', label: 'C. Data', submateri: ['Tabel', 'Diagram batang', 'Diagram gambar', 'Diagram garis sederhana', 'Rata-rata', 'Membaca informasi'] },
    ],
    SMP: [
      { id: 'bilangan', label: 'A. Bilangan', submateri: ['Bilangan bulat', 'Bilangan pecahan', 'Bilangan rasional', 'Bentuk akar', 'Pangkat', 'Notasi ilmiah', 'Perbandingan', 'Skala', 'Persentase', 'Aritmetika sosial: untung rugi, diskon, pajak, bunga tunggal, bruto tara netto'] },
      { id: 'aljabar', label: 'B. Aljabar', submateri: ['Bentuk aljabar', 'Operasi bentuk aljabar', 'Persamaan linear satu variabel', 'Pertidaksamaan linear', 'Sistem Persamaan Linear Dua Variabel (SPLDV)', 'Relasi', 'Fungsi', 'Grafik fungsi', 'Pola bilangan', 'Barisan', 'Deret sederhana'] },
      { id: 'geometri_pengukuran', label: 'C. Geometri dan Pengukuran', submateri: ['Bangun datar: luas, keliling, hubungan antar bangun', 'Bangun ruang: kubus, balok, prisma, limas, tabung, kerucut, bola', 'Transformasi: translasi, refleksi, rotasi, dilatasi', 'Kesebangunan', 'Kekongruenan', 'Garis dan sudut', 'Teorema Pythagoras', 'Lingkaran: unsur lingkaran, busur, juring, tembereng, sudut pusat, sudut keliling'] },
      { id: 'data_peluang', label: 'D. Data dan Peluang', submateri: ['Penyajian data: diagram batang, diagram garis, diagram lingkaran', 'Mean', 'Median', 'Modus', 'Jangkauan', 'Peluang kejadian sederhana'] },
    ],
  },
  'Bahasa Indonesia': {
    SD: [
      { id: 'teks_informasi', label: '1. Teks Informasi', submateri: ['Laporan', 'Berita', 'Artikel sederhana'] },
      { id: 'teks_sastra', label: '2. Teks Sastra', submateri: ['Cerita rakyat', 'Dongeng', 'Fabel', 'Legenda', 'Puisi'] },
      { id: 'teks_praktis', label: '3. Teks Praktis', submateri: ['Iklan', 'Pengumuman', 'Poster', 'Petunjuk'] },
    ],
    SMP: [
      { id: 'membaca', label: 'A. Membaca', submateri: ['Ide pokok', 'Gagasan utama', 'Informasi tersurat', 'Informasi tersirat', 'Fakta', 'Opini', 'Simpulan', 'Inferensi'] },
      { id: 'jenis_teks', label: 'B. Jenis Teks', submateri: ['Teks Deskripsi', 'Narasi', 'Eksplanasi', 'Eksposisi', 'Persuasi', 'Argumentasi', 'Laporan Hasil Observasi', 'Berita', 'Prosedur', 'Ulasan', 'Cerita Inspiratif', 'Cerpen', 'Puisi'] },
      { id: 'kebahasaan', label: 'C. Kebahasaan', submateri: ['EYD/PUEBI', 'Kalimat efektif', 'Konjungsi', 'Sinonim', 'Antonim', 'Makna kata', 'Makna istilah', 'Majas', 'Kata baku', 'Kalimat langsung', 'Kalimat tidak langsung'] },
      { id: 'literasi', label: 'D. Literasi', submateri: ['Membandingkan dua teks', 'Menilai isi teks', 'Menentukan tujuan penulis', 'Menentukan sikap penulis', 'Menilai argumen', 'Menentukan bukti pendukung', 'Menafsirkan grafik', 'Menafsirkan tabel', 'Menafsirkan infografis'] },
    ],
  },
  'Bahasa Inggris': {
    SD: [
      { id: 'vocabulary', label: '1. Vocabulary', submateri: ['School', 'Family', 'Hobby', 'Occupation', 'Food', 'Animals', 'Transportation', 'Weather', 'Time'] },
      { id: 'reading', label: '2. Reading', submateri: ['Descriptive text', 'Short announcement', 'Dialogue', 'Invitation', 'Notice', 'Advertisement'] },
      { id: 'grammar', label: '3. Grammar', submateri: ['Simple present', 'Pronoun', 'Adjective', 'Preposition', 'Article', 'Question word'] },
      { id: 'functional_text', label: '4. Functional Text', submateri: ['Greeting', 'Thanking', 'Apologizing', 'Asking permission', 'Introducing'] },
    ],
    SMP: [
      { id: 'reading', label: 'Reading', submateri: ['Main idea', 'Supporting details', 'Inference', 'Reference', 'Vocabulary in context'] },
      { id: 'functional_text', label: 'Functional Text', submateri: ['Announcement', 'Notice', 'Label', 'Greeting card', 'Invitation', 'Advertisement', 'Poster', 'Schedule', 'Message', 'Email'] },
      { id: 'genre_text', label: 'Genre Text', submateri: ['Descriptive', 'Narrative', 'Recount', 'Procedure', 'Report', 'Explanation'] },
      { id: 'grammar', label: 'Grammar', submateri: ['Simple Present', 'Present Continuous', 'Simple Past', 'Present Perfect', 'Future Tense', 'Passive Voice', 'Modal', 'Comparative', 'Superlative', 'Conditional', 'Conjunction', 'Pronoun', 'Preposition'] },
      { id: 'vocabulary', label: 'Vocabulary', submateri: ['Synonym', 'Antonym', 'Word Meaning', 'Contextual Meaning', 'Collocation'] },
      { id: 'writing', label: 'Writing', submateri: ['Sentence arrangement', 'Paragraph arrangement', 'Dialogue completion', 'Text completion'] },
    ],
  },
  IPA: {
    SD: [
      { id: 'makhluk_hidup', label: '1. Makhluk Hidup', submateri: ['Ciri makhluk hidup', 'Klasifikasi sederhana', 'Rantai makanan', 'Ekosistem', 'Adaptasi'] },
      { id: 'tubuh_manusia', label: '2. Tubuh Manusia', submateri: ['Organ', 'Pancaindra', 'Pernapasan', 'Pencernaan', 'Peredaran darah'] },
      { id: 'energi', label: '3. Energi', submateri: ['Bentuk energi', 'Perubahan energi', 'Listrik', 'Magnet', 'Panas'] },
      { id: 'bumi_antariksa', label: '4. Bumi dan Antariksa', submateri: ['Tata surya', 'Rotasi', 'Revolusi', 'Musim', 'Cuaca'] },
      { id: 'materi', label: '5. Materi', submateri: ['Sifat benda', 'Perubahan wujud', 'Campuran', 'Gaya'] },
      { id: 'lingkungan', label: '6. Lingkungan', submateri: ['Pencemaran', 'Daur air', 'Pelestarian alam', 'Perubahan lingkungan'] },
    ],
    SMP: [
      { id: 'biologi', label: 'A. Biologi', submateri: ['Keanekaragaman Makhluk Hidup', 'Klasifikasi', 'Sel', 'Organisasi Kehidupan', 'Sistem Gerak', 'Sistem Pencernaan', 'Sistem Pernapasan', 'Sistem Peredaran Darah', 'Sistem Ekskresi', 'Sistem Saraf', 'Sistem Hormon', 'Sistem Reproduksi', 'Pewarisan Sifat', 'Bioteknologi', 'Ekologi', 'Pencemaran Lingkungan', 'Perubahan Iklim'] },
      { id: 'fisika', label: 'B. Fisika', submateri: ['Pengukuran', 'Besaran', 'Satuan', 'Gerak', 'Gaya', 'Hukum Newton', 'Usaha', 'Energi', 'Pesawat Sederhana', 'Getaran', 'Gelombang', 'Bunyi', 'Cahaya', 'Optik', 'Listrik Statis', 'Listrik Dinamis', 'Kemagnetan', 'Induksi Elektromagnetik'] },
      { id: 'kimia', label: 'C. Kimia', submateri: ['Unsur', 'Senyawa', 'Campuran', 'Asam', 'Basa', 'Garam', 'pH', 'Reaksi Kimia', 'Perubahan Fisika', 'Perubahan Kimia', 'Atom', 'Molekul', 'Partikel Materi'] },
      { id: 'kebumian', label: 'D. Kebumian', submateri: ['Tata Surya', 'Bumi', 'Lapisan bumi', 'Gempa bumi', 'Gunung api', 'Cuaca', 'Iklim'] },
    ],
  },
};

// Kelas SD/SMP → Fase Kurikulum Merdeka (untuk referensi internal prompt TKA)
const kelasToFase = (jenjang, kelas) => {
  if (jenjang === 'SMP') return 'D';
  const k = parseInt(kelas, 10);
  if (k <= 2) return 'A';
  if (k <= 4) return 'B';
  return 'C';
};

export default function App() {
  const [mode, setMode] = useState(null); // null | 'akm' | 'tka'

  const [tkaData, setTkaData] = useState({
    mataPelajaran: 'Matematika',
    jenjang: 'SD',
    kelas: TKA_JENJANG.SD.kelasAkhir, // TKA selalu di akhir jenjang: SD=6, SMP=9 (tidak dipilih user)
    domainKompetensi: [...TKA_KOMPETENSI.Matematika], // multi-pilih (checkbox)
    materiKategori: [], // id kategori materi yang dicentang (lihat TKA_MATERI_KATEGORI)
    konteks: TKA_KONTEKS[0],
    tipeTes: 'Latihan TKA',
    jumlahSoal: 5,
    jumlahPilihan: '4',
    modeGambar: 'tidak', // 'tidak' | 'gambar' (auto-generate & tampil) | 'deskripsi' (teks prompt utk AI lain)

    bentukSoal: {
      pg: true,
      pgk: false,
      menjodohkan: false,
      bs: false,
      isian: false,
      uraian: false
    },
    tingkatKesulitan: {
      mudah: 20,
      sedang: 50,
      sulit: 30
    }
  });

  const [formData, setFormData] = useState({
    mataPelajaran: '',
    fase: 'D',
    kelas: '7',
    semester: 'Ganjil',
    materi: '',
    iktp: '',
    tipeTes: 'Ulangan Harian',
    jumlahSoal: 5,
    jumlahPilihan: '4',
    sertakanGambar: false,
    bentukSoal: {
      pg: true,
      pgk: false,
      menjodohkan: false,
      bs: false,
      isian: false,
      uraian: false
    },
    tingkatKesulitan: {
      mudah: 20,
      sedang: 50,
      sulit: 30
    }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [error, setError] = useState('');
  const [isReloadingImages, setIsReloadingImages] = useState(false);
  const [imageFailures, setImageFailures] = useState(0);
  const [imageError, setImageError] = useState('');
  // Provider AI teks: 'gemini' (default, dukung upload gambar/vision) atau 'deepseek' (cadangan, teks saja)
  const [aiProvider, setAiProvider] = useState(() => {
    try { return localStorage.getItem('ai_provider') || 'gemini'; } catch { return 'gemini'; }
  });
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    try { return localStorage.getItem('gemini_api_key') || ''; } catch { return ''; }
  });
  const [deepseekApiKey, setDeepseekApiKey] = useState(() => {
    try { return localStorage.getItem('deepseek_api_key') || ''; } catch { return ''; }
  });
  // 'bawaan' = pakai API key server (env Vercel, harus diset sendiri di sana); 'custom' = key yang diinput manual
  const [apiKeySource, setApiKeySource] = useState(() => {
    try { return localStorage.getItem('gemini_api_key_source') || 'custom'; } catch { return 'custom'; }
  });
  const [showKey, setShowKey] = useState(false);
  const apiKey = aiProvider === 'deepseek' ? deepseekApiKey : geminiApiKey;
  const [uploadedImages, setUploadedImages] = useState([]); // { id, soalNo, dataUrl }
  // Jejak nama/tokoh/konteks dari hasil generate SEBELUMNYA (sesi ini saja) — dipakai agar generate
  // berikutnya tidak mengulang pola yang sama (masing-masing generator punya riwayat sendiri).
  const [akmHistory, setAkmHistory] = useState([]);
  const [tkaHistory, setTkaHistory] = useState([]);
  const resultRef = useRef(null);

  // Status tombol "Ekspor Word (Format CBT)" di mode AKM/TKA — soal-nya sendiri diturunkan langsung
  // dari generatedHtml (bagian C/D/E) tiap kali tombol diklik, tidak disimpan sbg state terpisah.
  const [cbtExportMsg, setCbtExportMsg] = useState<{ type: 'ok' | 'bad' | 'warn'; text: string } | null>(null);

  // ===== State mode "Generator CBT" (upload naskah Word -> aplikasi ujian CBT HTML) =====
  const [cbtFileName, setCbtFileName] = useState('');
  const [cbtSoal, setCbtSoal] = useState<SoalParsed[]>([]);
  const [cbtParseMsg, setCbtParseMsg] = useState<{ type: 'ok' | 'bad' | 'warn'; text: string } | null>(null);
  const [cbtDragActive, setCbtDragActive] = useState(false);
  const [cbtGenMsg, setCbtGenMsg] = useState('');
  const [cbtConfig, setCbtConfig] = useState({
    judul: '',
    instansi: '',
    durasiMenit: 60,
    acakSoal: true,
    acakOpsi: true,
    scriptUrl: '',
  });

  // Pindah antar generator (AKM/TKA/CBT) — reset hasil & lampiran, API key tetap tersimpan
  const switchMode = (newMode) => {
    setMode(newMode);
    setGeneratedHtml('');
    setError('');
    setImageFailures(0);
    setImageError('');
    setUploadedImages([]);
    setCbtFileName('');
    setCbtSoal([]);
    setCbtParseMsg(null);
    setCbtGenMsg('');
    setCbtExportMsg(null);
  };

  // ===== Handler mode "Generator CBT" =====
  const handleCbtFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setCbtParseMsg({ type: 'bad', text: 'File harus berformat .docx' });
      return;
    }
    setCbtFileName(file.name);
    setCbtGenMsg('');
    setCbtParseMsg({ type: 'warn', text: 'Memproses file...' });
    const reader = new FileReader();
    reader.onload = (e) => {
      mammoth
        .convertToHtml({ arrayBuffer: (e.target as FileReader).result })
        .then((result: { value: string }) => {
          const soal = parseSoalDariHtml(result.value);
          setCbtSoal(soal);
          if (soal.length === 0) {
            setCbtParseMsg({ type: 'bad', text: 'Tidak ada soal terdeteksi. Pastikan format penanda "1. [PG] ..." dst sudah sesuai contoh.' });
            return;
          }
          const invalid = soal.filter((s) => !s.valid).length;
          setCbtParseMsg(
            invalid
              ? { type: 'warn', text: `${soal.length} soal terdeteksi, ${invalid} bermasalah (lihat tanda merah di pratinjau).` }
              : { type: 'ok', text: `${soal.length} soal terdeteksi, semua valid.` }
          );
        })
        .catch((err: Error) => {
          setCbtParseMsg({ type: 'bad', text: `Gagal membaca file: ${err.message}` });
        });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCbtDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCbtDragActive(false);
    if (e.dataTransfer.files.length) handleCbtFile(e.dataTransfer.files[0]);
  };

  const handleCbtConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCbtConfig((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCbtGenerate = () => {
    const html = buildCbtHtml(
      { ...cbtConfig, judul: cbtConfig.judul.trim() || 'Ujian CBT' },
      cbtSoal
    );
    const blob = new Blob([html], { type: 'text/html' });
    const safeName = (cbtConfig.judul.trim() || 'CBT').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cbt-${safeName}.html`;
    a.click();
    setCbtGenMsg(`File cbt-${safeName}.html berhasil diunduh. Bagikan file ini ke siswa untuk dikerjakan.`);
  };

  const handleApiKeyChange = (e) => {
    const v = e.target.value.trim();
    if (aiProvider === 'deepseek') {
      setDeepseekApiKey(v);
      try { localStorage.setItem('deepseek_api_key', v); } catch { /* abaikan */ }
    } else {
      setGeminiApiKey(v);
      try { localStorage.setItem('gemini_api_key', v); } catch { /* abaikan */ }
    }
  };

  const handleApiKeySourceChange = (src) => {
    setApiKeySource(src);
    try { localStorage.setItem('gemini_api_key_source', src); } catch { /* abaikan */ }
  };

  const handleAiProviderChange = (provider) => {
    setAiProvider(provider);
    try { localStorage.setItem('ai_provider', provider); } catch { /* abaikan */ }
  };

  // Upload gambar soal manual (stimulus untuk nomor tertentu)
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const shrunk = await shrinkDataUrl(reader.result, 1024, 0.85);
        setUploadedImages((prev) => [
          ...prev,
          { id: Date.now() + '_' + Math.random().toString(36).slice(2), soalNo: String(prev.length + 1), dataUrl: shrunk },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const updateImageSoalNo = (id, soalNo) =>
    setUploadedImages((prev) => prev.map((u) => (u.id === id ? { ...u, soalNo } : u)));
  const removeUploadedImage = (id) =>
    setUploadedImages((prev) => prev.filter((u) => u.id !== id));

  // Placeholder bawaan (SVG, tanpa internet luar) — dipakai saat gambar gagal/dimuat
  const placeholderSvg = (text) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="100%" height="100%" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

  const IMG_STYLE = 'max-width: 400px; width: 100%; height: auto; border-radius: 8px; margin: 10px 0; display: block;';

  // Kata umum yang sering muncul di soal (bukan nama/tempat) — dibuang dari daftar "jejak" agar tidak membebani prompt
  const SIGNATURE_STOPWORDS = new Set([
    'Soal', 'Kunci', 'Jawaban', 'Pembahasan', 'Identitas', 'Kisi', 'Materi', 'Bentuk', 'Nomor',
    'Level', 'Kognitif', 'Indikator', 'Tujuan', 'Pembelajaran', 'Kelas', 'Semester', 'Fase',
    'Mata', 'Pelajaran', 'Perhatikan', 'Berdasarkan', 'Berikut', 'Jika', 'Maka', 'Dengan',
    'Untuk', 'Yang', 'Adalah', 'Dari', 'Pada', 'Dalam', 'Akan', 'Setiap', 'Semua', 'Salah',
    'Benar', 'Pilihlah', 'Tentukan', 'Hitunglah', 'Jelaskan', 'Sebutkan', 'Analisislah',
    'Domain', 'Kompetensi', 'Konteks', 'Data', 'Tabel', 'Diagram', 'Grafik', 'Ilustrasi',
  ]);

  // Ambil "jejak" nama tokoh/tempat unik dari hasil generate agar bisa dihindari di generate berikutnya
  const extractSignature = (html) => {
    try {
      const div = document.createElement('div');
      // Sisipkan spasi di batas tag blok agar teks antar elemen tidak bergabung (mis. "...Soal"+"Mata..." -> "SoalMata")
      div.innerHTML = html.replace(/<\/(p|li|h[1-6]|div|td|tr)>/gi, ' </$1>');
      const text = div.textContent || '';
      const words = text.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
      const uniq = [...new Set(words.filter((w) => !SIGNATURE_STOPWORDS.has(w)))];
      return uniq.slice(0, 20).join(', ');
    } catch {
      return '';
    }
  };

  // Bangun instruksi anti-pengulangan: kombinasi jejak generate sebelumnya (mode ini saja) + kode acak
  const buildAntiRepetisi = (history) => {
    const nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
    const riwayat = history.length > 0
      ? `RIWAYAT GENERATE SEBELUMNYA DI SESI INI (WAJIB DIHINDARI): nama tokoh, tempat, dan istilah spesifik berikut SUDAH PERNAH dipakai — JANGAN gunakan lagi, ganti dengan yang benar-benar berbeda: ${history.join(' | ')}.`
      : '';
    return `- OTENTIK & ANTI-PENGULANGAN (WAJIB): Kode variasi sesi ini: ${nonce} (jangan tampilkan kode ini di output, gunakan hanya sebagai isyarat internal untuk memilih kombinasi baru). ${riwayat} Setiap kali diminta generate ulang, hasil HARUS berbeda dari kemungkinan hasil sebelumnya: gunakan nama tokoh Nusantara yang beragam dan TIDAK selalu nama pasaran yang sama (Budi/Ani/Siti/Made — variasikan dengan nama dari berbagai daerah: Jawa, Sunda, Batak, Minang, Bugis, Dayak, Papua, Betawi, dll.), angka/data yang berbeda, tempat/konteks yang berbeda, dan sudut pandang soal yang berbeda meski materi/domain yang diminta sama.`;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox' && name === 'sertakanGambar') {
      setFormData(prev => ({ ...prev, sertakanGambar: checked }));
    } else if (name === 'fase') {
      // Ganti fase → reset kelas ke kelas pertama fase tersebut
      setFormData(prev => ({ ...prev, fase: value, kelas: FASE[value].kelas[0] }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        bentukSoal: {
          ...prev.bentukSoal,
          [name]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleDifficultyChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      tingkatKesulitan: {
        ...prev.tingkatKesulitan,
        [name]: parseInt(value) || 0
      }
    }));
  };

  const getSelectedBentukSoal = () => {
    const selected = [];
    if (formData.bentukSoal.pg) selected.push('Pilihan Ganda');
    if (formData.bentukSoal.pgk) selected.push('Pilihan Ganda Kompleks');
    if (formData.bentukSoal.menjodohkan) selected.push('Menjodohkan');
    if (formData.bentukSoal.bs) selected.push('Benar-Salah');
    if (formData.bentukSoal.isian) selected.push('Isian Singkat');
    if (formData.bentukSoal.uraian) selected.push('Uraian');
    return selected.join(', ');
  };

  // ===== Handler khusus form Generator TKA =====
  const handleTkaInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'mataPelajaran') {
      // Ganti mapel → reset domain kompetensi (semua dicentang) & materi kategori mapel tsb
      setTkaData(prev => ({ ...prev, mataPelajaran: value, domainKompetensi: [...TKA_KOMPETENSI[value]], materiKategori: [] }));
    } else if (name === 'jenjang') {
      // Ganti jenjang → kelas otomatis ke akhir jenjang (SD=6, SMP=9), reset materi kategori (beda per jenjang)
      setTkaData(prev => ({ ...prev, jenjang: value, kelas: TKA_JENJANG[value].kelasAkhir, materiKategori: [] }));
    } else if (name === 'modeGambar') {
      setTkaData(prev => ({ ...prev, modeGambar: value }));
    } else if (type === 'checkbox') {
      setTkaData(prev => ({
        ...prev,
        bentukSoal: { ...prev.bentukSoal, [name]: checked }
      }));
    } else {
      setTkaData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Toggle satu domain kompetensi (checkbox multi-pilih)
  const toggleTkaDomain = (domain) => {
    setTkaData(prev => ({
      ...prev,
      domainKompetensi: prev.domainKompetensi.includes(domain)
        ? prev.domainKompetensi.filter(d => d !== domain)
        : [...prev.domainKompetensi, domain]
    }));
  };

  // Toggle satu kategori materi (checkbox multi-pilih)
  const toggleTkaMateriKategori = (id) => {
    setTkaData(prev => ({
      ...prev,
      materiKategori: prev.materiKategori.includes(id)
        ? prev.materiKategori.filter(x => x !== id)
        : [...prev.materiKategori, id]
    }));
  };

  const handleTkaDifficultyChange = (e) => {
    const { name, value } = e.target;
    setTkaData(prev => ({
      ...prev,
      tingkatKesulitan: { ...prev.tingkatKesulitan, [name]: parseInt(value) || 0 }
    }));
  };

  const getSelectedBentukSoalTka = () => {
    const selected = [];
    if (tkaData.bentukSoal.pg) selected.push('Pilihan Ganda');
    if (tkaData.bentukSoal.pgk) selected.push('Pilihan Ganda Kompleks');
    if (tkaData.bentukSoal.menjodohkan) selected.push('Menjodohkan');
    if (tkaData.bentukSoal.bs) selected.push('Benar-Salah');
    if (tkaData.bentukSoal.isian) selected.push('Isian Singkat');
    if (tkaData.bentukSoal.uraian) selected.push('Uraian');
    return selected.join(', ');
  };

  const generatePrompt = () => {
    const jenjang = FASE[formData.fase].jenjang;
    return `
Anda adalah seorang pakar asesmen pendidikan Kurikulum Merdeka, penulis soal AKM, penyusun soal OSN, serta guru berpengalaman jenjang ${jenjang}.
Tugas Anda adalah membuat perangkat soal berkualitas tinggi yang mengembangkan kemampuan Literasi dan Numerasi sesuai karakteristik Kurikulum Merdeka berdasarkan data berikut:

Mata Pelajaran: ${formData.mataPelajaran}
Kelas: ${formData.kelas} ${jenjang} (Fase ${formData.fase})
Semester: ${formData.semester}
Keperluan / Jenis Tes: ${formData.tipeTes}
Tujuan Pembelajaran / Materi: ${formData.materi}
Indikator Ketercapaian Tujuan Pembelajaran (IKTP): ${formData.iktp ? formData.iktp : '(Tidak diisi guru — susun IKTP yang relevan & terukur secara otomatis dari Tujuan Pembelajaran di atas, lalu jadikan acuan soal)'}
Jumlah Soal: ${formData.jumlahSoal}
Jumlah Pilihan Jawaban (untuk Pilihan Ganda / PG Kompleks): ${formData.jumlahPilihan} opsi
Bentuk Soal: ${getSelectedBentukSoal()}
${uploadedImages.length > 0 ? `
GAMBAR STIMULUS DARI GURU (WAJIB DIPAKAI): Guru melampirkan ${uploadedImages.length} gambar (terlampir di pesan ini). Tiap gambar adalah STIMULUS WAJIB untuk soal nomor tertentu — perhatikan keterangan "[Gambar stimulus WAJIB untuk Soal No. X]" tepat sebelum tiap gambar. Untuk setiap gambar: AMATI isinya dengan teliti, lalu SUSUN soal nomor X benar-benar BERDASARKAN gambar tersebut (pertanyaannya harus bergantung pada isi gambar, bukan generik). Pada bagian "C. Soal", di soal nomor X, sisipkan penanda gambar PERSIS ini di posisi stimulus: <img class="user-stimulus" data-userimg="X" alt="Gambar Stimulus Soal X"/> (JANGAN beri atribut src — akan diisi otomatis oleh sistem). Soal yang memakai gambar guru: nomor ${uploadedImages.map((u) => u.soalNo).join(', ')}. Pastikan total ${formData.jumlahSoal} soal mencakup nomor-nomor itu.
` : ''}

Ketentuan Penyusunan Soal:
- Level Kesulitan: Mudah ${formData.tingkatKesulitan.mudah}%, Sedang ${formData.tingkatKesulitan.sedang}%, Sulit ${formData.tingkatKesulitan.sulit}%
- Mengacu pada Kurikulum Merdeka Fase ${formData.fase} (${jenjang}), sesuaikan tingkat kesulitan, kompleksitas bahasa, dan konteks stimulus dengan usia/jenjang peserta didik fase tersebut.
- SESUAIKAN DENGAN JENIS TES "${formData.tipeTes}": sesuaikan cakupan materi, bobot, kedalaman, dan gaya soal dengan karakteristik tes tersebut (mis. Ulangan Harian = fokus 1 materi; PTS/PAS/Sumatif = cakupan luas & berjenjang; AKM/ANBK = berbasis konteks literasi-numerasi; Olimpiade/OSN = HOTS & menantang; Latihan/Kuis = ringkas).
- WAJIB MENGACU PADA IKTP: Setiap soal harus mengukur Indikator Ketercapaian Tujuan Pembelajaran (IKTP) di atas. Indikator Soal pada kisi-kisi harus merupakan turunan/operasionalisasi dari IKTP, dan distribusikan soal agar seluruh IKTP terwakili.
- VALIDASI KONSISTENSI KUNCI-OPSI (WAJIB, sering jadi kesalahan): sebelum menulis bagian D dan E, PERIKSA ULANG setiap soal satu per satu — pastikan isi opsi yang ditandai sebagai jawaban benar di "D. Kunci Jawaban" BENAR-BENAR SAMA PERSIS dengan salah satu opsi yang tertulis di "C. Soal" (bukan opsi lain, bukan hasil menebak/mengarang ulang), dan "E. Pembahasan" menjelaskan opsi yang SAMA dengan kunci tsb. Jika ditemukan ketidaksesuaian saat pemeriksaan ulang, PERBAIKI kunci/pembahasan agar cocok dengan opsi yang benar-benar tertulis, JANGAN biarkan tidak sinkron.
- Berorientasi Literasi dan Numerasi.
- Kontekstual, HOTS, Bernalar kritis, Tidak hanya menghafal.
- Memiliki stimulus yang menarik (konteks kehidupan nyata, fenomena, data sederhana).
- Mengembangkan Profil Pelajar Pancasila.
- BAHASA SOAL: Untuk Mata Pelajaran "${formData.mataPelajaran}"${/inggris|english/i.test(formData.mataPelajaran)
  ? ' (Bahasa Inggris): stimulus, pertanyaan, dan pilihan jawaban WAJIB ditulis dalam BAHASA INGGRIS (karena ini menguji kemampuan berbahasa Inggris siswa). NAMUN bagian "D. Kunci Jawaban" dan "E. Pembahasan" WAJIB tetap ditulis dalam BAHASA INDONESIA (agar mudah dipahami guru saat memeriksa), boleh mengutip kata/frasa asli dari teks Inggris di dalam penjelasan Indonesia tsb. JANGAN menulis pembahasan dalam bahasa Inggris.'
  : ', gunakan Bahasa Indonesia (kecuali istilah/kutipan yang memang berbahasa lain) untuk SEMUA bagian termasuk stimulus, pertanyaan, pilihan jawaban, kunci, dan pembahasan. Untuk mapel bahasa asing/daerah lain, tulis stimulus/pertanyaan/pilihan dalam bahasa tersebut, tetapi kunci jawaban dan pembahasan tetap dalam Bahasa Indonesia'}. Bahasa harus baik, benar, dan tidak ambigu.
- PENULISAN MATEMATIKA (WAJIB): DILARANG KERAS memakai LaTeX atau Markdown untuk rumus (jangan ada \\frac, \\times, \\sqrt, \\pi, tanda $...$, \\( \\), \\[ \\], atau ^ dan _ mentah). Tulis SEMUA matematika sebagai HTML biasa yang langsung terbaca: pangkat pakai <sup> (mis. x<sup>2</sup>, 10<sup>3</sup>), indeks/subskrip pakai <sub> (mis. H<sub>2</sub>O), pecahan tulis a/b atau gunakan simbol ½ ¾, dan pakai simbol Unicode untuk operasi: × ÷ − ± ≤ ≥ ≠ ≈ √ π ° ∑ ∞ (BUKAN kode LaTeX). Rumus harus tampil rapi tanpa kode mentah.
- Gunakan variasi tingkat kognitif (C1-C6, dominan C3-C5).
- Integrasikan aspek literasi (menemukan, memahami, menginterpretasi, mengevaluasi informasi).
- Integrasikan aspek numerasi (membaca tabel/grafik, penalaran matematis, probabilitas, dll). Untuk mapel Non-Matematika, sisipkan unsur numerasi lewat tabel/data/persentase.
- ORISINAL: Jangan menyalin dari buku. Gunakan nama/tokoh/tempat yang bervariasi.
${buildAntiRepetisi(akmHistory)}
- VARIASI STIMULUS: Setiap soal WAJIB memiliki stimulus yang sesuai konteks, dan variasikan bentuknya antar soal. Pilih bentuk paling tepat: teks/wacana, studi kasus nyata, tabel data, grafik/diagram, persentase atau data statistik, infografis, atau gambar/ilustrasi deskriptif. Patuhi format teknis berikut agar tampil benar:
  - TABEL, DATA STATISTIK & PERSENTASE: gunakan <table border="1" cellpadding="5"> berisi data yang realistis dan konsisten.
  - GRAFIK/DIAGRAM (batang, garis, lingkaran/pie): DILARANG dibuat sebagai gambar/foto. WAJIB dibuat sebagai kode <svg> inline yang valid dan akurat sesuai data — lengkap dengan sumbu, label, dan nilai yang terbaca jelas, lebar maksimal 480px. Bila relevan, sertakan juga tabel datanya.
  - INFOGRAFIS: kombinasikan tabel dan/atau <svg> sederhana dengan poin-poin teks ringkas yang tertata rapi.
${formData.sertakanGambar
  ? `  - GAMBAR/ILUSTRASI DESKRIPTIF: gunakan tag ini persis: <img class="generated-image" data-prompt="[PROMPT GAMBAR DALAM BAHASA INGGRIS]" src="https://via.placeholder.com/400x200?text=Memuat..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>. ATURAN KETAT agar gambar RELEVAN & AKURAT: (1) WAJIB (BUKAN opsional): dari total ${formData.jumlahSoal} soal, PALING SEDIKIT 1 soal HARUS memakai gambar ilustrasi — jangan sampai nol/tidak ada gambar sama sekali. Maksimal 2-3 soal saja yang pakai gambar, jangan setiap soal. (2) HANYA untuk objek/pemandangan/benda nyata yang sederhana dan umum (mis. "a glass of water", "a green leaf", "a wooden table with fruits"). (3) JANGAN minta gambar yang butuh ketepatan ilmiah/teknis (diagram berlabel, anatomi detail, peta, rumus, struktur kimia, grafik) — untuk itu pakai SVG/tabel/teks. (4) AKURASI WAJIB: data-prompt harus secara eksplisit menyebutkan SEMUA objek, jumlah, warna, posisi, dan detail spesifik yang disebut di teks soal/stimulus itu sendiri (contoh: jika soal menyebut "3 buah apel merah di atas meja kayu", prompt harus "three red apples on a wooden table", BUKAN deskripsi umum "fruits on a table") — supaya gambar cocok persis dengan yang ditanyakan, bukan sekadar mirip tema. (5) GAYA RINGAN: minta gaya "simple flat illustration" atau "clean minimalist photo", "plain white or light background", "no clutter, no extra objects" — supaya gambar sederhana, ukuran file kecil, dan cepat dibuat. (6) data-prompt harus deskriptif, konkret, dalam SATU kalimat singkat, dan TANPA teks/tulisan/angka di dalam gambar.`
  : `  - GAMBAR FOTO: JANGAN gunakan tag <img> atau gambar foto sama sekali. Sebagai gantinya sajikan stimulus visual lewat tabel, grafik <svg>, atau deskripsi teks yang jelas.`}
- FORMAT TIAP BENTUK SOAL (WAJIB dipatuhi agar tampilan jawaban benar):
  - Pilihan Ganda (PG): tepat SATU jawaban benar. Sediakan TEPAT ${formData.jumlahPilihan} opsi jawaban berlabel huruf. Tulis opsi sebagai <ol type="A"> dengan tiap opsi di <li> (jadi A sampai huruf ke-${formData.jumlahPilihan}). Pastikan pengecoh (distraktor) logis. Di bagian D. Kunci Jawaban, tulis HURUF kunci PERSIS sesuai posisi opsi yang isinya benar di bagian C. Soal (hitung ulang urutan A/B/C/... sebelum menulis kunci, JANGAN menebak).
  - Pilihan Ganda Kompleks (PGK): BISA LEBIH DARI SATU jawaban benar. Sediakan TEPAT ${formData.jumlahPilihan} opsi/pernyataan. WAJIB awali SETIAP opsi dengan kotak centang "☐ " (karakter U+2610 lalu spasi) agar siswa bisa menandai banyak jawaban. Susun sebagai daftar tanpa nomor, contoh: <ul style="list-style:none;padding-left:0"><li>☐ pernyataan pertama</li><li>☐ pernyataan kedua</li>...</ul>. Beri petunjuk singkat "(Pilih semua jawaban yang benar)". JANGAN gunakan A/B/C/D untuk PGK — karena opsi PGK TIDAK berlabel huruf, di bagian D. Kunci Jawaban WAJIB kutip ULANG teks pernyataan yang benar kata-per-kata persis sama dengan yang tertulis di C. Soal (JANGAN pakai huruf/nomor yang tidak ada).
  - Benar-Salah (BS): sajikan sebagai <table border="1" cellpadding="5"> dengan kolom "Pernyataan", "Benar (☐)", dan "Salah (☐)"; isi sel Benar/Salah dengan "☐".
  - Menjodohkan: gunakan <table border="1" cellpadding="5"> dua kolom (kiri pernyataan bernomor, kanan pilihan jawaban berhuruf yang diacak).
  - Isian Singkat: akhiri kalimat dengan garis isian "_______".
  - Uraian: beri instruksi jelas dan sediakan ruang jawaban.

BERIKAN OUTPUT DALAM FORMAT HTML MURNI (tanpa tag <html>, <head>, atau <body>, langsung gunakan tag heading seperti <h2>, <h3>, <p>, <table>, <ul>, <ol>, <b>, dll). Pastikan styling tabel rapi menggunakan atribut HTML border="1" cellpadding="5". Jangan gunakan markdown (\`\`\`).

Format output yang WAJIB dipenuhi:
<h2>A. Identitas Soal</h2>
(tampilkan identitas)
<h2>B. Kisi-kisi Soal</h2>
(Buat tabel kisi-kisi berisi No, Materi, Tujuan Pembelajaran, IKTP, Indikator Soal, Level Kognitif, Literasi/Numerasi, Bentuk Soal, Nomor)
<h2>C. Soal</h2>
(Tampilkan tiap soal lengkap dengan stimulus, pertanyaan, dan pilihan/area jawaban)
<h2>D. Kunci Jawaban</h2>
(WAJIB berupa daftar bernomor "1. ...", "2. ...", dst — SATU baris per nomor soal, PERSIS mengikuti nomor di bagian C, JANGAN pakai tabel/format lain. Untuk PG tulis hurufnya saja mis. "1. B", untuk PGK tulis semua huruf yang benar mis. "2. A, C", untuk Isian Singkat tulis jawabannya mis. "3. 144", untuk Benar-Salah tulis urut sesuai urutan pernyataan mis. "4. Benar, Salah, Benar", untuk Menjodohkan tulis pasangan nomor-huruf mis. "5. 1-C, 2-A, 3-B".)
<h2>E. Pembahasan</h2>
(WAJIB berupa daftar bernomor "1. ...", "2. ...", dst — SATU entri per nomor soal, PERSIS mengikuti nomor di bagian C, penjelasan ringkas 1-2 kalimat.)

PENTING: Output BERHENTI setelah bagian "E. Pembahasan". JANGAN membuat bagian "Analisis Soal" maupun "Pemeriksaan Kualitas Soal".
`;
  };

  // ===== Prompt Generator TKA (mengikuti TKA Assessment Engine v6 Professional Manual) =====
  const generateTkaPrompt = () => {
    const jenjang = tkaData.jenjang;
    const fase = kelasToFase(jenjang, tkaData.kelas);
    const isKontekAcak = tkaData.konteks === TKA_KONTEKS[0];
    const daftarKonteks = TKA_KONTEKS.slice(1).join(', ');
    const refSubjek = TKA_REFERENSI[tkaData.mataPelajaran] || {};
    const refJenjang = refSubjek[jenjang] || '';
    const catatanDistribusi = refSubjek.catatan || '';

    const kategoriTersedia = (TKA_MATERI_KATEGORI[tkaData.mataPelajaran] && TKA_MATERI_KATEGORI[tkaData.mataPelajaran][jenjang]) || [];
    const kategoriTerpilih = kategoriTersedia.filter(k => tkaData.materiKategori.includes(k.id));
    const materiBlock = kategoriTerpilih.length > 0
      ? kategoriTerpilih.map(k => `- ${k.label}\n  Submateri acuan (AI pilih otomatis yang paling sesuai, boleh gabungkan beberapa): ${k.submateri.join('; ')}`).join('\n')
      : `(Guru tidak memilih kategori spesifik — AI bebas memilih materi dari seluruh ruang lingkup ${tkaData.mataPelajaran} jenjang ${jenjang}: ${refJenjang})`;

    return `
Anda adalah TKA Assessment Engine — sistem pakar penyusun soal Tes Kemampuan Akademik (TKA) untuk jenjang SD dan SMP di Indonesia. Anda mengikuti alur kerja profesional secara berurutan dan INTERNAL (jangan tampilkan proses ini di output, cukup hasil akhirnya):
1) Blueprint (rancang kisi-kisi) → 2) Stimulus (susun stimulus sesuai karakteristik jenjang & konteks) → 3) Penyusunan Soal (konstruksi soal berdasarkan domain kompetensi) → 4) Pemeriksaan Pengecoh (distraktor logis, bukan asal) → 5) Validasi Bahasa (baku, jelas, sesuai usia) → 6) Validasi Jawaban (kunci benar & konsisten) → 7) Deteksi Kemiripan (pastikan tiap soal berbeda signifikan) → 8) Export.
Prinsip TKA: VALID, RELIABEL, AUTENTIK, KONTEKSTUAL, dan BERBASIS KOMPETENSI — bukan soal hafalan.

Data Penyusunan Soal TKA:
Mata Pelajaran: ${tkaData.mataPelajaran}
Jenjang: ${jenjang}, Kelas ${tkaData.kelas} (akhir jenjang ${jenjang}; setara Fase ${fase} Kurikulum Merdeka)
Keperluan / Jenis Tes: ${tkaData.tipeTes}
Kategori Materi yang Dipilih Guru:
${materiBlock}
Domain Kompetensi yang Diutamakan (boleh lebih dari satu): ${tkaData.domainKompetensi.join(', ')}
Konteks Stimulus: ${isKontekAcak
      ? `Bebas dipilih AI dari Bank Konteks berikut — WAJIB VARIASIKAN antar soal, jangan mengulang konteks yang sama dua kali: ${daftarKonteks}.`
      : `WAJIB gunakan konteks "${tkaData.konteks}" untuk seluruh stimulus soal (boleh divariasikan sudut pandang/situasinya, tetap dalam kategori ini).`}
Jumlah Soal: ${tkaData.jumlahSoal}
Jumlah Pilihan Jawaban (untuk Pilihan Ganda / PG Kompleks): ${tkaData.jumlahPilihan} opsi
Bentuk Soal: ${getSelectedBentukSoalTka()}
${uploadedImages.length > 0 ? `
GAMBAR STIMULUS DARI GURU (WAJIB DIPAKAI): Guru melampirkan ${uploadedImages.length} gambar (terlampir di pesan ini). Tiap gambar adalah STIMULUS WAJIB untuk soal nomor tertentu — perhatikan keterangan "[Gambar stimulus WAJIB untuk Soal No. X]" tepat sebelum tiap gambar. Untuk setiap gambar: AMATI isinya dengan teliti, lalu SUSUN soal nomor X benar-benar BERDASARKAN gambar tersebut. Pada bagian "C. Soal", di soal nomor X, sisipkan penanda gambar PERSIS ini di posisi stimulus: <img class="user-stimulus" data-userimg="X" alt="Gambar Stimulus Soal X"/> (JANGAN beri atribut src). Soal yang memakai gambar guru: nomor ${uploadedImages.map((u) => u.soalNo).join(', ')}. Pastikan total ${tkaData.jumlahSoal} soal mencakup nomor-nomor itu.
` : ''}

Distribusikan soal agar mencakup variasi domain kompetensi yang dipilih di atas secara merata (atau sesuai proporsi bila hanya satu domain dipilih).
${catatanDistribusi ? catatanDistribusi : ''}

Ketentuan Penyusunan Soal TKA:
- Level Kesulitan: Mudah ${tkaData.tingkatKesulitan.mudah}%, Sedang ${tkaData.tingkatKesulitan.sedang}%, Sulit ${tkaData.tingkatKesulitan.sulit}%.
- Sesuaikan tingkat kesulitan, kompleksitas bahasa, dan konteks stimulus dengan usia peserta didik jenjang ${jenjang} kelas ${tkaData.kelas}.
- SESUAIKAN DENGAN JENIS TES "${tkaData.tipeTes}": sesuaikan cakupan materi, bobot, dan gaya soal (mis. Latihan TKA = fokus pemahaman per domain; Simulasi/Try Out TKA = kondisi mendekati tes asli, cakupan luas & berjenjang; Pemetaan Kompetensi = variatif lintas domain untuk diagnosis).
- Berorientasi Literasi (untuk Bahasa Indonesia/Bahasa Inggris), Numerasi (untuk Matematika), atau Literasi Sains (untuk IPA) sesuai kerangka kompetensi domain di atas.
- Kontekstual dengan kehidupan nyata Indonesia, HOTS, bernalar kritis, tidak hanya menghafal.
- Stimulus harus ORISINAL — jangan menyalin dari buku, gunakan nama/tokoh/tempat yang bervariasi.
${buildAntiRepetisi(tkaHistory)}
- PEMERIKSAAN PENGECOH (khusus PG/PGK): setiap pengecoh (opsi salah) harus masuk akal dan mencerminkan miskonsepsi umum siswa jenjang ini, BUKAN opsi asal-asalan yang jelas salah.
- VALIDASI JAWABAN (WAJIB, sering jadi kesalahan): sebelum menulis bagian D dan E, PERIKSA ULANG setiap soal satu per satu — pastikan isi opsi yang ditandai sebagai jawaban benar di "D. Kunci Jawaban" BENAR-BENAR SAMA PERSIS dengan salah satu opsi yang tertulis di "C. Soal" (bukan opsi lain, bukan hasil menebak/mengarang ulang), dan "E. Pembahasan" menjelaskan opsi yang SAMA dengan kunci tsb. Jika ditemukan ketidaksesuaian saat pemeriksaan ulang, PERBAIKI kunci/pembahasan agar cocok dengan opsi yang benar-benar tertulis, JANGAN biarkan tidak sinkron.
- DETEKSI KEMIRIPAN: setiap soal harus berbeda signifikan satu sama lain — variasikan konteks, angka, nama, struktur kalimat, DAN strategi/cara penyelesaian — dilarang membuat soal yang terasa duplikat/template yang sama persis.
- BAHASA SOAL: Untuk Mata Pelajaran "${tkaData.mataPelajaran}"${/inggris|english/i.test(tkaData.mataPelajaran)
  ? ' (Bahasa Inggris): stimulus, pertanyaan, dan pilihan jawaban WAJIB ditulis dalam BAHASA INGGRIS (karena ini menguji kemampuan berbahasa Inggris siswa). NAMUN bagian "D. Kunci Jawaban" dan "E. Pembahasan" WAJIB tetap ditulis dalam BAHASA INDONESIA (agar mudah dipahami guru saat memeriksa), boleh mengutip kata/frasa asli dari teks Inggris di dalam penjelasan Indonesia tsb. JANGAN menulis pembahasan dalam bahasa Inggris.'
  : ', gunakan Bahasa Indonesia yang baik dan benar untuk SEMUA bagian termasuk stimulus, pertanyaan, pilihan jawaban, kunci, dan pembahasan'}. Bahasa harus baku, jelas, dan tidak ambigu.
- PENULISAN MATEMATIKA (WAJIB): DILARANG KERAS memakai LaTeX atau Markdown untuk rumus (jangan ada \\frac, \\times, \\sqrt, \\pi, tanda $...$, \\( \\), \\[ \\], atau ^ dan _ mentah). Tulis SEMUA matematika sebagai HTML biasa yang langsung terbaca: pangkat pakai <sup> (mis. x<sup>2</sup>, 10<sup>3</sup>), indeks/subskrip pakai <sub> (mis. H<sub>2</sub>O), pecahan tulis a/b atau gunakan simbol ½ ¾, dan pakai simbol Unicode untuk operasi: × ÷ − ± ≤ ≥ ≠ ≈ √ π ° ∑ ∞ (BUKAN kode LaTeX). Rumus harus tampil rapi tanpa kode mentah.
- VARIASI STIMULUS: Setiap soal WAJIB memiliki stimulus yang sesuai konteks, dan variasikan bentuknya antar soal. Pilih bentuk paling tepat: teks/wacana, studi kasus nyata, tabel data, grafik/diagram, denah/peta sederhana (khusus Matematika: Geometri/Pengukuran), persentase atau data statistik, infografis, atau gambar/ilustrasi deskriptif. Patuhi format teknis berikut agar tampil benar:
  - TABEL, DATA STATISTIK & PERSENTASE: gunakan <table border="1" cellpadding="5"> berisi data yang realistis dan konsisten.
  - GRAFIK/DIAGRAM (batang, garis, lingkaran/pie): DILARANG dibuat sebagai gambar/foto. WAJIB dibuat sebagai kode <svg> inline yang valid dan akurat sesuai data — lengkap dengan sumbu, label, dan nilai yang terbaca jelas, lebar maksimal 480px. Bila relevan, sertakan juga tabel datanya.
  - DENAH/PETA SEDERHANA (khusus Matematika, mis. soal jarak/skala/arah): WAJIB dibuat sebagai kode <svg> inline dengan label lokasi/jarak yang jelas dan akurat, BUKAN gambar/foto.
  - INFOGRAFIS: kombinasikan tabel dan/atau <svg> sederhana dengan poin-poin teks ringkas yang tertata rapi.
${tkaData.modeGambar !== 'tidak'
      ? `  - GAMBAR/ILUSTRASI DESKRIPTIF: gunakan tag ini persis: <img class="generated-image" data-prompt="[PROMPT GAMBAR DALAM BAHASA INGGRIS]" src="https://via.placeholder.com/400x200?text=Memuat..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>. ATURAN KETAT agar gambar RELEVAN & AKURAT: (1) WAJIB (BUKAN opsional): dari total ${tkaData.jumlahSoal} soal, PALING SEDIKIT 1 soal HARUS memakai gambar ilustrasi — jangan sampai nol/tidak ada gambar sama sekali. Maksimal 2-3 soal saja yang pakai gambar, jangan setiap soal. (2) HANYA untuk objek/pemandangan/benda nyata yang sederhana dan umum. (3) JANGAN minta gambar yang butuh ketepatan ilmiah/teknis (diagram berlabel, anatomi detail, peta, rumus, struktur kimia, grafik) — untuk itu pakai SVG/tabel/teks. (4) AKURASI WAJIB: data-prompt harus secara eksplisit menyebutkan SEMUA objek, jumlah, warna, posisi, dan detail spesifik yang disebut di teks soal/stimulus itu sendiri — supaya gambar cocok persis dengan yang ditanyakan, bukan sekadar mirip tema. (5) GAYA RINGAN: minta gaya "simple flat illustration" atau "clean minimalist photo", "plain white or light background", "no clutter, no extra objects" — supaya gambar sederhana, ukuran file kecil, dan cepat dibuat. (6) data-prompt harus deskriptif, konkret, dalam SATU kalimat singkat, dan TANPA teks/tulisan/angka di dalam gambar.`
      : `  - GAMBAR FOTO: JANGAN gunakan tag <img> atau gambar foto sama sekali. Sebagai gantinya sajikan stimulus visual lewat tabel, grafik <svg>, atau deskripsi teks yang jelas.`}
- FORMAT TIAP BENTUK SOAL (WAJIB dipatuhi agar tampilan jawaban benar):
  - Pilihan Ganda (PG): tepat SATU jawaban benar. Sediakan TEPAT ${tkaData.jumlahPilihan} opsi jawaban berlabel huruf. Tulis opsi sebagai <ol type="A"> dengan tiap opsi di <li> (jadi A sampai huruf ke-${tkaData.jumlahPilihan}). Pastikan pengecoh (distraktor) logis. Di bagian D. Kunci Jawaban, tulis HURUF kunci PERSIS sesuai posisi opsi yang isinya benar di bagian C. Soal (hitung ulang urutan A/B/C/... sebelum menulis kunci, JANGAN menebak).
  - Pilihan Ganda Kompleks (PGK): BISA LEBIH DARI SATU jawaban benar. Sediakan TEPAT ${tkaData.jumlahPilihan} opsi/pernyataan. WAJIB awali SETIAP opsi dengan kotak centang "☐ " (karakter U+2610 lalu spasi) agar siswa bisa menandai banyak jawaban. Susun sebagai daftar tanpa nomor, contoh: <ul style="list-style:none;padding-left:0"><li>☐ pernyataan pertama</li><li>☐ pernyataan kedua</li>...</ul>. Beri petunjuk singkat "(Pilih semua jawaban yang benar)". JANGAN gunakan A/B/C/D untuk PGK — karena opsi PGK TIDAK berlabel huruf, di bagian D. Kunci Jawaban WAJIB kutip ULANG teks pernyataan yang benar kata-per-kata persis sama dengan yang tertulis di C. Soal (JANGAN pakai huruf/nomor yang tidak ada).
  - Benar-Salah (BS): sajikan sebagai <table border="1" cellpadding="5"> dengan kolom "Pernyataan", "Benar (☐)", dan "Salah (☐)"; isi sel Benar/Salah dengan "☐".
  - Menjodohkan: gunakan <table border="1" cellpadding="5"> dua kolom (kiri pernyataan bernomor, kanan pilihan jawaban berhuruf yang diacak).
  - Isian Singkat: akhiri kalimat dengan garis isian "_______".
  - Uraian Terbatas: beri instruksi jelas dengan batasan cakupan jawaban yang spesifik (bukan esai bebas), dan sediakan ruang jawaban.

BERIKAN OUTPUT DALAM FORMAT HTML MURNI (tanpa tag <html>, <head>, atau <body>, langsung gunakan tag heading seperti <h2>, <h3>, <p>, <table>, <ul>, <ol>, <b>, dll). Pastikan styling tabel rapi menggunakan atribut HTML border="1" cellpadding="5". Jangan gunakan markdown (\`\`\`).

Format output yang WAJIB dipenuhi:
<h2>A. Identitas Soal</h2>
(tampilkan identitas: mapel, jenjang, kelas, jenis tes, domain kompetensi)
<h2>B. Kisi-kisi Soal</h2>
(Buat tabel kisi-kisi berisi No, Materi, Submateri, Domain Kompetensi, Indikator Soal, Konteks, Level Kognitif, Bentuk Soal, Nomor)
<h2>C. Soal</h2>
(Tampilkan tiap soal lengkap dengan stimulus, pertanyaan, dan pilihan/area jawaban)
<h2>D. Kunci Jawaban</h2>
(WAJIB berupa daftar bernomor "1. ...", "2. ...", dst — SATU baris per nomor soal, PERSIS mengikuti nomor di bagian C, JANGAN pakai tabel/format lain. Untuk PG tulis hurufnya saja mis. "1. B", untuk PGK tulis semua huruf yang benar mis. "2. A, C", untuk Isian Singkat tulis jawabannya mis. "3. 144", untuk Benar-Salah tulis urut sesuai urutan pernyataan mis. "4. Benar, Salah, Benar", untuk Menjodohkan tulis pasangan nomor-huruf mis. "5. 1-C, 2-A, 3-B".)
<h2>E. Pembahasan</h2>
(WAJIB berupa daftar bernomor "1. ...", "2. ...", dst — SATU entri per nomor soal, PERSIS mengikuti nomor di bagian C, penjelasan ringkas 1-2 kalimat.)

PENTING: Output BERHENTI setelah bagian "E. Pembahasan". JANGAN menampilkan proses internal Assessment Engine, JANGAN membuat bagian "Analisis Soal" maupun "Pemeriksaan Kualitas Soal" — validasi/QA dilakukan secara internal saja, bukan bagian output.
`;
  };

  // Jaring pengaman: ubah notasi LaTeX/Markdown matematika yang lolos menjadi HTML terbaca
  // Jaring pengaman: buang bagian "Analisis Soal" & "Pemeriksaan Kualitas Soal" bila AI tetap membuatnya
  const stripUnwantedSections = (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(d.body.children);
    let cut = false;
    for (const node of nodes) {
      if (!cut && /^H[1-3]$/.test(node.tagName) &&
          /analisis soal|pemeriksaan kualitas/i.test(node.textContent || '')) {
        cut = true;
      }
      if (cut) node.remove();
    }
    return d.body.innerHTML;
  };

  const cleanupMath = (s) => {
    let t = s;
    // Hapus delimiter LaTeX
    t = t.replace(/\\\(|\\\)|\\\[|\\\]/g, '');
    // \frac{a}{b} -> (a)/(b) ; \sqrt{a} -> √(a)
    t = t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
    t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
    t = t.replace(/\\text\s*\{([^{}]*)\}/g, '$1');
    // Perintah LaTeX umum -> simbol Unicode
    const map = {
      '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\pm': '±', '\\mp': '∓',
      '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥', '\\neq': '≠', '\\ne': '≠',
      '\\approx': '≈', '\\equiv': '≡', '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α',
      '\\beta': 'β', '\\gamma': 'γ', '\\Delta': 'Δ', '\\sum': '∑', '\\infty': '∞',
      '\\degree': '°', '\\circ': '°', '\\rightarrow': '→', '\\to': '→', '\\left': '', '\\right': '',
    };
    for (const [k, v] of Object.entries(map)) t = t.split(k).join(v);
    // Pangkat & indeks: ^{...}, ^digit, _{...}
    t = t.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    t = t.replace(/\^(-?\d+)/g, '<sup>$1</sup>');
    t = t.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    return t;
  };

  const fetchWithRetry = async (payload, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const endpoint = aiProvider === 'deepseek' ? '/api/generate-deepseek' : '/api/generate';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: apiKeySource === 'bawaan' ? '' : apiKey, payload })
        });

        if (!response.ok) {
          // Ambil pesan error asli dari server/Gemini agar mudah didiagnosa
          let detail = `HTTP ${response.status}`;
          try {
            const errBody = await response.json();
            detail = errBody?.error?.message || errBody?.error || detail;
          } catch { /* body bukan JSON */ }

          // Error konfigurasi (key salah/belum diatur, model tidak ada) tidak perlu diulang
          if (response.status === 400 || response.status === 401 ||
              response.status === 403 || response.status === 404 || response.status === 500) {
            throw new Error(detail);
          }
          throw new Error(detail);
        }
        return await response.json();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  // Kecilkan data URL gambar ke maxWidth lalu encode ulang jadi JPEG ringan.
  const shrinkDataUrl = (dataUrl, maxWidth = 500, quality = 0.75) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Generate gambar dari prompt via proxy /api/image (Pollinations.ai — GRATIS, tanpa API key).
  // Server mengembalikan gambar sebagai data URL (bebas CORS) → dikecilkan → tertanam di preview & Word.
  // Throw bila gagal/timeout agar bisa dihitung & dicoba ulang.
  const generateImage = async (promptText, maxWidth = 500, quality = 0.75) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 58000);
    let response;
    try {
      response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new Error('Timeout/koneksi: sumber gambar terlalu lama merespons.');
    } finally {
      clearTimeout(timer);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || `HTTP ${response.status}`);
    }
    const dataUrl = result?.dataUrl;
    if (!dataUrl) {
      throw new Error('Sumber gambar tidak mengembalikan gambar.');
    }
    return await shrinkDataUrl(dataUrl, maxWidth, quality);
  };

  // Proses semua <img data-prompt> di sebuah HTML. Yang berhasil: data-prompt dihapus.
  // Yang gagal: data-prompt DIPERTAHANKAN supaya bisa dicoba ulang lewat tombol "Muat Ulang Gambar".
  const processImages = async (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.querySelectorAll('img[data-prompt]');
    if (images.length === 0) return { html, failed: 0, errorMsg: '' };

    let failed = 0;
    let errorMsg = '';
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const prompt = img.getAttribute('data-prompt');
      if (!prompt) continue;
      setLoadingStatus(`Menghasilkan Gambar Ilustrasi (${i + 1}/${images.length})...`);
      try {
        const dataUrl = await generateImage(prompt, 500, 0.75);
        img.src = dataUrl;
        img.setAttribute('style', IMG_STYLE);
        img.removeAttribute('data-prompt'); // sukses → tidak akan dicoba ulang
      } catch (err) {
        failed++;
        if (!errorMsg) errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Gagal menghasilkan gambar:', err);
        img.src = placeholderSvg('Gambar gagal — klik "Muat Ulang Gambar"');
        img.setAttribute('style', IMG_STYLE);
        // data-prompt sengaja DIBIARKAN agar bisa dicoba ulang
      }
    }
    return { html: doc.body.innerHTML, failed, errorMsg };
  };

  // Coba ulang HANYA gambar yang gagal, tanpa mengubah soal yang sudah jadi
  const reloadFailedImages = async () => {
    if (!generatedHtml || isGenerating || isReloadingImages) return;
    setIsReloadingImages(true);
    setLoadingStatus('Memuat ulang gambar yang gagal...');
    try {
      const { html, failed, errorMsg } = await processImages(generatedHtml);
      setGeneratedHtml(html);
      setImageFailures(failed);
      setImageError(failed > 0 ? errorMsg : '');
    } finally {
      setIsReloadingImages(false);
      setLoadingStatus('');
    }
  };

  // Ganti penanda <img data-userimg="N"> dengan gambar yang diupload guru untuk soal N
  const applyUserImages = async (html) => {
    if (uploadedImages.length === 0) return html;
    const d = new DOMParser().parseFromString(html, 'text/html');
    const markers = Array.from(d.querySelectorAll('img[data-userimg]'));
    for (const img of markers) {
      const no = img.getAttribute('data-userimg');
      const found = uploadedImages.find((u) => String(u.soalNo) === String(no));
      if (found) {
        const small = await shrinkDataUrl(found.dataUrl, 500, 0.8);
        img.setAttribute('src', small);
        img.setAttribute('style', IMG_STYLE);
        img.setAttribute('class', 'user-stimulus');
        img.removeAttribute('data-userimg');
      } else {
        img.remove();
      }
    }
    return d.body.innerHTML;
  };

  // Logika generate bersama (dipakai AKM & TKA) — beda hanya teks prompt & flag gambar
  // Ubah <img data-prompt="..."> jadi kotak teks deskripsi (untuk digenerate manual di AI gambar lain)
  const convertImageDescriptions = (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('img[data-prompt]').forEach((img) => {
      const promptText = img.getAttribute('data-prompt') || '';
      const box = d.createElement('div');
      box.className = 'image-description';
      box.setAttribute('style', 'border:1px dashed #9ca3af;background:#f9fafb;padding:10px 14px;border-radius:8px;margin:10px 0;font-size:0.9em;color:#374151;');
      box.innerHTML = '🖼️ <strong>Deskripsi Gambar</strong> (salin ke AI generator gambar lain, mis. Midjourney/DALL·E/Ideogram):<br/><em></em>';
      box.querySelector('em').textContent = promptText;
      img.replaceWith(box);
    });
    return d.body.innerHTML;
  };

  // gambarMode: 'tidak' (tanpa gambar) | 'gambar' (auto-generate & tampil) | 'deskripsi' (teks prompt saja)
  // historyMode: 'akm' | 'tka' — menentukan riwayat anti-pengulangan mana yang diperbarui setelah sukses
  const runGeneration = async (promptText, gambarMode, historyMode) => {
    setError('');
    setIsGenerating(true);
    setLoadingStatus('Menyusun Asesmen...');
    setGeneratedHtml('');
    setCbtExportMsg(null);

    // Bangun parts multimodal: teks prompt + gambar yang diupload guru (agar AI "melihat" gambar)
    const parts = [{ text: promptText }];
    for (const u of uploadedImages) {
      const m = /^data:(.+?);base64,(.*)$/.exec(u.dataUrl);
      if (m) {
        parts.push({ text: `\n[Gambar stimulus WAJIB untuk Soal No. ${u.soalNo}]:` });
        parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
      }
    }

    const payload = {
      contents: [{ parts }],
      systemInstruction: {
        parts: [{ text: "Anda adalah sistem pakar asesmen yang menghasilkan output HTML valid, bersih, dan terstruktur tanpa markdown text." }]
      },
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.9
      }
    };

    try {
      const result = await fetchWithRetry(payload);
      let textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Bersihkan jika AI masih membandel memberikan tag markdown html
      textContent = textContent.replace(/```html/gi, '').replace(/```/g, '').trim();
      // Jaring pengaman: ubah sisa notasi LaTeX/Markdown matematika jadi HTML terbaca
      textContent = cleanupMath(textContent);
      // Buang bagian Analisis Soal & Pemeriksaan Kualitas Soal bila masih muncul
      textContent = stripUnwantedSections(textContent);

      // Sisipkan gambar upload guru ke penandanya (selalu, tak terpengaruh opsi gambar AI)
      textContent = await applyUserImages(textContent);

      // Jika opsi gambar AI mati, buang HANYA gambar foto AI (jangan sentuh gambar upload guru)
      if (gambarMode === 'tidak') {
        const d = new DOMParser().parseFromString(textContent, 'text/html');
        d.querySelectorAll('img.generated-image, img[data-prompt]').forEach((im) => im.remove());
        textContent = d.body.innerHTML;
      } else if (gambarMode === 'deskripsi') {
        // Mode deskripsi: JANGAN generate gambar asli — tampilkan teks prompt saja untuk digenerate manual di AI lain
        textContent = convertImageDescriptions(textContent);
      }

      setGeneratedHtml(textContent);
      setImageFailures(0);
      setImageError('');

      // Simpan jejak nama/tempat dari hasil ini agar generate berikutnya (mode yang sama) menghindarinya
      const signature = extractSignature(textContent);
      if (signature) {
        const updateHistory = (prev) => [...prev, signature].slice(-6); // simpan 6 generate terakhir saja
        if (historyMode === 'tka') setTkaHistory(updateHistory);
        else setAkmHistory(updateHistory);
      }

      // Generate gambar asli (Pollinations) hanya bila mode 'gambar'
      if (gambarMode === 'gambar') {
        const { html, failed, errorMsg } = await processImages(textContent);
        setGeneratedHtml(html);
        setImageFailures(failed);
        setImageError(failed > 0 ? errorMsg : '');
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Gagal membuat soal: ${msg}`);
    } finally {
      setIsGenerating(false);
      setLoadingStatus('');
    }
  };

  const handleGenerateAkm = async (e) => {
    e.preventDefault();
    if (apiKeySource === 'custom' && !apiKey) {
      setError(`API Key ${aiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'} belum diisi. Masukkan API Key Anda di kolom paling atas, atau pilih "API Key Bawaan".`);
      return;
    }
    if (aiProvider === 'deepseek' && uploadedImages.length > 0) {
      setError('DeepSeek tidak mendukung analisis gambar. Hapus gambar yang diupload, atau ganti provider ke Gemini di kolom paling atas.');
      return;
    }
    if (!formData.mataPelajaran || !formData.materi) {
      setError('Mohon isi Mata Pelajaran dan Materi terlebih dahulu.');
      return;
    }
    if (getSelectedBentukSoal() === '') {
      setError('Mohon pilih setidaknya satu bentuk soal.');
      return;
    }
    const totalKesulitan = formData.tingkatKesulitan.mudah + formData.tingkatKesulitan.sedang + formData.tingkatKesulitan.sulit;
    if (totalKesulitan !== 100) {
      setError('Total persentase Tingkat Kesulitan harus persis 100%.');
      return;
    }
    await runGeneration(generatePrompt(), formData.sertakanGambar ? 'gambar' : 'tidak', 'akm');
  };

  const handleGenerateTka = async (e) => {
    e.preventDefault();
    if (apiKeySource === 'custom' && !apiKey) {
      setError(`API Key ${aiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'} belum diisi. Masukkan API Key Anda di kolom paling atas, atau pilih "API Key Bawaan".`);
      return;
    }
    if (aiProvider === 'deepseek' && uploadedImages.length > 0) {
      setError('DeepSeek tidak mendukung analisis gambar. Hapus gambar yang diupload, atau ganti provider ke Gemini di kolom paling atas.');
      return;
    }
    if (tkaData.materiKategori.length === 0) {
      setError('Mohon pilih setidaknya satu kategori materi.');
      return;
    }
    if (tkaData.domainKompetensi.length === 0) {
      setError('Mohon pilih setidaknya satu domain kompetensi.');
      return;
    }
    if (getSelectedBentukSoalTka() === '') {
      setError('Mohon pilih setidaknya satu bentuk soal.');
      return;
    }
    const totalKesulitan = tkaData.tingkatKesulitan.mudah + tkaData.tingkatKesulitan.sedang + tkaData.tingkatKesulitan.sulit;
    if (totalKesulitan !== 100) {
      setError('Total persentase Tingkat Kesulitan harus persis 100%.');
      return;
    }
    await runGeneration(generateTkaPrompt(), tkaData.modeGambar, 'tka');
  };

  // Ubah <svg> (grafik) jadi gambar PNG data URL agar bisa tampil di Word
  const svgToPng = (svgEl) => {
    return new Promise((resolve) => {
      try {
        let w = parseFloat(svgEl.getAttribute('width')) || 0;
        let h = parseFloat(svgEl.getAttribute('height')) || 0;
        const vb = (svgEl.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
        if ((!w || !h) && vb.length === 4) { w = w || vb[2]; h = h || vb[3]; }
        w = w || 480; h = h || 300;
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', String(w));
        clone.setAttribute('height', String(h));
        const xml = new XMLSerializer().serializeToString(clone);
        const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        const scale = 2; // 2x untuk hasil cetak tajam
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve({ dataUrl: canvas.toDataURL('image/png'), width: Math.min(Math.round(w), 480) });
          } catch { resolve(null); }
        };
        image.onerror = () => resolve(null);
        image.src = svgUrl;
      } catch { resolve(null); }
    });
  };

  // ===== Turunan CBT dari generatedHtml (bagian C/D/E), dibangun via KODE bukan minta AI menulis
  // ulang semua soal — supaya jumlah soal & tabel/gambar/grafik SELALU cocok dgn yang tampil di
  // preview (tak bergantung pada AI mereproduksi ulang konten yg sama tanpa salah/lupa). =====

  // Ambil elemen-elemen di antara heading suatu bagian (A–F) sampai heading bagian berikutnya.
  // Sengaja toleran: heading bisa h1/h2/h3, dan pemberhentian hanya pada heading yang benar-benar
  // menandai bagian baru ("D. Kunci Jawaban" dst) — supaya <h3>Soal 5</h3> di dalam bagian C tidak
  // ikut memotong bagian itu di tengah jalan.
  const isSectionHeading = (el) => {
    if (!/^H[1-3]$/.test(el.tagName || '')) return false;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    // "Soal 1" / "Soal No. 3" adalah JUDUL SOAL (isi bagian C), bukan judul bagian baru — kalau
    // dianggap judul bagian, bagian C langsung terpotong di soal pertama & semua soal hilang.
    if (/^(soal|nomor)\s*(no\.?\s*)?\d/i.test(t)) return false;
    return /^[A-F][.)]\s/.test(t) || /^(identitas|kisi-kisi|soal|kunci jawaban|pembahasan)\b/i.test(t);
  };

  const getSectionElements = (doc, headingMatch) => {
    const headings = Array.from(doc.querySelectorAll('h1,h2,h3'));
    const startH = headings.find((h) => {
      const t = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(soal|nomor)\s*(no\.?\s*)?\d/i.test(t)) return false;
      return headingMatch.test(t);
    });
    if (!startH) return [];
    const els = [];
    let node = startH.nextElementSibling;
    while (node && !isSectionHeading(node)) { els.push(node); node = node.nextElementSibling; }
    return els;
  };

  // Cocokkan awal entri bernomor, toleran thd variasi AI: "1.", "1)", "Soal 1:", "No. 1 -", dst
  const matchNomorAwal = (text) => {
    const m = text.match(/^(?:soal\s*)?(?:no\.?\s*)?(\d{1,3})\s*[.):\-]\s*(.*)$/i)
      || text.match(/^(?:soal|nomor)\s+(\d{1,3})\b\s*(.*)$/i);
    return m ? { num: parseInt(m[1], 10), sisa: (m[2] || '').trim() } : null;
  };

  // Peta nomor soal -> teks, dipakai utk bagian D (Kunci) & E (Pembahasan). Menangani daftar
  // bernomor (format yang diminta di prompt), <ol> tanpa nomor eksplisit, maupun tabel.
  const extractNumberedTextMap = (elements) => {
    const map = {};
    let currentNum = null;
    const addText = (num, txt) => {
      if (num == null || !txt) return;
      map[num] = map[num] ? `${map[num]} ${txt}` : txt;
    };
    const walk = (els) => {
      els.forEach((el) => {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'table') {
          Array.from(el.querySelectorAll('tr')).forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim());
            if (cells.length < 2) return;
            const num = parseInt(cells[0].replace(/[^\d]/g, ''), 10);
            if (!isNaN(num)) map[num] = cells.slice(1).filter(Boolean).join(' ');
          });
          return;
        }
        // <ol> tanpa nomor tertulis: urutan <li> = nomor soal 1,2,3,...
        if (tag === 'ol') {
          const items = Array.from(el.querySelectorAll(':scope > li'));
          items.forEach((li, idx) => {
            const t = (li.textContent || '').replace(/\s+/g, ' ').trim();
            const nm = matchNomorAwal(t);
            if (nm) { currentNum = nm.num; addText(nm.num, nm.sisa); }
            else { currentNum = idx + 1; addText(idx + 1, t); }
          });
          return;
        }
        if (tag === 'ul' || tag === 'div') { walk(Array.from(el.children)); return; }
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const nm = matchNomorAwal(text);
        if (nm) { currentNum = nm.num; map[nm.num] = nm.sisa; }
        else addText(currentNum, text);
      });
    };
    walk(elements);
    return map;
  };

  // Kumpulkan <img>/<svg> dari sebuah elemen (svg dikonversi ke PNG data URL via svgToPng)
  const collectMediaAsDataUrls = async (el) => {
    const out = [];
    const tag = (el.tagName || '').toLowerCase();
    const imgs = tag === 'img' ? [el] : Array.from(el.querySelectorAll?.('img') || []);
    imgs.forEach((im) => out.push(im.getAttribute('src') || ''));
    const svgs = tag === 'svg' ? [el] : Array.from(el.querySelectorAll?.('svg') || []);
    for (const sv of svgs) {
      const res = await svgToPng(sv);
      if (res?.dataUrl) out.push(res.dataUrl);
    }
    return out.filter(Boolean);
  };

  // Baca bagian "C. Soal" & derive struktur soal (tipe, opsi, tabel, gambar) per nomor asli,
  // lalu gabungkan dgn kunci (bagian D) & pembahasan (bagian E) berdasarkan nomor yang sama.
  // Sengaja dibuat sangat toleran thd variasi format keluaran AI, dan TIDAK membuang soal yang
  // kuncinya gagal terbaca — soal tsb tetap diekspor lalu dilaporkan agar guru bisa perbaiki di Word.
  const deriveCbtSoalFromGeneratedHtml = async (html) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const cEls = getSectionElements(d, /^C[.)]\s*Soal|^Soal\b/i);
    const kunciMap = extractNumberedTextMap(getSectionElements(d, /^D[.)]\s*Kunci|^Kunci Jawaban\b/i));
    const pembahasanMap = extractNumberedTextMap(getSectionElements(d, /^E[.)]\s*Pembahasan|^Pembahasan\b/i));

    const bersihkanPenanda = (t) => (t || '').replace(/^\s*(?:\d{1,2}[.)]|[A-Ea-e][.)]|[-–•])\s*/, '').replace(/\s+/g, ' ').trim();

    const isBsTable = (table) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (!rows.length) return false;
      const head = (rows[0].textContent || '').toLowerCase();
      return head.includes('benar') && head.includes('salah');
    };
    // Tabel Menjodohkan: 2 kolom, kolom kiri pernyataan bernomor & kanan pilihan berhuruf
    const isJodohTable = (table, tanya) => {
      if (!/jodohkan|pasangkan|memasangkan/i.test(tanya || '')) return false;
      const rows = Array.from(table.querySelectorAll('tr'));
      return rows.length >= 2 && rows.every((tr) => tr.querySelectorAll('td,th').length === 2);
    };

    const raw = [];
    let cur = null;
    const pushCur = () => { if (cur) raw.push(cur); };

    for (const el of cEls) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const tag = (el.tagName || '').toLowerCase();
      // Media dikumpulkan utk SEMUA elemen milik soal berjalan (bukan hanya sebelum opsi terbaca) —
      // ini penyebab gambar/grafik sempat hilang saat diletakkan AI setelah daftar opsi.
      const media = await collectMediaAsDataUrls(el);

      const nm = matchNomorAwal(text);
      const looksLikeOption = /^\*?\s*[A-E][.)]\s+/.test(text);
      // Hanya paragraf/heading yang boleh MEMULAI soal baru. Tabel & daftar sering diawali angka
      // ("1. Indonesia" di kolom kiri tabel menjodohkan) — kalau tidak dikecualikan, isi tabel
      // malah dianggap soal baru dan soal aslinya jadi rusak.
      const bisaMulaiSoal = tag !== 'table' && tag !== 'ol' && tag !== 'ul';
      if (nm && !looksLikeOption && bisaMulaiSoal) {
        pushCur();
        cur = { num: nm.num, tanya: nm.sisa, opsi: [], subItem: [], jodohKanan: [], tabel: [], gambar: [...media], tipe: null };
        continue;
      }
      if (!cur) continue;
      cur.gambar.push(...media);

      if (tag === 'ol') {
        const items = Array.from(el.querySelectorAll('li'));
        if (items.length >= 2) {
          cur.tipe = 'PG';
          cur.opsi = items.map((li) => ({ teks: (li.textContent || '').replace(/\s+/g, ' ').trim() }));
        }
        continue;
      }
      if (tag === 'ul') {
        const items = Array.from(el.querySelectorAll('li'));
        if (items.length >= 2) {
          cur.tipe = 'PGK';
          cur.opsi = items.map((li) => ({ teks: (li.textContent || '').replace(/[☐☑]/g, '').replace(/\s+/g, ' ').trim() }));
        }
        continue;
      }
      if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (isBsTable(el)) {
          // Kolom pertama = pernyataan; jawabannya diambil dari bagian D (lihat di bawah)
          cur.tipe = 'BS';
          cur.subItem = rows.slice(1)
            .map((tr) => bersihkanPenanda((tr.querySelector('td,th')?.textContent) || ''))
            .filter(Boolean)
            .map((teks) => ({ teks, jawab: '' }));
          continue;
        }
        if (isJodohTable(el, cur.tanya)) {
          cur.tipe = 'JODOH';
          const body = rows.filter((tr) => {
            const t = (tr.textContent || '').toLowerCase();
            return !(tr.querySelectorAll('th').length && /pernyataan|pilihan|jawaban/.test(t) && tr.querySelectorAll('td').length === 0);
          });
          cur.subItem = body.map((tr) => ({ teks: bersihkanPenanda(tr.children[0]?.textContent || ''), jawab: '' })).filter((it) => it.teks);
          cur.jodohKanan = body.map((tr) => bersihkanPenanda(tr.children[1]?.textContent || '')).filter(Boolean);
          continue;
        }
        cur.tabel.push(el.outerHTML);
        continue;
      }
      // Opsi yang ditulis sbg paragraf biasa ("A. Bandung") — bukan <ol>/<ul>
      if (looksLikeOption) {
        const om = text.match(/^\*?\s*([A-E])[.)]\s+(.*)$/);
        if (om) {
          if (!cur.tipe) cur.tipe = 'PG';
          cur.opsi.push({ teks: (om[2] || '').trim(), huruf: om[1].toUpperCase() });
        }
        continue;
      }
      if (!cur.opsi.length) {
        if (/_{3,}/.test(text)) {
          cur.tipe = 'ISIAN';
          cur.tanya += (cur.tanya ? ' ' : '') + text.replace(/_{3,}/g, '').trim();
        } else if (text) {
          cur.tanya += (cur.tanya ? ' ' : '') + text;
        }
      }
    }
    pushCur();

    return raw.map((s) => {
      const tipe = s.tipe || (s.opsi.length >= 2 ? 'PG' : 'ESSAY');
      const kunciRaw = (kunciMap[s.num] || '').trim();
      const soal = {
        nomorAsli: String(s.num),
        tipe,
        tanya: s.tanya.trim(),
        opsi: [],
        subItem: [],
        kunciIsian: [],
        pembahasan: (pembahasanMap[s.num] || '').trim(),
        gambar: s.gambar.filter(Boolean),
        tabel: s.tabel,
        errors: [],
        valid: false,
        kunciTidakTerbaca: false,
      };
      if (tipe === 'PG' || tipe === 'PGK') {
        // Kunci bisa berupa huruf ("B", "A dan C") ATAU teks jawaban yang dikutip ulang.
        const letters = Array.from(kunciRaw.toUpperCase().matchAll(/(?:^|[^A-Z])([A-E])(?![A-Z])/g)).map((mm) => mm[1]);
        const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
        const kunciNorm = normalize(kunciRaw);
        soal.opsi = s.opsi.map((o, idx) => {
          const huruf = o.huruf || String.fromCharCode(65 + idx);
          const byLetter = letters.includes(huruf);
          const byText = kunciNorm.length > 2 && normalize(o.teks).length > 2 && kunciNorm.includes(normalize(o.teks));
          return { teks: o.teks, benar: byLetter || byText };
        });
        const jmlBenar = soal.opsi.filter((o) => o.benar).length;
        if (tipe === 'PG' && jmlBenar !== 1) soal.kunciTidakTerbaca = true;
        if (tipe === 'PGK' && jmlBenar < 1) soal.kunciTidakTerbaca = true;
      } else if (tipe === 'ISIAN') {
        const bersih = kunciRaw.replace(/\(.*?\)/g, '').trim();
        soal.kunciIsian = bersih ? [bersih] : [];
        if (!bersih) soal.kunciTidakTerbaca = true;
      } else if (tipe === 'BS') {
        // Kunci BS di bagian D biasanya berurutan: "1) Benar, 2) Salah, 3) Benar" atau "B, S, B"
        const tokens = Array.from(kunciRaw.matchAll(/\b(benar|salah|true|false|[BS])\b/gi))
          .map((mm) => (/^(benar|true|B)$/i.test(mm[1]) ? 'BENAR' : 'SALAH'));
        soal.subItem = s.subItem.map((it, idx) => ({ teks: it.teks, jawab: tokens[idx] || '' }));
        if (tokens.length < s.subItem.length) soal.kunciTidakTerbaca = true;
      } else if (tipe === 'JODOH') {
        // Kunci Menjodohkan di bagian D biasanya "1-C, 2-A, 3-B" (nomor kiri -> huruf kolom kanan)
        const pairs = Array.from(kunciRaw.matchAll(/(\d{1,2})\s*[-–—:=]\s*([A-Ea-e])/g))
          .map((mm) => ({ kiri: parseInt(mm[1], 10), kanan: mm[2].toUpperCase().charCodeAt(0) - 65 }));
        soal.subItem = s.subItem.map((it, idx) => {
          const p = pairs.find((pp) => pp.kiri === idx + 1);
          const jawab = p && s.jodohKanan[p.kanan] ? s.jodohKanan[p.kanan] : '';
          return { teks: it.teks, jawab };
        });
        if (soal.subItem.some((it) => !it.jawab)) soal.kunciTidakTerbaca = true;
      }
      const validated = validateSoal(soal);
      validated.kunciTidakTerbaca = soal.kunciTidakTerbaca;
      return validated;
    });
  };

  // Ubah data URL gambar (base64) jadi bytes mentah utk ImageRun (docx)
  const dataUrlToImageBytes = (dataUrl) => {
    const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUrl || '');
    if (!m) return null;
    const type = /jpe?g/i.test(m[1]) ? 'jpg' : 'png';
    const bin = atob(m[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type };
  };

  // Ukuran asli gambar (dari data URL) — dipakai utk skala proporsional saat ditanam di docx
  const getImageDimensions = (dataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = dataUrl;
  });

  const exportToWord = async () => {
    if (!generatedHtml) return;

    const doc = new DOMParser().parseFromString(generatedHtml, 'text/html');

    // 1) Grafik SVG → gambar PNG (Word tidak bisa render SVG inline)
    const svgs = Array.from(doc.querySelectorAll('svg'));
    for (const svg of svgs) {
      const res = await svgToPng(svg);
      if (res && res.dataUrl) {
        const im = doc.createElement('img');
        im.setAttribute('src', res.dataUrl);
        im.setAttribute('width', String(res.width));
        im.setAttribute('style', 'max-width:480px;height:auto;');
        svg.replaceWith(im);
      }
    }

    // 2) Kumpulkan gambar base64 jadi bagian MHTML terpisah (agar tertanam & tampil di Word)
    const parts = [];
    let idx = 0;
    Array.from(doc.querySelectorAll('img')).forEach((img) => {
      const src = img.getAttribute('src') || '';
      const m = src.match(/^data:(image\/(png|jpeg|jpg|gif|bmp));base64,([\s\S]+)$/i);
      if (m) {
        idx++;
        const sub = m[2].toLowerCase();
        const ext = sub === 'jpeg' ? 'jpg' : sub;
        const name = `image${String(idx).padStart(3, '0')}.${ext}`;
        parts.push({ name, mime: m[1], b64: m[3].replace(/\s+/g, '') });
        img.setAttribute('src', name);
      }
    });

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Perangkat Soal</title><style>body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; } h2 { font-size: 14pt; color: #333; margin-top: 20px; } h3 { font-size: 12pt; } table { border-collapse: collapse; width: 100%; margin-bottom: 15px; } table, th, td { border: 1px solid black; } th, td { padding: 8px; text-align: left; } th { background-color: #f2f2f2; } p { line-height: 1.5; } img { max-width: 400px; height: auto; }</style></head><body>`;
    const footer = '</body></html>';
    const sourceHTML = header + doc.body.innerHTML + footer;

    const activeData = mode === 'tka' ? tkaData : formData;
    const safeName = (activeData.mataPelajaran || 'Soal').replace(/\s+/g, '_');
    const fileName = `Perangkat_Soal_${safeName}_Kls${activeData.kelas}.doc`;

    let blob;
    if (parts.length === 0) {
      // Tidak ada gambar → HTML biasa cukup
      blob = new Blob(['﻿', sourceHTML], { type: 'application/msword' });
    } else {
      // Bangun MHTML (Web Archive) supaya gambar benar-benar tertanam di Word
      const boundary = '----=_NextPart_' + Date.now().toString(36);
      const wrap = (s) => s.replace(/(.{76})/g, '$1\r\n');
      const utf8ToBase64 = (str) => btoa(unescape(encodeURIComponent(str)));

      let mht = 'MIME-Version: 1.0\r\n';
      mht += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
      mht += `--${boundary}\r\n`;
      mht += 'Content-Type: text/html; charset="utf-8"\r\n';
      mht += 'Content-Transfer-Encoding: base64\r\n\r\n';
      mht += wrap(utf8ToBase64(sourceHTML)) + '\r\n';
      for (const p of parts) {
        mht += `--${boundary}\r\n`;
        mht += `Content-Type: ${p.mime}\r\n`;
        mht += 'Content-Transfer-Encoding: base64\r\n';
        mht += `Content-Location: ${p.name}\r\n\r\n`;
        mht += wrap(p.b64) + '\r\n';
      }
      mht += `--${boundary}--\r\n`;
      blob = new Blob([mht], { type: 'application/msword' });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Ubah outerHTML tabel (dari bagian C) jadi Table docx sungguhan
  const htmlTableToDocxTable = (tableHtml) => {
    const d = new DOMParser().parseFromString(tableHtml, 'text/html');
    const table = d.querySelector('table');
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tr')).map((tr) => new TableRow({
      children: Array.from(tr.querySelectorAll('td,th')).map((cell) => new TableCell({
        children: [new Paragraph((cell.textContent || '').trim())],
      })),
    }));
    return rows.length ? new Table({ rows }) : null;
  };

  // Sisipkan Paragraph gambar (data URL) ke array `children` docx, dilewati kalau bukan base64 valid
  const pushImageParagraph = async (children, dataUrl) => {
    const parsedImg = dataUrlToImageBytes(dataUrl);
    if (!parsedImg) return false;
    const dim = await getImageDimensions(dataUrl);
    const maxW = 400;
    const scale = dim.width > maxW ? maxW / dim.width : 1;
    children.push(new Paragraph({
      children: [new ImageRun({
        data: parsedImg.bytes,
        type: parsedImg.type,
        transformation: { width: Math.round(dim.width * scale), height: Math.round(dim.height * scale) },
      })],
    }));
    return true;
  };

  // Ekspor hasil generate AKM/TKA jadi file .docx yang mengikuti konvensi naskah Word Generator CBT.
  // Soal, opsi, kunci, gambar, dan tabel diturunkan langsung dari generatedHtml (bagian C/D/E) via
  // kode — bukan minta AI menulis ulang — supaya jumlah & isinya selalu cocok dgn yang tampil di preview.
  const handleExportCbtWord = async () => {
    if (!generatedHtml) return;
    // SEMUA soal ikut diekspor (termasuk yang kuncinya gagal terbaca) supaya jumlahnya tidak
    // berkurang diam-diam — nomor yang bermasalah dilaporkan agar guru bisa perbaiki di Word.
    const exported = await deriveCbtSoalFromGeneratedHtml(generatedHtml);

    let gambarCount = 0;
    const children = [];
    for (const s of exported) {
      children.push(new Paragraph(`${s.nomorAsli}. [${s.tipe}] ${s.tanya}`));
      for (const src of s.gambar) {
        if (await pushImageParagraph(children, src)) gambarCount++;
      }
      for (const tableHtml of s.tabel) {
        const table = htmlTableToDocxTable(tableHtml);
        if (table) children.push(table);
      }
      if (s.tipe === 'PG' || s.tipe === 'PGK') {
        s.opsi.forEach((o, idx) => {
          children.push(new Paragraph(`${o.benar ? '*' : ''}${String.fromCharCode(65 + idx)}. ${o.teks}`));
        });
      } else if (s.tipe === 'ISIAN') {
        children.push(new Paragraph(`Kunci: ${s.kunciIsian.join(' | ')}`));
      } else if (s.tipe === 'BS' || s.tipe === 'JODOH') {
        s.subItem.forEach((it) => children.push(new Paragraph(`- ${it.teks} | ${it.jawab}`)));
      }
      if (s.pembahasan) children.push(new Paragraph(`Pembahasan: ${s.pembahasan}`));
      children.push(new Paragraph(''));
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const safeName = (mode === 'tka' ? tkaData.mataPelajaran : formData.mataPelajaran || 'soal').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `soal-cbt-${safeName || 'soal'}.docx`;
    a.click();

    const perluCek = exported.filter((s) => s.kunciTidakTerbaca).map((s) => s.nomorAsli);
    const gambarNote = gambarCount > 0 ? ` (${gambarCount} gambar/grafik ikut disalin)` : '';

    if (exported.length === 0) {
      setCbtExportMsg({ type: 'bad', text: `File terunduh, tapi tidak ada soal terbaca dari hasil generate. Coba generate ulang, atau susun naskah manual dengan template Generator CBT.` });
    } else if (perluCek.length) {
      setCbtExportMsg({ type: 'warn', text: `File terunduh${gambarNote}: ${exported.length} soal. Kunci soal nomor ${perluCek.join(', ')} tidak terbaca otomatis — lengkapi kuncinya di Word (tanda * pada opsi benar, atau isi setelah tanda "|") sebelum diupload.` });
    } else {
      setCbtExportMsg({ type: 'ok', text: `File terunduh${gambarNote}: ${exported.length} soal siap diupload langsung ke Generator CBT.` });
    }
  };

  // Panel Preview (kanan) — dipakai bersama oleh Generator AKM & Generator TKA
  const previewPanel = (
    <div className="lg:col-span-8 flex flex-col">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-lg font-semibold text-gray-900">Preview Perangkat Soal</h2>

          <div className="flex items-center gap-2">
            {imageFailures > 0 && (
              <button
                onClick={reloadFailedImages}
                disabled={isGenerating || isReloadingImages}
                title="Coba buat ulang gambar yang gagal, tanpa mengubah soal"
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
                  isGenerating || isReloadingImages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isReloadingImages ? 'animate-spin' : ''}>
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M8 16H3v5"/>
                </svg>
                {isReloadingImages ? 'Memuat...' : `Muat Ulang Gambar (${imageFailures})`}
              </button>
            )}

            <button
              onClick={exportToWord}
              disabled={!generatedHtml || isGenerating}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
                !generatedHtml || isGenerating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              Download Word
            </button>

            <button
              onClick={handleExportCbtWord}
              disabled={!generatedHtml || isGenerating}
              title="Ekspor soal ini jadi file .docx yang bisa langsung diupload ke mode Generator CBT"
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
                !generatedHtml || isGenerating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="4" width="19" height="13" rx="2"/>
                <path d="M7 21h10M12 17v4"/>
                <path d="M7 12.2l2.8-2.8 2 2L17 6"/>
              </svg>
              Ekspor Word (Format CBT)
            </button>
          </div>
        </div>

        {cbtExportMsg && (
          <div
            className={`mb-3 px-3 py-2 rounded-xl border text-sm font-medium ${
              cbtExportMsg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : cbtExportMsg.type === 'bad'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {cbtExportMsg.text}
          </div>
        )}

        {imageFailures > 0 && (
          <div className="mb-3 p-3 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200">
            ⚠️ {imageFailures} gambar gagal dibuat. Soal tetap aman — klik <b>Muat Ulang Gambar</b> untuk mencoba lagi.
            {imageError && (
              <div className="mt-2 text-xs text-amber-900 bg-amber-100 rounded-lg p-2 break-words">
                Detail: {imageError}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 p-4 md:p-8 overflow-y-auto" style={{ minHeight: '500px', maxHeight: '800px' }}>
          {isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="animate-pulse">{loadingStatus}</p>
            </div>
          ) : generatedHtml ? (
            <div
              ref={resultRef}
              className="prose prose-sm md:prose-base max-w-none text-gray-800 document-preview"
              dangerouslySetInnerHTML={{ __html: generatedHtml }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" x2="8" y1="13" y2="13"/>
                <line x1="16" x2="8" y1="17" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p>Isi formulir di sebelah kiri dan klik "Generate Soal"</p>
            </div>
          )}
        </div>

        {/* Custom CSS for the injected HTML to make it look like a document */}
        <style dangerouslySetInnerHTML={{__html: `
          .document-preview h2 { font-size: 1.25rem; font-weight: 700; color: #1f2937; margin-top: 1.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
          .document-preview h3 { font-size: 1.1rem; font-weight: 600; color: #374151; margin-top: 1rem; margin-bottom: 0.5rem; }
          .document-preview p { margin-bottom: 0.75rem; line-height: 1.6; }
          .document-preview ul, .document-preview ol { margin-left: 1.5rem; margin-bottom: 1rem; list-style-position: outside; }
          .document-preview ul { list-style-type: disc; }
          .document-preview ol { list-style-type: decimal; }
          .document-preview table { width: 100%; border-collapse: collapse; margin-top: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem; }
          .document-preview th, .document-preview td { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
          .document-preview th { background-color: #f3f4f6; font-weight: 600; }
          .document-preview strong { font-weight: 600; }
          .document-preview img { max-width: 400px; width: 100%; height: auto; display: block; border-radius: 8px; margin: 10px 0; }
          .document-preview svg { max-width: 100%; height: auto; display: block; margin: 12px 0; }
        `}} />

      </div>
    </div>
  );

  // Panel Form Generator TKA (kiri)
  const tkaFormPanel = (
    <div className="lg:col-span-4 space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Konfigurasi Soal TKA</h2>

        <form onSubmit={handleGenerateTka} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran</label>
            <select
              name="mataPelajaran"
              value={tkaData.mataPelajaran}
              onChange={handleTkaInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {TKA_SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan / Jenis Tes</label>
            <select
              name="tipeTes"
              value={tkaData.tipeTes}
              onChange={handleTkaInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option>Latihan TKA</option>
              <option>Simulasi TKA</option>
              <option>Try Out TKA</option>
              <option>Pemetaan Kompetensi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
            <select
              name="jenjang"
              value={tkaData.jenjang}
              onChange={handleTkaInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="SD">SD (kelas 6 — akhir jenjang)</option>
              <option value="SMP">SMP (kelas 9 — akhir jenjang)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">TKA selalu di akhir jenjang, jadi tidak perlu pilih kelas/semester.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Domain Kompetensi (boleh lebih dari satu)</label>
            <div className="grid grid-cols-1 gap-1.5">
              {TKA_KOMPETENSI[tkaData.mataPelajaran].map((d) => (
                <label key={d} className="flex items-start space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={tkaData.domainKompetensi.includes(d)}
                    onChange={() => toggleTkaDomain(d)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Materi (boleh lebih dari satu)</label>
            <div className="space-y-2">
              {(TKA_MATERI_KATEGORI[tkaData.mataPelajaran]?.[tkaData.jenjang] || []).map((kat) => (
                <label key={kat.id} className="flex items-start space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={tkaData.materiKategori.includes(kat.id)}
                    onChange={() => toggleTkaMateriKategori(kat.id)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{kat.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Submateri spesifik dipilih otomatis oleh AI sesuai kategori yang dicentang.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konteks Stimulus (Bank Konteks)</label>
            <select
              name="konteks"
              value={tkaData.konteks}
              onChange={handleTkaInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {TKA_KONTEKS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal</label>
              <input
                type="number"
                name="jumlahSoal"
                min="1"
                max="50"
                value={tkaData.jumlahSoal}
                onChange={handleTkaInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pilihan Jawaban</label>
              <select
                name="jumlahPilihan"
                value={tkaData.jumlahPilihan}
                onChange={handleTkaInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="2">2 opsi (A–B)</option>
                <option value="3">3 opsi (A–C)</option>
                <option value="4">4 opsi (A–D)</option>
                <option value="5">5 opsi (A–E)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">*Maks 50 soal. Disarankan ≤15 per generate. Jumlah pilihan berlaku untuk PG & PG Kompleks.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat Kesulitan (%)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-xs text-gray-500">Mudah</span>
                <input
                  type="number"
                  name="mudah"
                  min="0"
                  max="100"
                  value={tkaData.tingkatKesulitan.mudah}
                  onChange={handleTkaDifficultyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500">Sedang</span>
                <input
                  type="number"
                  name="sedang"
                  min="0"
                  max="100"
                  value={tkaData.tingkatKesulitan.sedang}
                  onChange={handleTkaDifficultyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500">Sulit</span>
                <input
                  type="number"
                  name="sulit"
                  min="0"
                  max="100"
                  value={tkaData.tingkatKesulitan.sulit}
                  onChange={handleTkaDifficultyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            {(() => {
              const total = tkaData.tingkatKesulitan.mudah + tkaData.tingkatKesulitan.sedang + tkaData.tingkatKesulitan.sulit;
              return (
                <p className={`text-xs mt-1 font-medium ${total !== 100 ? 'text-red-500' : 'text-green-600'}`}>
                  Total: {total}% {total !== 100 && '(Pastikan total mencapai 100%)'}
                </p>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bentuk Soal</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(tkaData.bentukSoal).map((key) => (
                <label key={key} className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name={key}
                    checked={tkaData.bentukSoal[key]}
                    onChange={handleTkaInputChange}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    {key === 'pg' && 'Pilihan Ganda'}
                    {key === 'pgk' && 'PG Kompleks'}
                    {key === 'menjodohkan' && 'Menjodohkan'}
                    {key === 'bs' && 'Benar-Salah'}
                    {key === 'isian' && 'Isian Singkat'}
                    {key === 'uraian' && 'Uraian'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Gambar Ilustrasi Soal</label>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="modeGambar"
                  value="tidak"
                  checked={tkaData.modeGambar === 'tidak'}
                  onChange={handleTkaInputChange}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="font-medium">Tanpa gambar</span>
                  <span className="block text-xs text-gray-500">Default. Stimulus tetap kaya lewat tabel, grafik, dan deskripsi.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="modeGambar"
                  value="gambar"
                  checked={tkaData.modeGambar === 'gambar'}
                  onChange={handleTkaInputChange}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="font-medium">Gambar (auto-generate & tampil)</span>
                  <span className="block text-xs text-gray-500">Gambar AI gratis dibuat & langsung tampil di dokumen. Kadang kurang akurat.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="modeGambar"
                  value="deskripsi"
                  checked={tkaData.modeGambar === 'deskripsi'}
                  onChange={handleTkaInputChange}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="font-medium">Hanya deskripsi gambar</span>
                  <span className="block text-xs text-gray-500">Tanpa gambar asli — tampil teks deskripsi untuk digenerate manual di AI gambar lain (Midjourney/DALL·E/dll).</span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar Soal (stimulus manual)</label>
            <p className="text-xs text-gray-500 mb-2">Upload gambar dan tentukan nomor soalnya. AI akan "melihat" gambar dan membuat soal pada nomor itu berdasarkan gambar tersebut.</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {uploadedImages.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedImages.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <img src={u.dataUrl} alt="stimulus" className="w-12 h-12 object-cover rounded-md border border-gray-200" />
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-600">Soal No.</span>
                      <input
                        type="number"
                        min="1"
                        value={u.soalNo}
                        onChange={(e) => updateImageSoalNo(u.id, e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(u.id)}
                      className="ml-auto text-red-500 hover:text-red-700 text-sm px-2"
                      title="Hapus gambar"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className={`w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
              isGenerating ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingStatus}
              </>
            ) : (
              'Generate Soal'
            )}
          </button>
        </form>
      </div>
    </div>
  );

  const cbtFormPanel = (
    <div className="lg:col-span-4 space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">1. Upload Naskah Soal (.docx)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Soal harus ditulis mengikuti format penanda.{' '}
          <a href="/template-soal-cbt.docx" className="text-emerald-600 underline">Unduh contoh template Word</a> supaya formatnya pasti terbaca benar.
        </p>

        <label
          className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-all ${
            cbtDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setCbtDragActive(true); }}
          onDragLeave={() => setCbtDragActive(false)}
          onDrop={handleCbtDrop}
        >
          <input
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleCbtFile(e.target.files[0]); }}
          />
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 mb-2">
            <path d="M12 15V3M12 15L8.5 11.5M12 15L15.5 11.5" />
            <path d="M4 15V18.5C4 19.8807 5.11929 21 6.5 21H17.5C18.8807 21 20 19.8807 20 18.5V15" />
          </svg>
          <div className="text-sm font-semibold text-gray-800">Klik atau seret file .docx ke sini</div>
          <div className="text-xs text-gray-500 mt-1">Format Word (.docx) — maks. 1 file</div>
          {cbtFileName && <div className="text-xs font-semibold text-emerald-700 mt-2">{cbtFileName}</div>}
        </label>

        {cbtParseMsg && (
          <div
            className={`text-sm mt-3 px-3 py-2 rounded-xl border font-medium ${
              cbtParseMsg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : cbtParseMsg.type === 'bad'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {cbtParseMsg.text}
          </div>
        )}

        <details className="mt-3">
          <summary className="text-sm font-semibold text-emerald-700 cursor-pointer">Lihat format penanda yang dikenali</summary>
          <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-3 mt-2 overflow-x-auto whitespace-pre-wrap">{`1. [PG] Ibu kota Indonesia adalah ...
A. Bandung
*B. Jakarta
C. Surabaya
D. Medan
Pembahasan: Jakarta adalah ibu kota Indonesia.

2. [PGK] Berikut ini bilangan prima adalah ...
*A. 2
B. 4
*C. 5
D. 6

3. [ISIAN] Hasil dari 12 x 12 adalah ...
Kunci: 144

4. [BS] Tentukan Benar atau Salah.
- Air membeku pada suhu 0°C | BENAR
- Matahari mengelilingi Bumi | SALAH

5. [JODOH] Pasangkan negara dengan ibu kotanya.
- Indonesia | Jakarta
- Jepang | Tokyo

6. [ESSAY] Jelaskan proses terjadinya hujan!`}</pre>
          <p className="text-xs text-gray-500 mt-2">
            Tanda "*" di depan huruf opsi menandai jawaban benar. "Kunci:" untuk isian bisa punya beberapa jawaban diterima, dipisah "|". Untuk BS (Benar-Salah) &amp; JODOH (Menjodohkan), tiap baris ditulis "pernyataan | jawaban". "Pembahasan:" opsional. Gambar &amp; tabel yang disisipkan di Word ikut terbawa otomatis. ESSAY dinilai manual oleh guru (tidak masuk skor otomatis).
          </p>
        </details>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">2. Pengaturan Ujian</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Judul Ujian</label>
            <input
              type="text"
              name="judul"
              value={cbtConfig.judul}
              onChange={handleCbtConfigChange}
              placeholder="Ulangan Harian IPA — Bab 3"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label>
              <input
                type="number"
                name="durasiMenit"
                min="1"
                value={cbtConfig.durasiMenit}
                onChange={handleCbtConfigChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sekolah/Guru (opsional)</label>
              <input
                type="text"
                name="instansi"
                value={cbtConfig.instansi}
                onChange={handleCbtConfigChange}
                placeholder="SDN Contoh 01"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="acakSoal" checked={cbtConfig.acakSoal} onChange={handleCbtConfigChange} className="rounded text-emerald-600 focus:ring-emerald-500" />
            Acak urutan soal untuk tiap siswa
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="acakOpsi" checked={cbtConfig.acakOpsi} onChange={handleCbtConfigChange} className="rounded text-emerald-600 focus:ring-emerald-500" />
            Acak urutan opsi jawaban (PG/PGK)
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Apps Script (opsional)</label>
            <input
              type="url"
              name="scriptUrl"
              value={cbtConfig.scriptUrl}
              onChange={handleCbtConfigChange}
              placeholder="https://script.google.com/macros/s/xxx/exec"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Untuk simpan hasil siswa otomatis ke Google Sheet. Kosongkan jika belum ada — siswa tetap bisa unduh bukti hasil manual. Lihat{' '}
              <a href="/cbt-apps-script.gs.txt" className="text-emerald-600 underline">kode backend</a> & panduan pemasangannya.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">3. Generate Aplikasi CBT</h2>
        <p className="text-xs text-gray-500 mb-3">File HTML hasil generate bersifat mandiri (satu file, offline) — tinggal dibagikan/diunggah untuk dikerjakan siswa.</p>
        <button
          type="button"
          onClick={handleCbtGenerate}
          disabled={cbtSoal.filter((s) => s.valid).length === 0}
          className={`w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
            cbtSoal.filter((s) => s.valid).length === 0 ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3V15M12 15L8.5 11.5M12 15L15.5 11.5" />
            <path d="M4 17V18.5C4 19.8807 5.11929 21 6.5 21H17.5C18.8807 21 20 19.8807 20 18.5V17" />
          </svg>
          Generate & Unduh CBT.html
        </button>
        {cbtGenMsg && (
          <div className="text-sm mt-3 px-3 py-2 rounded-xl border font-medium bg-emerald-50 text-emerald-700 border-emerald-200">{cbtGenMsg}</div>
        )}
      </div>
    </div>
  );

  const cbtPreviewPanel = (
    <div className="lg:col-span-8 flex flex-col">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-lg font-semibold text-gray-900">Pratinjau Soal Terparsing</h2>
          {cbtSoal.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                cbtSoal.reduce((acc: Record<string, number>, s) => { acc[s.tipe] = (acc[s.tipe] || 0) + 1; return acc; }, {})
              ).map(([tipe, n]) => (
                <span key={tipe} className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{tipe} &times; {n}</span>
              ))}
            </div>
          )}
        </div>

        {cbtSoal.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada file diupload.</p>
        ) : (
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {cbtSoal.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 text-sm bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    #{i + 1} &middot; {s.tipe}
                  </span>
                </div>
                <div className="text-gray-800 mb-1.5">{s.tanya}</div>
                {s.gambar && s.gambar.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {s.gambar.map((src, gi) => (
                      <img key={gi} src={src} alt="Gambar soal" className="max-w-full rounded-lg" />
                    ))}
                  </div>
                )}
                {s.tabel && s.tabel.length > 0 && (
                  <div className="mb-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: s.tabel.join('') }} />
                )}
                {(s.tipe === 'PG' || s.tipe === 'PGK') && (
                  <div className="space-y-0.5">
                    {s.opsi.map((o, idx) => (
                      <div key={idx} className={o.benar ? 'text-emerald-700 font-semibold pl-3' : 'text-gray-500 pl-3'}>
                        {String.fromCharCode(65 + idx)}. {o.teks}{o.benar ? ' ✓' : ''}
                      </div>
                    ))}
                  </div>
                )}
                {s.tipe === 'ISIAN' && (
                  <div className="text-emerald-700 font-semibold text-xs">Kunci: {s.kunciIsian.join(' | ')}</div>
                )}
                {(s.tipe === 'BS' || s.tipe === 'JODOH') && (
                  <div className="space-y-0.5">
                    {s.subItem.map((it, idx) => (
                      <div key={idx} className="text-gray-600 pl-3">
                        {idx + 1}. {it.teks} <span className="text-emerald-700 font-semibold">→ {it.jawab || '(kunci kosong)'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.tipe === 'ESSAY' && <div className="text-gray-500 text-xs">Dinilai manual oleh guru</div>}
                {!s.valid && <div className="text-red-600 text-xs mt-1 font-medium">{s.errors.join(' ')}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex items-center gap-4">
          <img src="/logo-si-gatot.png" alt="Si Gatot" className="w-14 h-14 rounded-full shadow-inner object-cover flex-none" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Si Gatot <span className="text-gray-400 font-medium text-base">— Sistem Generator Tes Otomatis</span></h1>
            <p className="text-gray-500 text-sm">
              {mode === 'akm' && 'Generator AKM — Literasi Numerasi, Kurikulum Merdeka semua Fase (A–F)'}
              {mode === 'tka' && 'Generator TKA — Tes Kemampuan Akademik, jenjang SD & SMP'}
              {mode === 'cbt' && 'Generator CBT — Upload naskah soal Word, jadi aplikasi ujian CBT HTML siap pakai'}
              {mode === null && 'Pilih jenis generator soal di bawah untuk mulai'}
            </p>
          </div>
          {mode !== null && (
            <button
              type="button"
              onClick={() => switchMode(null)}
              className="px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap"
            >
              ← Ganti Generator
            </button>
          )}
        </div>

        {(mode === 'akm' || mode === 'tka') && (
          <div className={`rounded-xl border p-3 bg-white shadow-sm ${apiKeySource === 'custom' && !apiKey ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider AI (Teks)</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="aiProviderRadio"
                  checked={aiProvider === 'gemini'}
                  onChange={() => handleAiProviderChange('gemini')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Gemini (utama, dukung upload gambar)
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="aiProviderRadio"
                  checked={aiProvider === 'deepseek'}
                  onChange={() => handleAiProviderChange('deepseek')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                DeepSeek (cadangan, teks saja)
              </label>
            </div>
            {aiProvider === 'deepseek' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                ⚠️ DeepSeek tidak bisa menganalisis gambar — fitur <b>Upload Gambar Soal</b> tidak akan berfungsi selama provider ini dipilih. Batas keluaran juga lebih pendek dari Gemini (cocok untuk ±10-15 soal per generate).
              </p>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">Sumber API Key {aiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'}</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="apiKeySourceRadio"
                  checked={apiKeySource === 'bawaan'}
                  onChange={() => handleApiKeySourceChange('bawaan')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                API Key Bawaan (Server)
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="apiKeySourceRadio"
                  checked={apiKeySource === 'custom'}
                  onChange={() => handleApiKeySourceChange('custom')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                API Key Sendiri (Custom)
              </label>
            </div>

            {apiKeySource === 'bawaan' ? (
              <p className="text-xs text-gray-500">
                Memakai key yang diset di server (env var <code className="bg-gray-100 px-1 rounded">{aiProvider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GEMINI_API_KEY'}</code> pada Vercel). Jika belum diset, generate akan gagal — set dulu di Vercel → Settings → Environment Variables, lalu redeploy.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder={`Tempel API Key ${aiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'} Anda di sini`}
                    autoComplete="off"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    {showKey ? 'Sembunyi' : 'Lihat'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {!apiKey && <span className="text-amber-600 font-medium">(wajib diisi) </span>}
                  Tersimpan di browser Anda (tidak dibagikan). Dapatkan {aiProvider === 'deepseek' ? (
                    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-blue-600 underline">di platform.deepseek.com/api_keys</a>
                  ) : (
                    <>gratis di{' '}<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline">aistudio.google.com/app/apikey</a></>
                  )}.
                </p>
              </>
            )}
          </div>
        )}

        {mode === null && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => switchMode('akm')}
              className="text-left bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mb-3">A</div>
              <h3 className="text-lg font-semibold text-gray-900">Generator AKM</h3>
              <p className="text-sm text-gray-500 mt-1">Soal Literasi & Numerasi berbasis Kurikulum Merdeka, semua Fase (A–F, SD-SMA/SMK). Fleksibel untuk semua mapel dan keperluan tes.</p>
            </button>
            <button
              type="button"
              onClick={() => switchMode('tka')}
              className="text-left bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:border-purple-400 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mb-3">T</div>
              <h3 className="text-lg font-semibold text-gray-900">Generator TKA</h3>
              <p className="text-sm text-gray-500 mt-1">Soal Tes Kemampuan Akademik (TKA Assessment Engine) — Matematika, Bahasa Indonesia, Bahasa Inggris, IPA — jenjang SD & SMP, berbasis kerangka domain kompetensi & Bank Konteks.</p>
            </button>
            <button
              type="button"
              onClick={() => switchMode('cbt')}
              className="text-left bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100 hover:border-emerald-400 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-xl mb-3">C</div>
              <h3 className="text-lg font-semibold text-gray-900">Generator CBT</h3>
              <p className="text-sm text-gray-500 mt-1">Sudah punya naskah soal di Word? Upload di sini, langsung jadi aplikasi ujian CBT HTML siap dikerjakan siswa — tanpa AI, tanpa server.</p>
            </button>
          </div>
        )}

        {mode === 'akm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Form Input Container */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Konfigurasi Soal AKM</h2>

              <form onSubmit={handleGenerateAkm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    name="mataPelajaran"
                    value={formData.mataPelajaran}
                    onChange={handleInputChange}
                    placeholder="Contoh: IPA, Bahasa Indonesia, Matematika"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keperluan / Jenis Tes</label>
                  <select
                    name="tipeTes"
                    value={formData.tipeTes}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>Ulangan Harian</option>
                    <option>Penilaian Tengah Semester (PTS/STS)</option>
                    <option>Penilaian Akhir Semester (PAS/SAS)</option>
                    <option>Asesmen Sumatif</option>
                    <option>Asesmen Formatif</option>
                    <option>Latihan Soal</option>
                    <option>Kuis</option>
                    <option>AKM / ANBK</option>
                    <option>Ujian Sekolah</option>
                    <option>Remedial</option>
                    <option>Pengayaan</option>
                    <option>Olimpiade / OSN</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fase</label>
                    <select
                      name="fase"
                      value={formData.fase}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="A">Fase A (SD 1-2)</option>
                      <option value="B">Fase B (SD 3-4)</option>
                      <option value="C">Fase C (SD 5-6)</option>
                      <option value="D">Fase D (SMP)</option>
                      <option value="E">Fase E (SMA 10)</option>
                      <option value="F">Fase F (SMA 11-12)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                    <select
                      name="kelas"
                      value={formData.kelas}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {FASE[formData.fase].kelas.map((k) => (
                        <option key={k} value={k}>Kelas {k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan Pembelajaran / Materi</label>
                  <textarea
                    name="materi"
                    value={formData.materi}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Contoh: Peserta didik dapat menganalisis dampak pemanasan global terhadap ekosistem..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indikator Ketercapaian Tujuan Pembelajaran (IKTP)</label>
                  <textarea
                    name="iktp"
                    value={formData.iktp}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Opsional. Tulis tiap indikator di baris baru, mis:&#10;1. Menjelaskan penyebab pemanasan global&#10;2. Menganalisis dampaknya terhadap ekosistem"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition"
                  ></textarea>
                  <p className="text-xs text-gray-500 mt-1">*Dikosongkan = IKTP disusun otomatis oleh AI dari Tujuan Pembelajaran.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal</label>
                    <input
                      type="number"
                      name="jumlahSoal"
                      min="1"
                      max="50"
                      value={formData.jumlahSoal}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pilihan Jawaban</label>
                    <select
                      name="jumlahPilihan"
                      value={formData.jumlahPilihan}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="2">2 opsi (A–B)</option>
                      <option value="3">3 opsi (A–C)</option>
                      <option value="4">4 opsi (A–D)</option>
                      <option value="5">5 opsi (A–E)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 -mt-2">*Maks 50 soal. Disarankan ≤15 per generate. Jumlah pilihan berlaku untuk PG & PG Kompleks.</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat Kesulitan (%)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-xs text-gray-500">Mudah</span>
                      <input
                        type="number"
                        name="mudah"
                        min="0"
                        max="100"
                        value={formData.tingkatKesulitan.mudah}
                        onChange={handleDifficultyChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Sedang</span>
                      <input
                        type="number"
                        name="sedang"
                        min="0"
                        max="100"
                        value={formData.tingkatKesulitan.sedang}
                        onChange={handleDifficultyChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Sulit</span>
                      <input
                        type="number"
                        name="sulit"
                        min="0"
                        max="100"
                        value={formData.tingkatKesulitan.sulit}
                        onChange={handleDifficultyChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  {(() => {
                    const total = formData.tingkatKesulitan.mudah + formData.tingkatKesulitan.sedang + formData.tingkatKesulitan.sulit;
                    return (
                      <p className={`text-xs mt-1 font-medium ${total !== 100 ? 'text-red-500' : 'text-green-600'}`}>
                        Total: {total}% {total !== 100 && '(Pastikan total mencapai 100%)'}
                      </p>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bentuk Soal</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(formData.bentukSoal).map((key) => (
                      <label key={key} className="flex items-center space-x-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name={key}
                          checked={formData.bentukSoal[key]}
                          onChange={handleInputChange}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          {key === 'pg' && 'Pilihan Ganda'}
                          {key === 'pgk' && 'PG Kompleks'}
                          {key === 'menjodohkan' && 'Menjodohkan'}
                          {key === 'bs' && 'Benar-Salah'}
                          {key === 'isian' && 'Isian Singkat'}
                          {key === 'uraian' && 'Uraian'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-3">
                  <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      name="sertakanGambar"
                      checked={formData.sertakanGambar}
                      onChange={handleInputChange}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="font-medium">Sertakan gambar ilustrasi (AI)</span>
                      <span className="block text-xs text-gray-500 mt-0.5">Default mati. Gambar AI gratis kadang kurang akurat/relevan. Tanpa gambar, stimulus tetap kaya lewat tabel, grafik, dan deskripsi.</span>
                    </span>
                  </label>
                </div>

                <div className="rounded-xl border border-gray-200 p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar Soal (stimulus manual)</label>
                  <p className="text-xs text-gray-500 mb-2">Upload gambar dan tentukan nomor soalnya. AI akan "melihat" gambar dan membuat soal pada nomor itu berdasarkan gambar tersebut.</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {uploadedImages.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedImages.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <img src={u.dataUrl} alt="stimulus" className="w-12 h-12 object-cover rounded-md border border-gray-200" />
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-gray-600">Soal No.</span>
                            <input
                              type="number"
                              min="1"
                              value={u.soalNo}
                              onChange={(e) => updateImageSoalNo(u.id, e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(u.id)}
                            className="ml-auto text-red-500 hover:text-red-700 text-sm px-2"
                            title="Hapus gambar"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className={`w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
                    isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {loadingStatus}
                    </>
                  ) : (
                    'Generate Soal'
                  )}
                </button>
              </form>
            </div>
          </div>

          {previewPanel}
        </div>
        )}

        {mode === 'tka' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {tkaFormPanel}
          {previewPanel}
        </div>
        )}

        {mode === 'cbt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {cbtFormPanel}
          {cbtPreviewPanel}
        </div>
        )}

      </div>
    </div>
  );
}
