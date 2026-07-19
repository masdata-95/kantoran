---
slug: da-day2-dashboard
position_id: data_analyst
day: 2
sort_order: 1
title: Dashboard Penjualan untuk Rapat Direksi
task_type: file
file_name: task_da_day2.xlsx
teaser: Diana butuh dashboard dari data yang kamu bersihkan kemarin, dipresentasikan langsung ke jajaran direksi.
context: Rapat direksi besok jam 9. Diana presentasi pakai halamanmu, dan tim Finance ikut hadir membawa angka mereka sendiri.
cross_ref: Diana bilang tim Finance juga hadir, angkamu harus cocok sama angka mereka.
approved_reaction: Solid. Ringkas, insight-nya kena, dan kamu nggak buang waktu direksi. Aku forward ke Diana sekarang, jangan kaget kalau besok namamu disebut di rapat.
revision_reaction: Belum. Direksi nggak baca tabel mentah, dan mereka nggak peduli angka yang nggak ada artinya. Lihat lagi catatanku, perbaiki, kirim ulang sebelum jam 8.
rubric:
  intern:
    must_find:
      - Tren revenue per brand H1 2026 teridentifikasi dengan benar
      - Top 5 SKU berdasarkan revenue dengan angka yang akurat
      - Format ringkas satu halaman, bukan tabel mentah yang dicopy
    good_to_mention:
      - Menyebut cara angka dihitung (pivot per brand/bulan)
      - Menyebut keterbatasan data yang disadari
  junior:
    must_find:
      - Tren revenue per brand H1 2026 teridentifikasi dengan benar
      - Top 5 SKU berdasarkan revenue dengan angka yang akurat
      - "Insight margin: margin Lumière turun konsisten (sekitar 42% ke 33%) padahal revenue-nya tetap terbesar, penjualan sehat menyembunyikan margin yang tergerus"
      - Format ringkas siap presentasi, kesimpulan bisa ditangkap dalam sekali baca
    good_to_mention:
      - Rekomendasi tindak lanjut yang actionable (investigasi harga/promo/biaya Lumière)
      - Antisipasi pertanyaan direksi (kenapa margin turun, sejak kapan)
      - Menyebut perlunya cek silang angka dengan tim Finance
  mid:
    must_find:
      - "Insight margin Lumière ditemukan DAN dikuantifikasi dampaknya ke profit (bukan sekadar disebut)"
      - Struktur naratif eksekutif, kesimpulan dan rekomendasi di depan, angka pendukung menyusul
      - Rekomendasi dengan trade-off yang jelas (misal tahan promo vs pertahankan volume)
      - Tren brand dan top SKU hadir sebagai pendukung argumen, bukan pusat laporan
    good_to_mention:
      - Skenario what-if sederhana (kalau margin terus turun 1.8 poin per bulan, dampak Q3)
      - Risiko kualitas data disebut proaktif sebelum ditanya
      - Mengaitkan temuan ke keputusan budget Q3 yang sedang disusun
---
Data yang kemarin kamu bersihin dipakai Diana besok pagi di rapat direksi. Aku butuh satu halaman ringkas: tren penjualan per brand, top 5 SKU, dan satu insight yang menurutmu direksi HARUS tahu.

Di file-nya ada kolom baru, margin_pct. Kamu belum pernah pegang itu, tapi analis yang baik nggak nunggu disuruh melihat kolom baru.

Jangan kirim tabel mentah, direksi nggak baca tabel. Kumpulkan sebagai sheet Ringkasan di file yang sama, upload di Workspace sebelum jam 8 besok.
