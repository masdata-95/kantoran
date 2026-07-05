---
module: fin-pnl-dasar
slug: fin-pnl-02-excel-finance
title: Disiplin Excel ala Tim Finance
type: text
sort_order: 2
xp: 15
---

## Kenapa finance punya aturan Excel sendiri

Di marketing, formula salah berarti laporan kurang akurat. Di finance, formula salah bisa berarti **keputusan miliaran diambil dari angka fiktif** — dan yang menemukan errornya bisa jadi auditor, bukan kamu. Supervisormu pernah menemukan selisih Rp 2 miliar dari satu formula salah. Aturan-aturan di bawah lahir dari kejadian semacam itu.

## Aturan 1: Pisahkan input, perhitungan, dan output

Struktur workbook standar tim:

- **Sheet INPUT** — data mentah dan asumsi. Sel yang boleh diketik manual diberi warna (kuning adalah konvensi umum).
- **Sheet CALC** — semua formula. Tidak ada angka diketik manual di sini. Satu pun.
- **Sheet OUTPUT** — ringkasan yang dibaca orang lain, menarik dari CALC.

Dosa terbesar di finance: **hardcode** — angka diketik langsung di tengah formula (`=B5*1.11+2500000`). Tiga bulan kemudian tidak ada yang tahu 2,5 juta itu apa. Semua angka harus punya "rumah" di sheet input dengan label.

## Aturan 2: Selalu bikin pemeriksa otomatis (check cell)

Tambahkan baris pengecekan yang harus bernilai nol:

```
Check: =Total_versi_A - Total_versi_B   → harus 0
Check: =SUM(rincian) - Angka_ringkasan  → harus 0
```

Beri format merah kalau tidak nol (Conditional Formatting). Kamu akan tergoda melewatkan ini saat buru-buru — jangan. Check cell adalah alarm kebakaranmu.

## Aturan 3: Formula finance yang paling sering dipakai

| Kebutuhan | Formula |
|---|---|
| Jumlah dengan syarat (akun, bulan, entitas) | `SUMIFS` |
| Ambil angka dari mapping akun | `XLOOKUP` / `VLOOKUP` |
| Variance realisasi vs budget | `=realisasi - budget` dan `=realisasi/budget - 1` (%) |
| Pertumbuhan | `=akhir/awal - 1` |
| Pembulatan laporan | `ROUND(angka; -6)` untuk jutaan — jangan biarkan Excel "menyimpan" desimal diam-diam |

Untuk variance, tampilkan **nilai dan persen berdampingan**. Variance Rp 50 juta itu besar untuk biaya ATK, tapi tidak berarti untuk revenue 100 miliar.

## Aturan 4: Jejak yang bisa diaudit

- Beri nama file dengan versi dan tanggal: `PnL_Juni_v3_2026-07-04.xlsx` — bukan `final_fix_beneran.xlsx`.
- Jangan menimpa file periode lalu. Copy dulu.
- Kalau mengubah asumsi, catat di sheet catatan: apa yang diubah, kapan, kenapa.

Auditor (dan supervisormu) tidak hanya bertanya "berapa angkanya", tapi "**dari mana angka ini**". Workbook yang rapi menjawab sendiri.

> Lanjut ke misi: kamu akan menganalisis P&L mini yang variance-nya mencurigakan.
