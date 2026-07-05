---
module: mkt-campaign-dasar
slug: mkt-campaign-02-analisis
title: Menganalisis Campaign di Spreadsheet
type: text
sort_order: 2
xp: 15
---

## Dari export platform ke insight

Data campaign biasanya di-export dari platform iklan (Meta, TikTok, Google) ke spreadsheet. Mentahnya per hari per iklan — ratusan baris yang belum bercerita apa-apa. Tugasmu menyusunnya jadi jawaban.

## Susun tabel kerjamu seperti ini

Satu baris = satu iklan per periode, dengan kolom minimal:

| Campaign | Konten | Budget | Impressions | Klik | Pembelian | Revenue |
|---|---|---|---|---|---|---|
| Lumière Awareness | Video A | 3jt | 400rb | 6rb | 90 | 8jt |
| Lumière Awareness | Video B | 3jt | 380rb | 9rb | 150 | 14jt |

Lalu **hitung sendiri** metrik turunannya di kolom baru (CTR, CPA, ROAS) pakai formula. Jangan hanya menyalin angka dari dashboard platform — platform kadang menghitung dengan definisi berbeda (klik semua vs klik tautan, misalnya), dan kamu harus tahu persis apa yang kamu bandingkan.

## Tiga analisis standar tim Vantara

**1. Bandingkan antar konten (mana yang menang).**
Urutkan berdasarkan ROAS atau CPA. Di contoh atas, Video B menghasilkan pembelian 66% lebih banyak dengan budget sama — pindahkan budget ke sana. Keputusan sesederhana ini sering menghemat jutaan rupiah per bulan.

**2. Lihat tren per minggu (kapan mulai lelah).**
Buat pivot: minggu di baris, CTR di nilai. Iklan yang sama ditayangkan terus akan turun CTR-nya (audiens bosan). Kalau CTR turun >30% dari puncaknya, saatnya ganti materi.

**3. Breakdown per audiens/penempatan.**
Iklan yang sama bisa ROAS 5 di satu audiens dan 0,8 di audiens lain. Tanpa breakdown, angka gabungannya kelihatan "lumayan" padahal setengah budget-mu terbakar sia-sia.

## Menulis rekomendasi (bagian yang dibaca atasan)

Format yang dipakai di tim: **temuan → angka → usulan.**

> "Video B mengungguli Video A: CPA Rp 20rb vs Rp 33rb, ROAS 4,7 vs 2,7. Usul: alihkan 70% budget Video A ke Video B mulai minggu depan, dan brief konten baru dengan gaya serupa Video B (fokus testimoni before-after)."

Bandingkan dengan laporan yang hanya bilang "Video B performanya lebih bagus". Yang pertama bisa langsung dieksekusi; yang kedua memancing rapat tambahan.

## Jebakan yang harus dihindari

- **Menilai terlalu cepat.** 2 hari data belum bercerita, minimal 1 minggu atau beberapa ratus klik.
- **Membandingkan campaign beda tujuan.** Awareness vs penjualan itu beda liga.
- **Lupa margin.** ROAS 2,5 kedengaran untung, tapi kalau margin produk 40%, itu masih rugi setelah biaya produk.

> Lanjut ke misi: kamu akan menganalisis hasil dua konten iklan dan memberi rekomendasi ke Dinda.
