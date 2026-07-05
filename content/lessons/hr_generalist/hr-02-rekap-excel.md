---
module: hr-rekrutmen-dasar
slug: hr-02-rekap-excel
title: Rekap Data Karyawan yang Rapi
type: text
sort_order: 2
xp: 15
---

## Data karyawan = database, bukan formulir

Kesalahan klasik rekap HR: file Excel yang dibuat seperti formulir cetak — merge cell di mana-mana, satu sheet per departemen, warna-warni tanpa arti. Kelihatan rapi, tapi tidak bisa dianalisis. Prinsipnya satu: **satu baris = satu karyawan, satu kolom = satu atribut.**

## Struktur master data karyawan Vantara

| NIK | Nama | Departemen | Posisi | Level | Tgl Masuk | Status | Gaji | Tgl Resign |
|---|---|---|---|---|---|---|---|---|
| V-0231 | Sari | Marketing | Analyst | Junior | 2025-03-01 | Aktif | ... | |
| V-0198 | Bimo | Finance | Analyst | Mid | 2024-11-15 | Resign | ... | 2026-05-31 |

Aturan yang tidak boleh dilanggar:

1. **Tanpa merge cell.** Merge = pivot rusak, filter rusak, sort rusak.
2. **Satu master file.** Bukan satu file per departemen — pisahkan lewat filter/pivot, bukan lewat file.
3. **Kategori konsisten.** "Marketing" atau "MKT", pilih satu. Pakai Data Validation (dropdown) supaya input baru tidak liar.
4. **Tanggal dalam format tanggal** (bukan teks "1 Maret 2025") supaya bisa dihitung.
5. **Data gaji dipisah** di file ber-password dengan akses terbatas. Bocornya data gaji adalah krisis kepercayaan — dan sejak UU PDP, juga masalah hukum.

## Analisis rutin yang diminta manajemen

**Headcount per departemen** — pivot sederhana: departemen di Rows, hitung NIK di Values.

**Turnover rate** — karyawan resign dibagi rata-rata jumlah karyawan periode itu:
```
Turnover = resign dalam periode ÷ rata-rata headcount × 100%
```
Yang lebih penting dari angkanya: **siapa** yang keluar. Turnover 10% yang isinya karyawan terbaik lebih gawat dari 15% yang campur.

**Masa kerja (tenure)** — `=DATEDIF(TglMasuk; TODAY(); "Y")` untuk tahun. Pivot rata-rata tenure per departemen menunjukkan tim mana yang tidak bisa mempertahankan orang.

**Analisis exit** — pivot alasan resign (dari exit interview) per departemen. Kalau satu departemen dominan dengan alasan yang sama, itu bukan kebetulan — itu temuan yang harus dibawa ke manajemen.

## Prinsip kerahasiaan

Kamu akan memegang data yang sensitif: gaji, penilaian, alasan resign, kadang masalah pribadi. Standarnya sederhana: **bagikan seminimal yang dibutuhkan, ke sesedikit mungkin orang, dan jangan pernah jadikan bahan obrolan pantry** — bahkan yang kelihatannya remeh.

> Lanjut ke misi: menganalisis funnel rekrutmen yang bermasalah dan memberi rekomendasi ke Bu Ratna.
