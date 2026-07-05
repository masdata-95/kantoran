---
module: da-excel-dasar
slug: da-excel-01-cleaning
title: Data Cleaning — 80% Kerjaan Analis
type: video
sort_order: 1
xp: 15
# youtube_video_id: isi di Supabase Studio nanti (video Excel lama @masdata)
---

## Kenapa cleaning duluan?

Data yang masuk ke tim kita **hampir tidak pernah bersih**: nama produk ditulis 3 versi berbeda, ada spasi tersembunyi, tanggal campur format, angka tersimpan sebagai teks. Analisis secanggih apa pun jadi sampah kalau datanya salah. Makanya materi pertama bukan formula keren, tapi ini.

## Checklist cleaning standar tim Vantara

Setiap terima file baru, jalankan urutan ini:

### 1. Kenali dulu datanya
- Berapa baris, berapa kolom? Kolom apa saja?
- Scroll cepat: ada yang aneh? Baris kosong? Header dobel?

### 2. Buang duplikat
`Data → Remove Duplicates`. Tapi **hati-hati**: pastikan dulu duplikatnya memang error input, bukan dua transaksi asli yang kebetulan sama.

### 3. Bersihkan teks
| Masalah | Solusi |
|---|---|
| Spasi berlebih ("Lumière  Serum ") | `=TRIM(A2)` |
| Huruf besar-kecil kacau | `=PROPER(A2)` atau `=UPPER(A2)` |
| Gabungan spasi aneh dari sistem | `=TRIM(SUBSTITUTE(A2,CHAR(160)," "))` |

Spasi tersembunyi itu musuh nomor satu — dua sel kelihatan sama tapi VLOOKUP bilang beda. Supervisormu pernah stuck 3 hari gara-gara ini. Beneran.

### 4. Seragamkan kategori
"DKI Jakarta", "Jakarta", "JKT" harus jadi satu versi. Cara cepat: bikin pivot dari kolom itu untuk melihat semua variasi yang ada, lalu rapikan dengan Find & Replace.

### 5. Cek tipe data
- Angka rata kiri = kemungkinan tersimpan sebagai teks. Perbaiki: `=VALUE(A2)` atau Text to Columns.
- Tanggal: samakan format, cek tidak ada yang tertukar bulan-harinya.

### 6. Tangani data kosong
Jangan langsung dihapus. Tanya dulu: kosong karena **memang tidak ada**, atau karena **gagal tercatat**? Keputusannya beda. Kalau ragu, tandai dan tanyakan ke pemilik data.

## Kebiasaan yang menyelamatkan karir

**Jangan pernah kerja di file asli.** Duplikat dulu sheet-nya (`klik kanan tab → Move or Copy → Create a copy`). Kalau cleaningmu salah arah, kamu masih punya data mentah.

> Simpan checklist ini. Di task pertamamu nanti, file yang kamu terima sudah "disisipi" masalah-masalah di atas. Sekarang kamu tahu harus cari apa.
