import { useState, useRef } from 'react';

export default function App() {
  const [formData, setFormData] = useState({
    mataPelajaran: '',
    kelas: '7',
    semester: 'Ganjil',
    materi: '',
    iktp: '',
    jumlahSoal: 5,
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const resultRef = useRef(null);

  // Placeholder bawaan (SVG, tanpa internet luar) — dipakai saat gambar gagal/dimuat
  const placeholderSvg = (text) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="100%" height="100%" fill="#f3f4f6" stroke="#d1d5db" stroke-width="1"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

  const IMG_STYLE = 'max-width: 400px; width: 100%; height: auto; border-radius: 8px; margin: 10px 0; display: block;';

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
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

  const generatePrompt = () => {
    return `
Anda adalah seorang pakar asesmen pendidikan Kurikulum Merdeka, penulis soal AKM, penyusun soal OSN, serta guru berpengalaman jenjang SMP.
Tugas Anda adalah membuat perangkat soal berkualitas tinggi yang mengembangkan kemampuan Literasi dan Numerasi sesuai karakteristik Kurikulum Merdeka berdasarkan data berikut:

Mata Pelajaran: ${formData.mataPelajaran}
Kelas: ${formData.kelas} SMP (Fase D)
Semester: ${formData.semester}
Tujuan Pembelajaran / Materi: ${formData.materi}
Indikator Ketercapaian Tujuan Pembelajaran (IKTP): ${formData.iktp ? formData.iktp : '(Tidak diisi guru — susun IKTP yang relevan & terukur secara otomatis dari Tujuan Pembelajaran di atas, lalu jadikan acuan soal)'}
Jumlah Soal: ${formData.jumlahSoal}
Bentuk Soal: ${getSelectedBentukSoal()}

Ketentuan Penyusunan Soal:
- Level Kesulitan: Mudah ${formData.tingkatKesulitan.mudah}%, Sedang ${formData.tingkatKesulitan.sedang}%, Sulit ${formData.tingkatKesulitan.sulit}%
- Mengacu pada Kurikulum Merdeka Fase D SMP.
- WAJIB MENGACU PADA IKTP: Setiap soal harus mengukur Indikator Ketercapaian Tujuan Pembelajaran (IKTP) di atas. Indikator Soal pada kisi-kisi harus merupakan turunan/operasionalisasi dari IKTP, dan distribusikan soal agar seluruh IKTP terwakili.
- Berorientasi Literasi dan Numerasi.
- Kontekstual, HOTS, Bernalar kritis, Tidak hanya menghafal.
- Memiliki stimulus yang menarik (konteks kehidupan nyata, fenomena, data sederhana).
- Mengembangkan Profil Pelajar Pancasila.
- Gunakan bahasa Indonesia yang baik, benar, dan tidak ambigu.
- Gunakan variasi tingkat kognitif (C1-C6, dominan C3-C5).
- Integrasikan aspek literasi (menemukan, memahami, menginterpretasi, mengevaluasi informasi).
- Integrasikan aspek numerasi (membaca tabel/grafik, penalaran matematis, probabilitas, dll). Untuk mapel Non-Matematika, sisipkan unsur numerasi lewat tabel/data/persentase.
- ORISINAL: Jangan menyalin dari buku. Gunakan nama/tokoh/tempat yang bervariasi.
- VARIASI STIMULUS: Setiap soal WAJIB memiliki stimulus yang sesuai konteks, dan variasikan bentuknya antar soal. Pilih bentuk paling tepat: teks/wacana, studi kasus nyata, tabel data, grafik/diagram, persentase atau data statistik, infografis, atau gambar/ilustrasi deskriptif. Patuhi format teknis berikut agar tampil benar:
  - TABEL, DATA STATISTIK & PERSENTASE: gunakan <table border="1" cellpadding="5"> berisi data yang realistis dan konsisten.
  - GRAFIK/DIAGRAM (batang, garis, lingkaran/pie): DILARANG dibuat sebagai gambar/foto. WAJIB dibuat sebagai kode <svg> inline yang valid dan akurat sesuai data — lengkap dengan sumbu, label, dan nilai yang terbaca jelas, lebar maksimal 480px. Bila relevan, sertakan juga tabel datanya.
  - INFOGRAFIS: kombinasikan tabel dan/atau <svg> sederhana dengan poin-poin teks ringkas yang tertata rapi.
  - GAMBAR/ILUSTRASI DESKRIPTIF (pemandangan, anatomi, percobaan, objek, fenomena alam): gunakan tag Imagen persis format ini: <img class="generated-image" data-prompt="[TULIS PROMPT GAMBAR DALAM BAHASA INGGRIS YANG SANGAT DETAIL DISINI]" src="https://via.placeholder.com/400x200?text=Sedang+Membuat+Gambar..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>. Pakai tag ini HANYA untuk ilustrasi gambar nyata, JANGAN untuk grafik/diagram data.

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
<h2>F. Analisis Soal</h2>
(Tampilkan Materi, Tujuan, Indikator, Kompetensi Literasi/Numerasi, Level Kognitif, Level Kesulitan, Estimasi waktu)
<h2>G. Pemeriksaan Kualitas Soal</h2>
(Daftar centang/checklist yang telah dipenuhi)
`;
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
          body: JSON.stringify(payload)
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

  const handleGenerate = async (e) => {
    e.preventDefault();
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

    setError('');
    setIsGenerating(true);
    setLoadingStatus('Menyusun Asesmen...');
    setGeneratedHtml('');

    const payload = {
      contents: [{
        parts: [{ text: generatePrompt() }]
      }],
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

      setGeneratedHtml(textContent);
      setImageFailures(0);

      // Generate + kompres gambar; yang gagal bisa dicoba ulang nanti
      const { html, failed, errorMsg } = await processImages(textContent);
      setGeneratedHtml(html);
      setImageFailures(failed);
      setImageError(failed > 0 ? errorMsg : '');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Gagal membuat soal: ${msg}`);
    } finally {
      setIsGenerating(false);
      setLoadingStatus('');
    }
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

    const safeName = (formData.mataPelajaran || 'Soal').replace(/\s+/g, '_');
    const fileName = `Perangkat_Soal_${safeName}_Kls${formData.kelas}.doc`;

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

  const exportToPdf = async () => {
    if (!generatedHtml || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const doc = new DOMParser().parseFromString(generatedHtml, 'text/html');

      // Grafik SVG → PNG agar pasti tampil di PDF
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

      // Wadah cetak (lebar ~A4), dirender di luar layar
      const container = document.createElement('div');
      container.innerHTML = `
        <style>
          .pdf-doc { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; }
          .pdf-doc h2 { font-size: 14pt; font-weight: 700; margin: 16px 0 8px; }
          .pdf-doc h3 { font-size: 12pt; font-weight: 700; margin: 12px 0 6px; }
          .pdf-doc p { margin: 0 0 8px; }
          .pdf-doc ul, .pdf-doc ol { margin: 0 0 10px 22px; }
          .pdf-doc table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11pt; }
          .pdf-doc th, .pdf-doc td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
          .pdf-doc th { background: #f2f2f2; }
          .pdf-doc img { max-width: 400px; height: auto; display: block; margin: 8px 0; }
        </style>
        <div class="pdf-doc">${doc.body.innerHTML}</div>
      `;
      container.style.position = 'fixed';
      container.style.left = '-99999px';
      container.style.top = '0';
      container.style.width = '760px';
      container.style.background = '#ffffff';
      container.style.padding = '8px';
      document.body.appendChild(container);

      const safeName = (formData.mataPelajaran || 'Soal').replace(/\s+/g, '_');
      const opt = {
        margin: [10, 10, 12, 10],
        filename: `Perangkat_Soal_${safeName}_Kls${formData.kelas}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
      };

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);
    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      setError('Gagal membuat PDF. Coba lagi atau gunakan Download Word.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-inner">
            A
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Generator Soal AKM & Kurikulum Merdeka</h1>
            <p className="text-gray-500 text-sm">Desain perangkat soal terstandar (HOTS, Literasi, Numerasi) Fase D (SMP)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Form Input Container */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Konfigurasi Soal</h2>

              <form onSubmit={handleGenerate} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                    <select
                      name="kelas"
                      value={formData.kelas}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="7">Kelas 7</option>
                      <option value="8">Kelas 8</option>
                      <option value="9">Kelas 9</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                  <p className="text-xs text-gray-500 mt-1">*Maks 50 soal. Disarankan ≤15 per generate untuk kualitas stimulus terbaik & menghindari jawaban terpotong.</p>
                </div>

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

          {/* Preview Container */}
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
                    Word
                  </button>

                  <button
                    onClick={exportToPdf}
                    disabled={!generatedHtml || isGenerating || isExportingPdf}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
                      !generatedHtml || isGenerating || isExportingPdf
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                    }`}
                  >
                    {isExportingPdf ? (
                      <svg className="animate-spin h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" x2="12" y1="15" y2="3"/>
                      </svg>
                    )}
                    {isExportingPdf ? 'Membuat...' : 'PDF'}
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
        </div>
      </div>
    </div>
  );
}
