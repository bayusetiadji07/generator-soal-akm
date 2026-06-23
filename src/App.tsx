import { useState, useRef } from 'react';

export default function App() {
  const [formData, setFormData] = useState({
    mataPelajaran: '',
    kelas: '7',
    semester: 'Ganjil',
    materi: '',
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
  const resultRef = useRef(null);

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
Jumlah Soal: ${formData.jumlahSoal}
Bentuk Soal: ${getSelectedBentukSoal()}

Ketentuan Penyusunan Soal:
- Level Kesulitan: Mudah ${formData.tingkatKesulitan.mudah}%, Sedang ${formData.tingkatKesulitan.sedang}%, Sulit ${formData.tingkatKesulitan.sulit}%
- Mengacu pada Kurikulum Merdeka Fase D SMP.
- Berorientasi Literasi dan Numerasi.
- Kontekstual, HOTS, Bernalar kritis, Tidak hanya menghafal.
- Memiliki stimulus yang menarik (konteks kehidupan nyata, fenomena, data sederhana).
- Mengembangkan Profil Pelajar Pancasila.
- Gunakan bahasa Indonesia yang baik, benar, dan tidak ambigu.
- Gunakan variasi tingkat kognitif (C1-C6, dominan C3-C5).
- Integrasikan aspek literasi (menemukan, memahami, menginterpretasi, mengevaluasi informasi).
- Integrasikan aspek numerasi (membaca tabel/grafik, penalaran matematis, probabilitas, dll). Untuk mapel Non-Matematika, sisipkan unsur numerasi lewat tabel/data/persentase.
- ORISINAL: Jangan menyalin dari buku. Gunakan nama/tokoh/tempat yang bervariasi.
- GAMBAR STIMULUS: Jika stimulus soal sangat membutuhkan atau akan lebih baik jika ada gambar visual (seperti percobaan, grafik, pemandangan, anatomi), Anda WAJIB menyisipkan tag gambar persis dengan format ini: <img class="generated-image" data-prompt="[TULIS PROMPT GAMBAR DALAM BAHASA INGGRIS YANG SANGAT DETAIL DISINI]" src="https://via.placeholder.com/400x200?text=Sedang+Membuat+Gambar..." alt="Ilustrasi Soal" style="max-width: 100%; border-radius: 8px; margin: 10px 0;"/>

BERIKAN OUTPUT DALAM FORMAT HTML MURNI (tanpa tag <html>, <head>, atau <body>, langsung gunakan tag heading seperti <h2>, <h3>, <p>, <table>, <ul>, <ol>, <b>, dll). Pastikan styling tabel rapi menggunakan atribut HTML border="1" cellpadding="5". Jangan gunakan markdown (\`\`\`).

Format output yang WAJIB dipenuhi:
<h2>A. Identitas Soal</h2>
(tampilkan identitas)
<h2>B. Kisi-kisi Soal</h2>
(Buat tabel kisi-kisi berisi No, Materi, Tujuan Pembelajaran, Indikator Soal, Level Kognitif, Literasi/Numerasi, Bentuk Soal, Nomor)
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

  const fetchImage = async (promptText) => {
    try {
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      if (!response.ok) throw new Error('Image generation failed');
      const result = await response.json();
      return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
    } catch (error) {
      console.error("Gagal menghasilkan gambar:", error);
      return "https://via.placeholder.com/400x200?text=Gambar+Gagal+Dimuat";
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
      }
    };

    try {
      const result = await fetchWithRetry(payload);
      let textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Bersihkan jika AI masih membandel memberikan tag markdown html
      textContent = textContent.replace(/```html/gi, '').replace(/```/g, '').trim();

      setGeneratedHtml(textContent);

      // Cek apakah ada gambar yang perlu digenerate
      const parser = new DOMParser();
      const doc = parser.parseFromString(textContent, 'text/html');
      const images = doc.querySelectorAll('img[data-prompt]');

      if (images.length > 0) {
        setLoadingStatus('Menghasilkan Gambar Ilustrasi...');
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const prompt = img.getAttribute('data-prompt');
          if (prompt) {
            const base64Url = await fetchImage(prompt);
            img.src = base64Url;
            img.removeAttribute('data-prompt');
          }
        }
        setGeneratedHtml(doc.body.innerHTML);
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

  const exportToWord = () => {
    if (!generatedHtml) return;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Perangkat Soal</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
          h2 { font-size: 14pt; color: #333; margin-top: 20px; }
          h3 { font-size: 12pt; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
          table, th, td { border: 1px solid black; }
          th, td { padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          p { line-height: 1.5; }
        </style>
      </head>
      <body>
    `;
    const footer = "</body></html>";
    const sourceHTML = header + generatedHtml + footer;

    const blob = new Blob(['﻿', sourceHTML], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Perangkat_Soal_${formData.mataPelajaran.replace(/\s+/g, '_')}_Kls${formData.kelas}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal</label>
                  <input
                    type="number"
                    name="jumlahSoal"
                    min="1"
                    max="20"
                    value={formData.jumlahSoal}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">*Disarankan max 10 untuk kualitas stimulus terbaik.</p>
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
                  Download .docx
                </button>
              </div>

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
              `}} />

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
