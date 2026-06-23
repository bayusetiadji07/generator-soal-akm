# Generator Soal AKM & Kurikulum Merdeka

Aplikasi web untuk menyusun perangkat soal (kisi-kisi, soal, kunci, pembahasan, analisis) berorientasi AKM/HOTS Fase D SMP menggunakan Gemini AI. Dibuat dengan Vite + React + Tailwind, dengan API key Gemini disembunyikan di sisi server (Vercel Serverless Functions).

## Cara Kerja Keamanan API Key

Aplikasi ini **tidak** menaruh API key di kode browser. Frontend memanggil `/api/generate` dan `/api/image`, lalu fungsi serverless di folder `api/` yang meneruskan ke Gemini menggunakan `GEMINI_API_KEY` yang tersimpan aman di server.

## Deploy ke Vercel (cara termudah)

1. **Dapatkan API key Gemini** (gratis) di https://aistudio.google.com/app/apikey
2. **Upload kode ke GitHub**: buat repo baru, push folder ini.
3. Buka https://vercel.com → **Add New → Project** → import repo GitHub Anda.
4. Vercel otomatis mendeteksi Vite. Sebelum klik Deploy, buka **Environment Variables** dan tambahkan:
   - Name: `GEMINI_API_KEY`
   - Value: (API key dari langkah 1)
5. Klik **Deploy**. Selesai — Anda akan dapat URL `https://....vercel.app`.

> Jika sudah terlanjur deploy sebelum mengisi env var: Settings → Environment Variables → tambahkan `GEMINI_API_KEY`, lalu **Redeploy**.

### Alternatif via Vercel CLI

```bash
npm i -g vercel
vercel            # ikuti prompt, login & link project
vercel env add GEMINI_API_KEY
vercel --prod
```

## Menjalankan Lokal

```bash
npm install
```

- **Tampilan saja (tanpa fungsi AI):**
  ```bash
  npm run dev
  ```
  Buka http://localhost:5173. Tombol "Generate" akan error karena `/api/*` hanya hidup di Vercel.

- **Lengkap dengan fungsi AI (meniru Vercel):**
  ```bash
  npm i -g vercel
  vercel dev
  ```
  Buat file `.env` (lihat `.env.example`) berisi `GEMINI_API_KEY=...`, lalu buka URL yang ditampilkan `vercel dev`.

## Struktur

```
api/
  generate.js   # proxy teks Gemini (gemini-2.5-flash)
  image.js      # proxy gambar Imagen
src/
  App.tsx       # UI utama
  main.tsx
  index.css
```
