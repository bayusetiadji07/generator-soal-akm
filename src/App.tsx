import { useState, useRef } from 'react';

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
// Ruang lingkup TKA: jenjang SD & SMP, 4 mapel inti.
const TKA_JENJANG = {
  SD: { kelas: ['1', '2', '3', '4', '5', '6'] },
  SMP: { kelas: ['7', '8', '9'] },
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
    kelas: '1',
    semester: 'Ganjil',
    domainKompetensi: TKA_KOMPETENSI.Matematika[0],
    materi: '',
    konteks: TKA_KONTEKS[0],
    tipeTes: 'Latihan TKA',
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
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('gemini_api_key') || ''; } catch { return ''; }
  });
  const [showKey, setShowKey] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]); // { id, soalNo, dataUrl }
  const resultRef = useRef(null);

  // Pindah antar generator (AKM/TKA) — reset hasil & lampiran, API key tetap tersimpan
  const switchMode = (newMode) => {
    setMode(newMode);
    setGeneratedHtml('');
    setError('');
    setImageFailures(0);
    setImageError('');
    setUploadedImages([]);
  };

  const handleApiKeyChange = (e) => {
    const v = e.target.value.trim();
    setApiKey(v);
    try { localStorage.setItem('gemini_api_key', v); } catch { /* abaikan */ }
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
    if (type === 'checkbox' && name === 'sertakanGambar') {
      setTkaData(prev => ({ ...prev, sertakanGambar: checked }));
    } else if (name === 'mataPelajaran') {
      // Ganti mapel → reset domain kompetensi ke opsi pertama mapel tsb
      setTkaData(prev => ({ ...prev, mataPelajaran: value, domainKompetensi: TKA_KOMPETENSI[value][0] }));
    } else if (name === 'jenjang') {
      // Ganti jenjang → reset kelas ke kelas pertama jenjang tsb
      setTkaData(prev => ({ ...prev, jenjang: value, kelas: TKA_JENJANG[value].kelas[0] }));
    } else if (type === 'checkbox') {
      setTkaData(prev => ({
        ...prev,
        bentukSoal: { ...prev.bentukSoal, [name]: checked }
      }));
    } else {
      setTkaData(prev => ({ ...prev, [name]: value }));
    }
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
- Berorientasi Literasi dan Numerasi.
- Kontekstual, HOTS, Bernalar kritis, Tidak hanya menghafal.
- Memiliki stimulus yang menarik (konteks kehidupan nyata, fenomena, data sederhana).
- Mengembangkan Profil Pelajar Pancasila.
- BAHASA SOAL: Tulis stimulus, pertanyaan, seluruh pilihan jawaban, kunci jawaban, dan pembahasan dalam bahasa pengantar mata pelajaran ini. Untuk Mata Pelajaran "${formData.mataPelajaran}"${/inggris|english/i.test(formData.mataPelajaran) ? ' (Bahasa Inggris), maka SELURUH isi soal — stimulus, pertanyaan, pilihan jawaban, kunci, dan pembahasan — WAJIB ditulis dalam BAHASA INGGRIS' : ', gunakan Bahasa Indonesia (kecuali istilah/kutipan yang memang berbahasa lain). Untuk mapel bahasa asing/daerah lain, tulis soal dalam bahasa tersebut'}. Bahasa harus baik, benar, dan tidak ambigu.
- PENULISAN MATEMATIKA (WAJIB): DILARANG KERAS memakai LaTeX atau Markdown untuk rumus (jangan ada \\frac, \\times, \\sqrt, \\pi, tanda $...$, \\( \\), \\[ \\], atau ^ dan _ mentah). Tulis SEMUA matematika sebagai HTML biasa yang langsung terbaca: pangkat pakai <sup> (mis. x<sup>2</sup>, 10<sup>3</sup>), indeks/subskrip pakai <sub> (mis. H<sub>2</sub>O), pecahan tulis a/b atau gunakan simbol ½ ¾, dan pakai simbol Unicode untuk operasi: × ÷ − ± ≤ ≥ ≠ ≈ √ π ° ∑ ∞ (BUKAN kode LaTeX). Rumus harus tampil rapi tanpa kode mentah.
- Gunakan variasi tingkat kognitif (C1-C6, dominan C3-C5).
- Integrasikan aspek literasi (menemukan, memahami, menginterpretasi, mengevaluasi informasi).
- Integrasikan aspek numerasi (membaca tabel/grafik, penalaran matematis, probabilitas, dll). Untuk mapel Non-Matematika, sisipkan unsur numerasi lewat tabel/data/persentase.
- ORISINAL: Jangan menyalin dari buku. Gunakan nama/tokoh/tempat yang bervariasi.
- VARIASI STIMULUS: Setiap soal WAJIB memiliki stimulus yang sesuai konteks, dan variasikan bentuknya antar soal. Pilih bentuk paling tepat: teks/wacana, studi kasus nyata, tabel data, grafik/diagram, persentase atau data statistik, infografis, atau gambar/ilustrasi deskriptif. Patuhi format teknis berikut agar tampil benar:
  - TABEL, DATA STATISTIK & PERSENTASE: gunakan <table border="1" cellpadding="5"> berisi data yang realistis dan konsisten.
  - GRAFIK/DIAGRAM (batang, garis, lingkaran/pie): DILARANG dibuat sebagai gambar/foto. WAJIB dibuat sebagai kode <svg> inline yang valid dan akurat sesuai data — lengkap dengan sumbu, label, dan nilai yang terbaca jelas, lebar maksimal 480px. Bila relevan, sertakan juga tabel datanya.
  - INFOGRAFIS: kombinasikan tabel dan/atau <svg> sederhana dengan poin-poin teks ringkas yang tertata rapi.
${formData.sertakanGambar
  ? `  - GAMBAR/ILUSTRASI DESKRIPTIF: gunakan tag ini persis: <img class="generated-image" data-prompt="[PROMPT GAMBAR DALAM BAHASA INGGRIS]" src="https://via.placeholder.com/400x200?text=Memuat..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>. ATURAN KETAT agar gambar RELEVAN & AKURAT: (1) Pakai gambar HANYA bila benar-benar membantu memahami soal, maksimal untuk 2-3 soal saja, JANGAN setiap soal. (2) HANYA untuk objek/pemandangan/benda nyata yang sederhana dan umum (mis. "a glass of water", "a green leaf", "a wooden table with fruits"). (3) JANGAN minta gambar yang butuh ketepatan ilmiah/teknis (diagram berlabel, anatomi detail, peta, rumus, struktur kimia, grafik) — untuk itu pakai SVG/tabel/teks. (4) AKURASI WAJIB: data-prompt harus secara eksplisit menyebutkan SEMUA objek, jumlah, warna, posisi, dan detail spesifik yang disebut di teks soal/stimulus itu sendiri (contoh: jika soal menyebut "3 buah apel merah di atas meja kayu", prompt harus "three red apples on a wooden table", BUKAN deskripsi umum "fruits on a table") — supaya gambar cocok persis dengan yang ditanyakan, bukan sekadar mirip tema. (5) GAYA RINGAN: minta gaya "simple flat illustration" atau "clean minimalist photo", "plain white or light background", "no clutter, no extra objects" — supaya gambar sederhana, ukuran file kecil, dan cepat dibuat. (6) data-prompt harus deskriptif, konkret, dalam SATU kalimat singkat, dan TANPA teks/tulisan/angka di dalam gambar.`
  : `  - GAMBAR FOTO: JANGAN gunakan tag <img> atau gambar foto sama sekali. Sebagai gantinya sajikan stimulus visual lewat tabel, grafik <svg>, atau deskripsi teks yang jelas.`}
- FORMAT TIAP BENTUK SOAL (WAJIB dipatuhi agar tampilan jawaban benar):
  - Pilihan Ganda (PG): tepat SATU jawaban benar. Sediakan TEPAT ${formData.jumlahPilihan} opsi jawaban berlabel huruf. Tulis opsi sebagai <ol type="A"> dengan tiap opsi di <li> (jadi A sampai huruf ke-${formData.jumlahPilihan}). Pastikan pengecoh (distraktor) logis.
  - Pilihan Ganda Kompleks (PGK): BISA LEBIH DARI SATU jawaban benar. Sediakan TEPAT ${formData.jumlahPilihan} opsi/pernyataan. WAJIB awali SETIAP opsi dengan kotak centang "☐ " (karakter U+2610 lalu spasi) agar siswa bisa menandai banyak jawaban. Susun sebagai daftar tanpa nomor, contoh: <ul style="list-style:none;padding-left:0"><li>☐ pernyataan pertama</li><li>☐ pernyataan kedua</li>...</ul>. Beri petunjuk singkat "(Pilih semua jawaban yang benar)". JANGAN gunakan A/B/C/D untuk PGK.
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
(Tabel/Daftar Kunci Jawaban)
<h2>E. Pembahasan</h2>
(Penjelasan lengkap untuk masing-masing soal)

PENTING: Output BERHENTI setelah bagian "E. Pembahasan". JANGAN membuat bagian "Analisis Soal" maupun "Pemeriksaan Kualitas Soal".
`;
  };

  // ===== Prompt Generator TKA (mengikuti TKA Assessment Engine v6 Professional Manual) =====
  const generateTkaPrompt = () => {
    const jenjang = tkaData.jenjang;
    const fase = kelasToFase(jenjang, tkaData.kelas);
    const domainFramework = TKA_KOMPETENSI[tkaData.mataPelajaran] || [];
    const isKontekAcak = tkaData.konteks === TKA_KONTEKS[0];
    const daftarKonteks = TKA_KONTEKS.slice(1).join(', ');
    const refSubjek = TKA_REFERENSI[tkaData.mataPelajaran] || {};
    const refJenjang = refSubjek[jenjang] || '';
    const catatanDistribusi = refSubjek.catatan || '';

    return `
Anda adalah TKA Assessment Engine — sistem pakar penyusun soal Tes Kemampuan Akademik (TKA) untuk jenjang SD dan SMP di Indonesia. Anda mengikuti alur kerja profesional secara berurutan dan INTERNAL (jangan tampilkan proses ini di output, cukup hasil akhirnya):
1) Blueprint (rancang kisi-kisi) → 2) Stimulus (susun stimulus sesuai karakteristik jenjang & konteks) → 3) Penyusunan Soal (konstruksi soal berdasarkan domain kompetensi) → 4) Pemeriksaan Pengecoh (distraktor logis, bukan asal) → 5) Validasi Bahasa (baku, jelas, sesuai usia) → 6) Validasi Jawaban (kunci benar & konsisten) → 7) Deteksi Kemiripan (pastikan tiap soal berbeda signifikan) → 8) Export.
Prinsip TKA: VALID, RELIABEL, AUTENTIK, KONTEKSTUAL, dan BERBASIS KOMPETENSI — bukan soal hafalan.

Data Penyusunan Soal TKA:
Mata Pelajaran: ${tkaData.mataPelajaran}
Jenjang: ${jenjang}, Kelas ${tkaData.kelas} (setara Fase ${fase} Kurikulum Merdeka)
Semester: ${tkaData.semester}
Keperluan / Jenis Tes: ${tkaData.tipeTes}
Materi / Topik: ${tkaData.materi}
Domain Kompetensi yang Diutamakan: ${tkaData.domainKompetensi}
Konteks Stimulus: ${isKontekAcak
      ? `Bebas dipilih AI dari Bank Konteks berikut — WAJIB VARIASIKAN antar soal, jangan mengulang konteks yang sama dua kali: ${daftarKonteks}.`
      : `WAJIB gunakan konteks "${tkaData.konteks}" untuk seluruh stimulus soal (boleh divariasikan sudut pandang/situasinya, tetap dalam kategori ini).`}
Jumlah Soal: ${tkaData.jumlahSoal}
Jumlah Pilihan Jawaban (untuk Pilihan Ganda / PG Kompleks): ${tkaData.jumlahPilihan} opsi
Bentuk Soal: ${getSelectedBentukSoalTka()}
${uploadedImages.length > 0 ? `
GAMBAR STIMULUS DARI GURU (WAJIB DIPAKAI): Guru melampirkan ${uploadedImages.length} gambar (terlampir di pesan ini). Tiap gambar adalah STIMULUS WAJIB untuk soal nomor tertentu — perhatikan keterangan "[Gambar stimulus WAJIB untuk Soal No. X]" tepat sebelum tiap gambar. Untuk setiap gambar: AMATI isinya dengan teliti, lalu SUSUN soal nomor X benar-benar BERDASARKAN gambar tersebut. Pada bagian "C. Soal", di soal nomor X, sisipkan penanda gambar PERSIS ini di posisi stimulus: <img class="user-stimulus" data-userimg="X" alt="Gambar Stimulus Soal X"/> (JANGAN beri atribut src). Soal yang memakai gambar guru: nomor ${uploadedImages.map((u) => u.soalNo).join(', ')}. Pastikan total ${tkaData.jumlahSoal} soal mencakup nomor-nomor itu.
` : ''}

Kerangka Kompetensi Domain "${tkaData.mataPelajaran}" (acuan TKA Assessment Engine, Subject Engine):
${domainFramework.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Distribusikan soal agar mencakup variasi domain di atas, dengan penekanan MAYORITAS pada domain yang diutamakan ("${tkaData.domainKompetensi}").
${catatanDistribusi ? catatanDistribusi : ''}

Bank Submateri & Jenis Teks Acuan untuk "${tkaData.mataPelajaran}" jenjang ${jenjang} (Subject Engine): ${refJenjang} Gunakan sebagai acuan cakupan bila Materi/Topik yang diisi guru bersifat umum; tetap prioritaskan Materi/Topik spesifik dari guru jika sudah rinci.

Ketentuan Penyusunan Soal TKA:
- Level Kesulitan: Mudah ${tkaData.tingkatKesulitan.mudah}%, Sedang ${tkaData.tingkatKesulitan.sedang}%, Sulit ${tkaData.tingkatKesulitan.sulit}%.
- Sesuaikan tingkat kesulitan, kompleksitas bahasa, dan konteks stimulus dengan usia peserta didik jenjang ${jenjang} kelas ${tkaData.kelas}.
- SESUAIKAN DENGAN JENIS TES "${tkaData.tipeTes}": sesuaikan cakupan materi, bobot, dan gaya soal (mis. Latihan TKA = fokus pemahaman per domain; Simulasi/Try Out TKA = kondisi mendekati tes asli, cakupan luas & berjenjang; Pemetaan Kompetensi = variatif lintas domain untuk diagnosis).
- Berorientasi Literasi (untuk Bahasa Indonesia/Bahasa Inggris), Numerasi (untuk Matematika), atau Literasi Sains (untuk IPA) sesuai kerangka kompetensi domain di atas.
- Kontekstual dengan kehidupan nyata Indonesia, HOTS, bernalar kritis, tidak hanya menghafal.
- Stimulus harus ORISINAL — jangan menyalin dari buku, gunakan nama/tokoh/tempat yang bervariasi.
- PEMERIKSAAN PENGECOH (khusus PG/PGK): setiap pengecoh (opsi salah) harus masuk akal dan mencerminkan miskonsepsi umum siswa jenjang ini, BUKAN opsi asal-asalan yang jelas salah.
- VALIDASI JAWABAN: pastikan kunci jawaban benar secara akademis dan konsisten dengan pembahasan.
- DETEKSI KEMIRIPAN: setiap soal harus berbeda signifikan satu sama lain — variasikan konteks, angka, nama, struktur kalimat, DAN strategi/cara penyelesaian — dilarang membuat soal yang terasa duplikat/template yang sama persis.
- BAHASA SOAL: Tulis stimulus, pertanyaan, seluruh pilihan jawaban, kunci jawaban, dan pembahasan dalam bahasa pengantar mata pelajaran ini. Untuk Mata Pelajaran "${tkaData.mataPelajaran}"${/inggris|english/i.test(tkaData.mataPelajaran) ? ' (Bahasa Inggris), maka SELURUH isi soal — stimulus, pertanyaan, pilihan jawaban, kunci, dan pembahasan — WAJIB ditulis dalam BAHASA INGGRIS' : ', gunakan Bahasa Indonesia yang baik dan benar'}. Bahasa harus baku, jelas, dan tidak ambigu.
- PENULISAN MATEMATIKA (WAJIB): DILARANG KERAS memakai LaTeX atau Markdown untuk rumus (jangan ada \\frac, \\times, \\sqrt, \\pi, tanda $...$, \\( \\), \\[ \\], atau ^ dan _ mentah). Tulis SEMUA matematika sebagai HTML biasa yang langsung terbaca: pangkat pakai <sup> (mis. x<sup>2</sup>, 10<sup>3</sup>), indeks/subskrip pakai <sub> (mis. H<sub>2</sub>O), pecahan tulis a/b atau gunakan simbol ½ ¾, dan pakai simbol Unicode untuk operasi: × ÷ − ± ≤ ≥ ≠ ≈ √ π ° ∑ ∞ (BUKAN kode LaTeX). Rumus harus tampil rapi tanpa kode mentah.
- VARIASI STIMULUS: Setiap soal WAJIB memiliki stimulus yang sesuai konteks, dan variasikan bentuknya antar soal. Pilih bentuk paling tepat: teks/wacana, studi kasus nyata, tabel data, grafik/diagram, denah/peta sederhana (khusus Matematika: Geometri/Pengukuran), persentase atau data statistik, infografis, atau gambar/ilustrasi deskriptif. Patuhi format teknis berikut agar tampil benar:
  - TABEL, DATA STATISTIK & PERSENTASE: gunakan <table border="1" cellpadding="5"> berisi data yang realistis dan konsisten.
  - GRAFIK/DIAGRAM (batang, garis, lingkaran/pie): DILARANG dibuat sebagai gambar/foto. WAJIB dibuat sebagai kode <svg> inline yang valid dan akurat sesuai data — lengkap dengan sumbu, label, dan nilai yang terbaca jelas, lebar maksimal 480px. Bila relevan, sertakan juga tabel datanya.
  - DENAH/PETA SEDERHANA (khusus Matematika, mis. soal jarak/skala/arah): WAJIB dibuat sebagai kode <svg> inline dengan label lokasi/jarak yang jelas dan akurat, BUKAN gambar/foto.
  - INFOGRAFIS: kombinasikan tabel dan/atau <svg> sederhana dengan poin-poin teks ringkas yang tertata rapi.
${tkaData.sertakanGambar
      ? `  - GAMBAR/ILUSTRASI DESKRIPTIF: gunakan tag ini persis: <img class="generated-image" data-prompt="[PROMPT GAMBAR DALAM BAHASA INGGRIS]" src="https://via.placeholder.com/400x200?text=Memuat..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>. ATURAN KETAT agar gambar RELEVAN & AKURAT: (1) Pakai gambar HANYA bila benar-benar membantu memahami soal, maksimal untuk 2-3 soal saja, JANGAN setiap soal. (2) HANYA untuk objek/pemandangan/benda nyata yang sederhana dan umum. (3) JANGAN minta gambar yang butuh ketepatan ilmiah/teknis (diagram berlabel, anatomi detail, peta, rumus, struktur kimia, grafik) — untuk itu pakai SVG/tabel/teks. (4) AKURASI WAJIB: data-prompt harus secara eksplisit menyebutkan SEMUA objek, jumlah, warna, posisi, dan detail spesifik yang disebut di teks soal/stimulus itu sendiri — supaya gambar cocok persis dengan yang ditanyakan, bukan sekadar mirip tema. (5) GAYA RINGAN: minta gaya "simple flat illustration" atau "clean minimalist photo", "plain white or light background", "no clutter, no extra objects" — supaya gambar sederhana, ukuran file kecil, dan cepat dibuat. (6) data-prompt harus deskriptif, konkret, dalam SATU kalimat singkat, dan TANPA teks/tulisan/angka di dalam gambar.`
      : `  - GAMBAR FOTO: JANGAN gunakan tag <img> atau gambar foto sama sekali. Sebagai gantinya sajikan stimulus visual lewat tabel, grafik <svg>, atau deskripsi teks yang jelas.`}
- FORMAT TIAP BENTUK SOAL (WAJIB dipatuhi agar tampilan jawaban benar):
  - Pilihan Ganda (PG): tepat SATU jawaban benar. Sediakan TEPAT ${tkaData.jumlahPilihan} opsi jawaban berlabel huruf. Tulis opsi sebagai <ol type="A"> dengan tiap opsi di <li> (jadi A sampai huruf ke-${tkaData.jumlahPilihan}). Pastikan pengecoh (distraktor) logis.
  - Pilihan Ganda Kompleks (PGK): BISA LEBIH DARI SATU jawaban benar. Sediakan TEPAT ${tkaData.jumlahPilihan} opsi/pernyataan. WAJIB awali SETIAP opsi dengan kotak centang "☐ " (karakter U+2610 lalu spasi) agar siswa bisa menandai banyak jawaban. Susun sebagai daftar tanpa nomor, contoh: <ul style="list-style:none;padding-left:0"><li>☐ pernyataan pertama</li><li>☐ pernyataan kedua</li>...</ul>. Beri petunjuk singkat "(Pilih semua jawaban yang benar)". JANGAN gunakan A/B/C/D untuk PGK.
  - Benar-Salah (BS): sajikan sebagai <table border="1" cellpadding="5"> dengan kolom "Pernyataan", "Benar (☐)", dan "Salah (☐)"; isi sel Benar/Salah dengan "☐".
  - Menjodohkan: gunakan <table border="1" cellpadding="5"> dua kolom (kiri pernyataan bernomor, kanan pilihan jawaban berhuruf yang diacak).
  - Isian Singkat: akhiri kalimat dengan garis isian "_______".
  - Uraian Terbatas: beri instruksi jelas dengan batasan cakupan jawaban yang spesifik (bukan esai bebas), dan sediakan ruang jawaban.

BERIKAN OUTPUT DALAM FORMAT HTML MURNI (tanpa tag <html>, <head>, atau <body>, langsung gunakan tag heading seperti <h2>, <h3>, <p>, <table>, <ul>, <ol>, <b>, dll). Pastikan styling tabel rapi menggunakan atribut HTML border="1" cellpadding="5". Jangan gunakan markdown (\`\`\`).

Format output yang WAJIB dipenuhi:
<h2>A. Identitas Soal</h2>
(tampilkan identitas: mapel, jenjang, kelas, semester, jenis tes, domain kompetensi)
<h2>B. Kisi-kisi Soal</h2>
(Buat tabel kisi-kisi berisi No, Materi, Submateri, Domain Kompetensi, Indikator Soal, Konteks, Level Kognitif, Bentuk Soal, Nomor)
<h2>C. Soal</h2>
(Tampilkan tiap soal lengkap dengan stimulus, pertanyaan, dan pilihan/area jawaban)
<h2>D. Kunci Jawaban</h2>
(Tabel/Daftar Kunci Jawaban)
<h2>E. Pembahasan</h2>
(Penjelasan lengkap untuk masing-masing soal)

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
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey, payload })
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
  const runGeneration = async (promptText, sertakanGambarFlag) => {
    setError('');
    setIsGenerating(true);
    setLoadingStatus('Menyusun Asesmen...');
    setGeneratedHtml('');

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
      if (!sertakanGambarFlag) {
        const d = new DOMParser().parseFromString(textContent, 'text/html');
        d.querySelectorAll('img.generated-image, img[data-prompt]').forEach((im) => im.remove());
        textContent = d.body.innerHTML;
      }

      setGeneratedHtml(textContent);
      setImageFailures(0);
      setImageError('');

      // Generate gambar hanya bila opsi diaktifkan
      if (sertakanGambarFlag) {
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
    if (!apiKey) {
      setError('API Key Gemini belum diisi. Masukkan API Key Anda di kolom paling atas (dapatkan gratis di aistudio.google.com/app/apikey).');
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
    await runGeneration(generatePrompt(), formData.sertakanGambar);
  };

  const handleGenerateTka = async (e) => {
    e.preventDefault();
    if (!apiKey) {
      setError('API Key Gemini belum diisi. Masukkan API Key Anda di kolom paling atas (dapatkan gratis di aistudio.google.com/app/apikey).');
      return;
    }
    if (!tkaData.materi) {
      setError('Mohon isi Materi / Topik terlebih dahulu.');
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
    await runGeneration(generateTkaPrompt(), tkaData.sertakanGambar);
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
          </div>
        </div>

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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
              <select
                name="jenjang"
                value={tkaData.jenjang}
                onChange={handleTkaInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
              <select
                name="kelas"
                value={tkaData.kelas}
                onChange={handleTkaInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {TKA_JENJANG[tkaData.jenjang].kelas.map((k) => (
                  <option key={k} value={k}>Kelas {k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                name="semester"
                value={tkaData.semester}
                onChange={handleTkaInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain Kompetensi yang Diutamakan</label>
            <select
              name="domainKompetensi"
              value={tkaData.domainKompetensi}
              onChange={handleTkaInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {TKA_KOMPETENSI[tkaData.mataPelajaran].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Soal tetap divariasikan lintas domain, dengan penekanan mayoritas pada domain ini.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Materi / Topik</label>
            <textarea
              name="materi"
              value={tkaData.materi}
              onChange={handleTkaInputChange}
              rows={3}
              placeholder="Contoh: Pecahan senilai, Teks laporan hasil observasi, Descriptive text, Siklus air..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition"
            ></textarea>
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
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                name="sertakanGambar"
                checked={tkaData.sertakanGambar}
                onChange={handleTkaInputChange}
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-inner">
            {mode === 'tka' ? 'T' : mode === 'akm' ? 'A' : 'Q'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Generator Question Test Engine</h1>
            <p className="text-gray-500 text-sm">
              {mode === 'akm' && 'Generator AKM — Literasi Numerasi, Kurikulum Merdeka semua Fase (A–F)'}
              {mode === 'tka' && 'Generator TKA — Tes Kemampuan Akademik, jenjang SD & SMP'}
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

        {mode !== null && (
          <div className={`rounded-xl border p-3 bg-white shadow-sm ${apiKey ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key Gemini {!apiKey && <span className="text-amber-600">(wajib diisi)</span>}</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Tempel API Key Gemini Anda di sini"
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
              Tersimpan di browser Anda (tidak dibagikan). Dapatkan gratis di{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline">aistudio.google.com/app/apikey</a>.
            </p>
          </div>
        )}

        {mode === null && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      </div>
    </div>
  );
}
