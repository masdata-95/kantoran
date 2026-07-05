---
module: da-excel-dasar
slug: da-excel-02-formula
title: Formula Inti — VLOOKUP, XLOOKUP, SUMIFS
type: video
sort_order: 2
xp: 15
# youtube_video_id: isi di Supabase Studio nanti (video Excel lama @masdata)
---

## Tiga formula yang menyelesaikan 70% kerjaan

Analis data di FMCG intinya sering melakukan dua hal: **mencocokkan data antar tabel** (lookup) dan **menjumlah dengan syarat** (conditional sum). Kuasai tiga formula ini dulu, sisanya menyusul.

### 1. VLOOKUP — mencari data dari tabel lain

```
=VLOOKUP(nilai_dicari; tabel_sumber; nomor_kolom; FALSE)
```

Contoh kasus nyata: kamu punya data penjualan berisi kode produk, dan tabel master berisi kode + nama + kategori. VLOOKUP menarik nama produk ke data penjualanmu.

```
=VLOOKUP(A2; Master!A:C; 2; FALSE)
```

Aturan main:
- **Selalu pakai FALSE** di argumen terakhir (pencocokan persis). TRUE hampir tidak pernah kamu butuhkan dan sering menghasilkan jawaban salah diam-diam.
- Nilai yang dicari harus ada di **kolom pertama** tabel sumber.
- Hasil `#N/A` artinya tidak ketemu — sering karena spasi tersembunyi (balik ke materi cleaning!).

### 2. XLOOKUP — versi modern yang lebih aman

```
=XLOOKUP(nilai_dicari; kolom_pencarian; kolom_hasil; "tidak ketemu")
```

Kelebihannya: bisa mencari ke arah mana pun, dan punya argumen ke-4 untuk pesan kalau tidak ketemu (tidak perlu IFERROR). Kalau Excel-mu mendukung, pakai ini. Tapi VLOOKUP tetap wajib bisa karena file warisan kantor penuh dengan itu.

### 3. SUMIFS — menjumlah dengan banyak syarat

```
=SUMIFS(kolom_yang_dijumlah; kolom_syarat1; syarat1; kolom_syarat2; syarat2)
```

Contoh: total penjualan Lumière di channel e-commerce:

```
=SUMIFS(D:D; B:B; "Lumière"; C:C; "E-commerce")
```

Saudaranya yang sering dipakai bareng: `COUNTIFS` (menghitung baris) dan `AVERAGEIFS` (rata-rata bersyarat).

## Pola pikir yang lebih penting dari hafalan

Sebelum menulis formula, ucapkan dulu kalimatnya dalam bahasa manusia: *"Saya mau total kolom penjualan, untuk baris yang brand-nya Lumière dan channel-nya e-commerce."* Kalimat itu hampir 1:1 jadi SUMIFS. Analis yang kesulitan formula biasanya bukan tidak hafal sintaks, tapi belum jelas mau menghitung apa.

## Jebakan umum

| Gejala | Penyebab tersering |
|---|---|
| #N/A padahal datanya ada | Spasi tersembunyi atau tipe data beda (teks vs angka) |
| Hasil VLOOKUP salah tapi tidak error | Lupa FALSE, atau nomor kolom salah |
| SUMIFS hasilnya 0 | Syarat tidak persis sama ("Lumiere" vs "Lumière") |
| Formula benar tapi berubah saat di-copy | Lupa kunci referensi dengan `$` (misal `$A$2:$C$100`) |

> Di misi modul ini kamu akan pakai ketiganya sekaligus. Kalau video di atas belum tersedia, materi teks ini sudah cukup untuk mengerjakannya.
