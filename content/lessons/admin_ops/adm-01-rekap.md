---
module: adm-excel-dasar
slug: adm-excel-01-rekap
title: Rekap yang Bisa Dipercaya
type: video
sort_order: 1
xp: 15
# youtube_video_id: isi di Supabase Studio nanti
---

## Kerjaan admin = kerjaan kepercayaan

Rekap yang kamu buat akan dipakai orang lain untuk mengambil keputusan: Finance menagih berdasarkan rekapmu, manager menandatangani berdasarkan rekapmu. Kalau rekapmu salah, kesalahannya menyebar ke semua orang yang memakainya. Makanya standar pertama tim ini bukan "cepat", tapi **bisa dipercaya**.

## Tiga kebiasaan wajib sebelum menyentuh data

### 1. Jangan pernah kerja di file asli
Duplikat dulu sheet-nya (klik kanan tab → Move or Copy → Create a copy). Data mentah adalah bukti; kalau ada yang bertanya "angka ini dari mana", kamu selalu bisa menunjukkan sumbernya utuh.

### 2. Kenali datanya sebelum merekap
- Berapa baris? Kolom apa saja? (Ctrl+End melompat ke sel terakhir)
- Sortir tiap kolom penting sekali putaran: nilai aneh biasanya muncul di paling atas atau paling bawah setelah disortir (kosong, nol, minus, tanggal janggal).

### 3. Setiap angka rekap harus bisa dilacak
Rekap yang baik selalu bisa dijawab: "angka 12.400.000 ini datang dari baris mana saja?" Pakai SUMIF/SUMIFS, bukan menjumlah manual dengan kalkulator.

## Formula inti admin (sedikit tapi dalam)

| Kebutuhan | Formula |
|---|---|
| Jumlah per kategori | `=SUMIF(B:B, "UD Berkah Jaya", D:D)` |
| Hitung baris per kategori | `=COUNTIF(B:B, "UD Berkah Jaya")` |
| Selisih dua kolom | `=D2-G2` lalu tarik ke bawah |
| Tandai baris bermasalah | `=IF(D2<>G2, "CEK", "")` |

Empat formula ini menutup 80% kebutuhan rekap harian. Kuasai betul sebelum melirik yang lain.
