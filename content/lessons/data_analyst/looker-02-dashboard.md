---
module: da-looker-dasar
slug: da-looker-02-dashboard
title: Menyusun Dashboard yang Dipakai Orang
type: video
sort_order: 2
xp: 15
# youtube_video_id: isi di Supabase Studio nanti (video Looker Studio lama @masdata)
---

## Dashboard bagus menjawab pertanyaan, bukan memajang chart

Kesalahan analis pemula: memasukkan semua chart yang bisa dibuat. Hasilnya dashboard ramai yang tidak dibaca siapa pun. Mulailah dari pertanyaan penggunanya:

- Direksi: *"Bulan ini kita on-track atau tidak?"*
- Manager: *"Bagian mana yang bermasalah?"*
- Analis (kamu): *"Kenapa bisa begitu?"*

## Struktur standar dashboard tim Vantara

Susun dari atas ke bawah, dari ringkas ke detail:

**Baris 1 — Scorecard (angka besar).** 3-5 metrik utama: total penjualan, pertumbuhan MoM, unit terjual. Pakai fitur *comparison* supaya ada panah naik/turun vs periode lalu. Ingat pelajaran bisnis: angka tanpa pembanding bukan informasi.

**Baris 2 — Tren waktu.** Satu time series penjualan per bulan/minggu. Ini chart yang paling sering dilihat orang. Tambahkan breakdown dimension (brand) kalau perlu, tapi maksimal 3-4 garis — lebih dari itu jadi mie.

**Baris 3 — Perbandingan.** Bar chart: penjualan per brand, per channel, atau per region. Urutkan dari terbesar (sort descending), jangan urut abjad.

**Baris 4 — Tabel detail.** Untuk yang mau menelusuri angka. Aktifkan heatmap di kolom nilai supaya pola langsung terlihat.

**Pojok kanan atas — Filter.** Date range control + dropdown brand/channel. Satu dashboard bisa menjawab banyak pertanyaan kalau filternya benar.

## Aturan visual yang tidak boleh dilanggar

1. **Satu halaman, satu topik.** Penjualan dan campaign jangan dicampur satu halaman — pakai halaman terpisah.
2. **Konsisten warna.** Lumière selalu warna yang sama di semua chart. Kalau tidak, pembaca harus belajar ulang tiap chart.
3. **Judul chart = kesimpulan,** bukan nama data. "Penjualan turun di GT sejak Maret" lebih berguna daripada "Grafik Penjualan per Channel".
4. **Buang hiasan.** Gridline tebal, 3D, bayangan — hapus. Tinta sebanyak-banyaknya untuk data, sesedikit-sedikitnya untuk dekorasi.

## Checklist sebelum share link

- [ ] Data range default masuk akal (bulan berjalan, bukan "semua waktu")
- [ ] Semua chart sudah dites dengan filter ekstrem (satu brand, satu minggu)
- [ ] Angka scorecard cocok dengan sumber (validasi manual minimal sekali!)
- [ ] Akses view sudah dibuka untuk yang berkepentingan

> Selesai dua materi Looker. Kombinasikan dengan Excel: rapikan data di spreadsheet, sajikan di Looker Studio. Itu alur kerja harian analis Vantara.
