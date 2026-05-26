# Vantara — Landing + Kantoran Simulator

Web statis + satu serverless function untuk menyembunyikan Groq API key.
Kedua halaman (landing & simulator) memakai proxy yang sama.

## Struktur
```
project/
├── index.html                  # Landing page + demo chat AI (model llama-3.3-70b-versatile)
├── kantoran_simulator.html     # Simulator (model llama-3.1-8b-instant)
├── api/
│   └── groq.js                 # Proxy serverless — memegang key dengan aman
├── .gitignore
└── .env.example
```
Kedua HTML memanggil `/api/groq`. Proxy meneruskan apa pun model yang dikirim,
jadi satu function melayani keduanya.

## Cara Deploy ke Vercel

### 1. Cabut key lama dulu (PENTING)
Key yang pernah ada di simulator sudah bocor. Buka https://console.groq.com →
hapus key lama → buat key baru.

### 2. Push ke GitHub
```bash
cd project
git init
git add .
git commit -m "Vantara landing + simulator dengan proxy"
git remote add origin <URL_REPO_KAMU>
git push -u origin main
```
Push berhasil karena tidak ada lagi key di dalam kode.

### 3. Set Environment Variable di Vercel
- Import repo di https://vercel.com
- Buka Settings → Environment Variables
- Tambah: Name = GROQ_API_KEY, Value = key baru kamu
- Deploy (atau re-deploy)

Selesai. index.html adalah halaman utama; tombol "Coba Demo" mengarah ke
kantoran_simulator.html. Keduanya memanggil key lewat /api/groq.

## Testing Lokal
```bash
npm i -g vercel
vercel dev        # set GROQ_API_KEY di .env.local dulu
```
Membuka file HTML lewat double-click TIDAK akan jalan karena /api/groq butuh server.
