---
module: adm-excel-dasar
slug: adm-excel-02-validasi
title: Menemukan yang Janggal, Duplikat, Kosong, Selisih
type: video
sort_order: 2
xp: 15
# youtube_video_id: isi di Supabase Studio nanti
---

## Data operasional selalu ada yang janggal

Invoice dobel karena diinput dua orang, tanggal jatuh tempo lupa diisi, pembayaran masuk tapi jumlahnya kurang. Tugasmu bukan berasumsi datanya benar, tapi **membuktikan** mana yang benar. Ini cara sistematisnya:

### Menemukan duplikat (tanpa scroll manual)
1. Blok kolom kunci (mis. nomor invoice)
2. **Home → Conditional Formatting → Highlight Cells Rules → Duplicate Values**
3. Semua nilai kembar langsung menyala. Cek satu-satu: duplikat input, atau memang dua transaksi asli?

Jangan langsung Remove Duplicates sebelum yakin — menghapus transaksi asli lebih berbahaya daripada membiarkan duplikat.

### Menemukan sel kosong
1. Blok kolom yang wajib terisi (mis. jatuh tempo)
2. **Ctrl+G → Special → Blanks** — semua sel kosong terseleksi sekaligus
3. Atau pakai filter: klik panah kolom → hilangkan centang semua → centang "(Blanks)"

### Menemukan selisih pembayaran
Tambahkan kolom bantu: `=nilai_invoice - jumlah_dibayar`. Sortir dari terbesar. Baris dengan selisih bukan nol adalah daftar tagihanmu — dan kalau satu distributor muncul berulang kali di daftar itu, kamu baru saja menemukan masalah yang lebih besar dari sekadar angka.

### Laporkan temuan, bukan tuduhan
Format laporan janggal yang baik: **apa yang ditemukan, di baris mana, berapa nilainya, dan perlu dicek ke siapa.** "Invoice INV-00123 tercatat dua kali senilai Rp 8,4 juta, perlu konfirmasi ke tim input" jauh lebih berguna daripada "datanya kacau".
