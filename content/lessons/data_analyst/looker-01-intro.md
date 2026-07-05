---
module: da-looker-dasar
slug: da-looker-01-intro
title: Kenalan dengan Looker Studio
type: video
sort_order: 1
xp: 15
# youtube_video_id: isi di Supabase Studio nanti (video Looker Studio lama @masdata)
---

## Apa itu Looker Studio, dan kenapa tim kita pakai

Looker Studio (dulu Google Data Studio) adalah tool **gratis** dari Google untuk membuat dashboard interaktif. Bayangkan pivot table dan chart Excel, tapi: selalu ter-update otomatis, bisa dibuka siapa saja lewat link, dan tampilannya layak dibawa ke rapat direksi.

Di Vantara, dashboard penjualan bulanan dan dashboard campaign semuanya di Looker Studio. Direksi tidak membuka file Excel — mereka membuka link.

## Konsep dasar: 3 lapisan

1. **Data source** — dari mana datanya. Paling umum: Google Sheets. Bisa juga BigQuery, Google Analytics, atau upload CSV.
2. **Report** — kanvas tempat kamu menyusun visual, bisa banyak halaman.
3. **Chart** — setiap visual di kanvas: scorecard, time series, bar, pie, tabel.

Alur kerjanya: siapkan data rapi di Google Sheets → hubungkan sebagai data source → susun chart di report.

## Dua istilah yang wajib paham

- **Dimension** (hijau): kategori/label — brand, channel, bulan, provinsi. Jawaban dari "per apa?"
- **Metric** (biru): angka yang dihitung — penjualan, unit, jumlah transaksi. Jawaban dari "berapa?"

Setiap chart pada dasarnya kombinasi keduanya. Bar chart "penjualan per brand" = dimension brand + metric penjualan. Kalau kamu paham pivot table, ini konsep yang sama: dimension = Rows, metric = Values.

## Aturan data source yang menghemat banyak air mata

Looker Studio menyukai data berformat **tabel panjang (long format)**: satu baris = satu kejadian, header satu baris di paling atas, tanpa merge cell, tanpa baris total.

| ✅ Bagus | ❌ Bikin masalah |
|---|---|
| Tanggal, Brand, Channel, Penjualan | Kolom terpisah per bulan (Jan, Feb, Mar...) |
| Satu header di baris 1 | Header dobel, judul di atas tabel |
| Angka murni | Angka dicampur teks ("Rp 5 juta") |

Kalau dashboard-mu aneh, 80% masalahnya ada di data source, bukan di Looker-nya.

## Coba sendiri (10 menit)

1. Buka [lookerstudio.google.com](https://lookerstudio.google.com) dengan akun Google.
2. Blank report → Add data → Google Sheets → pilih sheet apa saja yang berisi tabel sederhana.
3. Insert → Table, lalu Insert → Scorecard. Perhatikan bagaimana dimension dan metric mengubah tampilannya.

> Materi berikutnya: menyusun dashboard yang benar-benar dipakai orang — bukan sekadar kumpulan chart warna-warni.
