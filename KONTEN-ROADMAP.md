# Roadmap Kedalaman Konten — Kantoran

> Dibuat 12 Juli 2026. Konten adalah alasan orang bertahan dan memperpanjang langganan.
> Dokumen ini adalah desain "Season 1" (3 bulan cerita) untuk kelima posisi,
> termasuk cara semua posisi saling berhubungan dalam satu perusahaan yang hidup.

## 1. Prinsip desain konten

1. **Experience, bukan materi.** Setiap konten dibungkus kejadian: task datang dari orang, dengan deadline, dengan konsekuensi. Tidak pernah "modul 3: pivot table" telanjang.
2. **Non-basic sejak hari kedua.** Hari 1 = onboarding + task dasar (sudah ada). Mulai hari 2, semua study case punya komplikasi: data yang menyesatkan, stakeholder yang menekan, trade-off tanpa jawaban tunggal.
3. **Satu perusahaan, satu timeline.** Kelima divisi hidup di kalender yang sama. Kejadian besar (krisis, launch, audit) terasa di semua posisi — dari sudut berbeda.
4. **Konsekuensi menginap.** Keputusan user di satu task disebut lagi oleh NPC di task berikutnya. Ini yang membuat "3 bulan simulasi" terasa seperti karir, bukan playlist.
5. **Rubric selalu di server.** Semua jawaban dinilai dengan mustFind/goodToMention yang tidak pernah dikirim ke client (pola yang sudah dipakai `taskRubric` + misi Academy).

## 2. Arsitektur Season 1 (3 bulan cerita)

Season 1 = **4 arc** × ±2 minggu cerita. Satu hari simulasi tidak harus = satu hari nyata; user menyelesaikan 1 hari kerja per sesi (20-40 menit).

| Arc | Nama | Kejadian perusahaan | Hari simulasi |
|-----|------|--------------------|----------------|
| 1 | **Kasus Region Timur** | Penjualan Jatim anjlok 38%, selisih pembayaran distributor, video komplain viral | Hari 2-7 |
| 2 | **Peluncuran Vanta Glow Men** | Lini produk baru: riset, budget, hiring, kampanye, forecast | Hari 8-14 |
| 3 | **Audit & Efisiensi Q3** | Auditor internal masuk, semua divisi diminta data & justifikasi | Hari 15-21 |
| 4 | **Ekspansi Indonesia Timur** | Keputusan go/no-go besar; semua pekerjaan arc 1-3 jadi bahan | Hari 22-30 + performance review season |

Kenapa arc: (a) cliffhanger alami tiap akhir arc = momen perpanjang langganan; (b) satu arc bisa ditulis dan dirilis bertahap tanpa menunggu 90 hari konten jadi.

## 3. Arc 1 — Kasus Region Timur (detail, prioritas produksi pertama)

Satu kejadian, lima sudut pandang. Benihnya SUDAH ditanam di `upcomingTasks` (teaser day 2-7 di lib/positions.ts, diperbarui 12 Juli 2026 agar saling menyebut).

**Cerita induk:** Distributor UD Berkah Jaya (Jatim) menahan pembayaran dan menimbun stok kedaluwarsa. Penjualan resmi anjlok, produk lama beredar, konsumen komplain di TikTok, angka Finance tidak balance. Tidak ada satu divisi pun yang melihat gambar utuh — kecuali user yang main lebih dari satu posisi.

| Posisi | Hari 2 | Hari 3 | Hari 5 | Hari 7 |
|--------|--------|--------|--------|--------|
| Data Analyst | Dashboard penjualan untuk direksi (data yang kemarin ia bersihkan) | Investigasi anomali Jatim: -38%, pola per SKU & channel | Forecast Q3 — angka Jatim bikin model bias, harus di-adjust | Performance review |
| Marketing | Brief campaign Lebaran Rp 2M | Krisis video komplain 800rb views — batch produk dari region timur | A/B test landing Roots&Co | Performance review |
| Finance | Closing bulanan, rekonsiliasi kas | Selisih Rp 80jt — jejak ke pembayaran distributor timur | Proyeksi cashflow 6 bulan (ekspansi menunggu) | Performance review |
| HR | Interview kandidat Junior DA (shortlist buatannya sendiri) | Exit interview mendadak — sales rep region timur resign, tahu sesuatu | Susun onboarding batch baru | Performance review |
| BizDev | Meeting follow-up PT Maju Bersama | Negosiasi: partner minta diskon 25% | Riset ekspansi Indonesia Timur — anomali bikin Pak Anton ragu | Performance review |

**Aturan penulisan interkoneksi:**
- Tiap task menyebut minimal SATU divisi lain by name ("data ini dari tim Rizky", "Finance nunggu angka kamu jam 3").
- Artefak silang: file input task sering merupakan "hasil kerja" divisi lain (mis. file campaign Marketing berisi kolom revenue yang salah — karena di cerita, tim Data belum membersihkannya).
- Kalau user SUDAH menyelesaikan posisi lain (cek `user_progress` per posisi — datanya sudah ada), NPC mengakuinya: "eh kamu yang kemarin bantuin tim Data kan? makanya kamu paham datanya". Hook replay antar posisi yang murah tapi kuat.

## 4. Katalog study case non-basic (bank ide per posisi)

Dipakai untuk mengisi arc 2-4. Semua punya komplikasi, bukan soal latihan.

**Data Analyst**
- Dashboard direksi crash 30 menit sebelum meeting; datanya benar, visualnya menyesatkan (sumbu dipotong). Perbaiki + jelaskan.
- Dua sumber data beda angka (e-commerce dashboard vs internal). Mana yang benar, dan bagaimana menjelaskan ke manager non-teknis.
- Diminta "angka yang mendukung keputusan yang sudah dibuat" oleh manager lain — integritas data vs tekanan. (soft-skill case, dinilai dari cara menolak)
- SQL dasar: ambil sendiri datamu, jangan tunggu tim engineering (masuk Academy day 8).
- Forecast meleset 20% bulan lalu; post-mortem: kenapa, dan apa yang diubah.

**Marketing Analyst**
- Budget dipotong 40% mendadak; realokasi antar channel dengan justifikasi CPA/ROAS.
- Influencer report bagus tapi angka janggal (engagement pattern bot). Buktikan dengan data.
- Brief kreatif untuk agency: menerjemahkan insight data jadi arahan kreatif.
- Kampanye kompetitor menyerang klaim produk; respons dalam 24 jam tanpa perang harga.
- Post-campaign review Lebaran: ROAS bagus tapi repeat purchase jeblok — apa artinya.

**Finance Analyst**
- Vendor menagih 2x untuk PO yang sama; telusuri di data AP.
- Simulasi kenaikan harga bahan baku 12%: dampak ke margin per SKU, rekomendasi harga.
- Anggaran divisi lain minta tambahan mid-quarter; evaluasi & tulis rekomendasi ke CFO.
- Merapikan cash conversion cycle: piutang distributor (nyambung arc 1) makin panjang.
- Menyiapkan data room untuk auditor (arc 3): apa yang boleh/tidak boleh diberikan.

**HR Generalist**
- Dua karyawan konflik terbuka di Slack; mediasi + dokumentasi.
- Menyusun struktur gaji untuk posisi baru (Vanta Glow Men team) dengan benchmark.
- Karyawan star performer minta remote penuh; kebijakan bilang tidak. Rekomendasi.
- Investigasi keluhan (bukan pelecehan — kasus favoritisme) dengan prosedur yang benar.
- Menulis offer letter + nego kandidat yang punya offer kompetitor.

**BizDev**
- Term sheet review: temukan 3 klausa berbahaya (eksklusivitas, penalti, pembayaran).
- Partner besar minta private label — kanibalisasi brand sendiri? Analisis + rekomendasi.
- Pitch deck 5 slide untuk calon partner; dinilai dari struktur argumen, bukan estetika.
- Distributor pengganti UD Berkah Jaya (arc 1): due diligence dari data pembayaran Finance.
- Model komisi baru untuk sales force; hitung dampaknya dengan data Finance.

## 5. Mekanik produk yang perlu dibangun (urutan)

1. ~~**Task per hari pindah ke Supabase**~~ — SELESAI 19 Juli 2026 (migration 006: tabel
   tasks + rubric per level, pipeline content/tasks + seed:tasks, file premium di bucket
   privat via /api/task-file, contoh template da-day2-dashboard.md). Sisa: wiring gameplay.
2. **State "hari" per run** — kolom `sim_day` SUDAH ada (migration 006); logika naik hari
   + task room yang membaca /api/tasks belum di-wire (menyusul bersama pembayaran).
3. **Cross-run awareness** — helper server yang membaca run posisi lain milik user (data sudah ada di `user_progress`) dan menyuntikkan 1 kalimat konteks ke prompt NPC.
4. **Event feed perusahaan** — pesan broadcast di Slack room per arc ("All-hands jam 4: update region timur") supaya kantor terasa hidup di semua posisi. Cukup tabel `events` (day, position_id nullable, text) atau hardcode per arc dulu.
5. **Academy day 2+** — modul lanjutan mengikuti arc (SQL dasar saat arc 1 butuh investigasi; storytelling with data saat arc 2). Skema sudah mendukung (`day >= 2` = terkunci/premium).

## 6. Urutan produksi (jangan dibalik)

1. **Depth-first, bukan breadth-first:** selesaikan Data Analyst hari 2-7 penuh (5 task + rubric + file Excel + 2 modul Academy) SEBELUM menyentuh posisi lain. Data Analyst = ICP follower @masdata = converting tertinggi.
2. Validasi: rilis ke sebagian waitlist, ukur berapa % menyelesaikan hari 2-3. Baru tulis posisi kedua (Marketing).
3. Satu task butuh: brief (100-200 kata suara supervisor), file input (Excel dengan jebakan yang disengaja), rubric mustFind (3-5) + goodToMention (2-3), reaksi NPC untuk approved/revisi, 1 kalimat cross-reference divisi lain.
4. Target ritme menulis: 1 hari simulasi (1 task + reaksi) per hari kerja founder. Arc 1 Data Analyst = 1 minggu kerja.

## 7. Template task (copy-paste untuk menulis cepat)

```
posisi: data_analyst | day: 2
judul: Dashboard Penjualan untuk Rapat Direksi
brief (suara Rizky): "Data yang kemarin kamu bersihin dipakai Diana besok pagi
  di rapat direksi. Aku butuh satu halaman ringkas: tren penjualan per brand,
  top 5 SKU, dan satu insight yang menurutmu direksi HARUS tahu. Jangan kirim
  tabel mentah, direksi nggak baca tabel."
file: task_da_day2.xlsx (data bersih hasil task 1 + 2 kolom baru yang belum dikenal user)
mustFind: [tren per brand teridentifikasi benar, top SKU dengan angka akurat,
  insight non-obvious (Lumière naik tapi margin turun), format ringkas bukan dump]
goodToMention: [rekomendasi actionable, menyebut keterbatasan data,
  antisipasi pertanyaan direksi]
cross-ref: "Diana bilang tim Finance juga bakal hadir, angkamu harus cocok
  sama angka mereka."
approved: Rizky puas + Diana muncul di mgr_chat menyebut satu hal spesifik dari kerjaan user.
revisi: Rizky menunjuk persis bagian yang kurang, deadline dimajukan (tekanan naik).
```
