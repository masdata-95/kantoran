---
module: adm-excel-dasar
slug: adm-excel-03-misi
title: "Misi: Validasi Rekap Pembayaran"
type: mission
sort_order: 3
xp: 30
mission_brief: |
  Latihan sebelum pegang invoice beneran. Bayangkan kamu terima file berisi 100+ baris tagihan distributor: nomor invoice, nama distributor, nilai tagihan, jatuh tempo, tanggal bayar, dan jumlah dibayar. Aku minta rekap status pembayaran per distributor, plus daftar pencatatan yang janggal.

  Jelaskan langkah kerjamu urut dari awal: apa yang kamu amankan dulu, bagaimana kamu menemukan duplikat dan data kosong, bagaimana kamu menghitung selisih bayar, dan seperti apa bentuk laporan akhirmu. Tulis seperti menjelaskan rencana kerja ke aku, bukan teori.
must_find:
  - Menyebut mengamankan data asli dulu (duplikat sheet atau copy file sebelum mengubah apa pun)
  - Menyebut cara menemukan duplikat (conditional formatting duplicate values, COUNTIF, atau sortir nomor invoice)
  - Menyebut cara menemukan selisih pembayaran (kolom bantu invoice dikurangi dibayar, atau perbandingan sejenis)
good_to_mention:
  - Menyebut cara menemukan sel kosong (Go To Special Blanks atau filter blanks)
  - Format laporan temuan yang jelas (apa, di baris mana, nilainya, perlu konfirmasi ke siapa)
  - Menyebut SUMIF/SUMIFS untuk rekap per distributor
---

Misi penutup modul. Baca brief dari Mbak Sari, lalu tulis rencana kerjamu. Yang dinilai **urutan berpikirmu** — persis seperti yang akan kamu pakai di task pertama nanti.
