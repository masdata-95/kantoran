---
module: da-excel-dasar
slug: da-excel-03-pivot
title: Pivot Table — Dari Ribuan Baris Jadi Insight
type: video
sort_order: 3
xp: 15
# youtube_video_id: isi di Supabase Studio nanti (video Excel lama @masdata)
---

## Kenapa pivot adalah senjata utama

Data penjualan Vantara sebulan bisa puluhan ribu baris. Tidak ada manusia yang bisa "membaca" itu. Pivot table mengubahnya jadi ringkasan dalam 30 detik: penjualan per brand, per channel, per bulan — tanpa satu formula pun.

## Cara membuat (60 detik)

1. Klik di mana saja di dalam datamu.
2. `Insert → PivotTable → OK` (biarkan default: sheet baru).
3. Muncul 4 kotak: **Rows, Columns, Values, Filters**.

Cara berpikirnya:

| Kotak | Pertanyaannya | Contoh |
|---|---|---|
| Rows | Dikelompokkan per apa? | Brand |
| Columns | Dibandingkan antar apa? | Channel |
| Values | Angka apa yang dihitung? | Total penjualan |
| Filters | Mau lihat sebagian saja? | Bulan tertentu |

Drag "Brand" ke Rows, "Channel" ke Columns, "Penjualan" ke Values — jadi. Kamu baru saja menjawab "brand mana paling laku di channel mana" dari ribuan baris.

## 4 trik yang dipakai tiap hari di tim

**1. Ganti cara hitung.** Klik kanan angka di Values → `Summarize Values By` → Sum, Count, Average. Default kadang Count padahal kamu mau Sum — selalu cek.

**2. Tampilkan sebagai persen.** Klik kanan → `Show Values As → % of Grand Total`. "E-commerce menyumbang 34% penjualan" jauh lebih bermakna daripada angka mentah.

**3. Kelompokkan tanggal.** Klik kanan kolom tanggal di pivot → `Group` → pilih Months. Data harian langsung jadi tren bulanan.

**4. Refresh, bukan bikin ulang.** Data sumber berubah? Klik kanan pivot → `Refresh`. Kalau barisnya bertambah, pakai format Table (`Ctrl+T`) di data sumber supaya pivot otomatis mencakup baris baru.

## Dari pivot ke insight

Pivot hanya menyusun angka. Tugasmu membaca **anomalinya**:

- Ada sel yang jauh lebih besar/kecil dari sekitarnya? Kenapa?
- Tren yang tiba-tiba patah di bulan tertentu? Ada apa bulan itu?
- Kombinasi yang kosong? (Brand X tidak ada penjualan di channel Y — memang tidak dijual di sana, atau datanya hilang?)

Laporan analis pemula berhenti di "ini tabelnya". Analis yang dipromosikan menulis: "Roots&Co turun 20% di GT sejak Maret, kemungkinan efek stok kosong di distributor Jawa Timur — perlu cek data distribusi."

> Tiga materi Excel selesai. Lanjut ke misi modul ini — kamu akan dapat file kecil dari supervisormu dan latihan menemukan insight sendiri.
