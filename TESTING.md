# TESTING.md — Skrip Uji Semua Fitur Kantoran

> Diperbarui 13 Juli 2026. Dua lapis: **otomatis** (unit test + build, jalankan setiap sebelum push)
> dan **manual E2E** (checklist alur user, jalankan setelah deploy atau perubahan besar).
> Estimasi manual penuh: 30-40 menit.

## 0. Uji otomatis (jalankan dulu, wajib hijau)

```bash
npm test        # 30 unit test: normalizeLevel, salary, grade/revisi/gaya kerja, cleanResponse, sqlCompare
npm run build   # compile + TypeScript, 16 route harus ter-generate
```

## 1. Persiapan uji manual

- Siapkan **akun Google baru/sekunder** (untuk menguji alur user baru + guided tour).
- Untuk mengulang kondisi "user baru" di akun yang sama:
  - Hapus baris user di Supabase Studio: `user_progress`, `user_profiles`, `waitlist`, `lesson_progress`.
  - Di browser: hapus localStorage key `kantoran_tour_v1_<user_id>` (DevTools → Application → Local Storage).
- **Ambil token** untuk uji API (bagian 12): buka app yang sudah login → DevTools → Network →
  klik request apa pun ke `/api/...` → copy nilai header `Authorization: Bearer <token>`.

## 2. Landing page (`/`)

- [ ] Title tab: "Kantoran | Simulasi Dunia Kerja" (tanpa em-dash).
- [ ] Hero stat menulis "3 Jenjang karir per posisi".
- [ ] Tidak ada emoji 🚀/🎉 di tombol CTA dan bubble chat demo.
- [ ] Tombol CTA → masuk `/simulator`; tombol "Cek Skor CV" → `/cv`.

## 3. CV Kantoran (`/cv`)

- [ ] Upload PDF < 4MB → teks terekstrak; DOCX dan TXT juga.
- [ ] File > 4MB ditolak dengan pesan dari app (bukan error platform).
- [ ] "Isi dari profil Kantoran" (tanpa ✨) mengisi textarea dari profil (kalau sudah login + ada profil).
- [ ] Review menghasilkan skor ATS + rewrite; submit ke-11 di hari yang sama kena rate limit (limit 10/hari).

## 4. Login & Profile Setup

- [ ] `/simulator` → login Google langsung (tanpa onboarding slides).
- [ ] ProfileSetup 5 step selesai; step 5 kategori "Mahasiswa Tingkat Akhir" menulis "melamar sebagai Intern" (bukan Intern Magang).
- [ ] Setelah profil tersimpan → diarahkan ke job listing (hub karir).

## 5. Job Listing (hub karir)

- [ ] 5 kartu posisi tampil; kartu tanpa run menulis rentang "Rp 1.8-8 jt/bln · semua jenjang".
- [ ] Kalau ≥ 3 user aktif minggu ini: baris "● N orang sedang menjalani simulasi..." muncul di header.
- [ ] Modal detail: pemilih jenjang hanya **3 opsi** (Intern / Junior / Mid-Level), gaji format "Rp 1.8-3 jt", badge "sesuai profilmu" di level default background.
- [ ] Chip status tanpa emoji: "Tersedia" / "Tahap interview" / "Hari-1 selesai".

## 6. Guided tour (akun baru)

- [ ] Masuk simulasi pertama kali → overlay gelap + kartu "Selamat datang di kantor barumu".
- [ ] 6 langkah: sambutan → Inbox (list email disorot) → Tim Kamu → Ruangan → Kantor Coin → penutup.
- [ ] **Mobile (≤ 768px):** langkah Tim Kamu & Ruangan membuka drawer sidebar otomatis, spotlight mengikuti.
- [ ] Klik area gelap = lanjut; "Lewati tur" atau Escape = tutup.
- [ ] Refresh halaman → tur TIDAK muncul lagi (flag localStorage).

## 7. Interview (HR Office)

- [ ] Email undangan di Inbox → tombol "Mulai Interview dengan Sinta".
- [ ] Sinta bertanya bertahap, TIDAK lompat topik, ada follow-up ("contohnya gimana?").
- [ ] Balasan Sinta tanpa markdown/em-dash/gaya robot.
- [ ] **Uji gangguan:** matikan wifi → kirim pesan → banner oranye "gangguan koneksi" + tombol "Kirim ulang" (BUKAN bubble Sinta). Nyalakan wifi → "Kirim ulang" → percakapan lanjut dari topik yang sama, tidak lompat.
- [ ] Interview TIDAK bisa selesai sebelum bahas gaji (guard `salaryDiscussed`), bahkan lewat tombol "Interview selesai" di header — nego tetap harus terjadi.
- [ ] Nego gaji: minta angka dalam range → diakomodir; jauh di atas → Sinta menahan dengan sopan.

## 8. Offering → Kontrak → Surat Referensi

- [ ] Interview selesai → kartu "Interview selesai!" → Offering Letter masuk Inbox, gaji sesuai/dekat hasil nego dan dalam range level.
- [ ] Tanda tangan → "Kontrak Berhasil Ditandatangani" → masuk Slack, disambut Sinta + supervisor + junior.
- [ ] ±9 detik kemudian: notifikasi "HR mulai menyusun surat referensimu" + badge di room **Surat Referensi**.
- [ ] Buka Surat Referensi: baris interview & kontrak tercentang; training & task masih kosong; baris hari 2-7 terkunci 🔒; blok tanda tangan "Ditandatangani resmi di akhir simulasi".

## 9. Standup → Task (Academy OPSIONAL — perilaku baru)

- [ ] Supervisor DM masuk (setelah kirim 1 chat di Slack, atau 90 detik).
- [ ] Buka DM supervisor → orientasi (perusahaan, posisi, SOP) → Academy di-assign dengan framing "nggak wajib sekarang" → pertanyaan standup.
- [ ] **Jawab standup → ±6 detik → task pertama turun** (tanpa menyelesaikan training!).
- [ ] Alternatif: diam 2 menit → task tetap turun ("Standup bisa nyusul...").
- [ ] Room Academy & File Manager terbuka sesuai step; tombol "Buka File Manager →" benar-benar pindah room; file Excel bisa didownload.

## 10. Academy (jalur opsional + just-in-time)

- [ ] Selesaikan modul day-1 SETELAH task berjalan → supervisor kirim apresiasi ("aku lihat training module kamu kelar") + 10 coin — hanya sekali, tidak dobel setelah refresh.
- [ ] Misi Academy: submit jawaban → direview suara supervisor; APPROVED menandai lesson selesai.
- [ ] Modul day ≥ 2 tampil sebagai kartu teaser terkunci.
- [ ] Surat Referensi: baris training tercentang HANYA setelah modul benar-benar selesai.

## 11. Dilema, Workspace, Stakes, Akhir Hari

- [ ] Setelah buka File Manager (step 6): junior DM tips + **dilema 2 pilihan** ("tulis apa adanya" / "aman dulu"). Pilih salah satu → jawaban terkirim, junior bereaksi sesuai pilihan, tombol jadi inert, +5 coin.
- [ ] Workspace: upload Excel → preview terbaca → "Submit ke Supervisor untuk Review".
- [ ] **Submit jelek (sengaja):** REVISION NEEDED → feedback spesifik; karena training belum selesai → supervisor menyarankan Academy + tombol "Buka Academy →".
- [ ] **Submit jelek kedua:** pesan supervisor mendingin ("Ini revisi kedua...").
- [ ] **Upload ulang setelah revisi (bug fix 14 Juli 2026):** klik "Upload ulang file yang
      sudah direvisi" → pilih file → tombol "Submit ke Supervisor" MUNCUL lagi dan bisa
      disubmit. Setelah APPROVED: area upload berganti kartu "Task hari ini sudah APPROVED"
      (tidak bisa submit dobel).
- [ ] **Submit benar:** APPROVED → +30 coin → junior memberi selamat → supervisor "sudah jam 5" → kartu akhir hari.
- [ ] Kartu akhir hari menampilkan **"Penilaian hari pertama"**: Exceeds (0 revisi) / Meets (1) / Needs Improvement (2+), plus kalimat gaya kerja sesuai pilihan dilema.
- [ ] Manager mengirim DM cliffhanger.
- [ ] Surat Referensi sekarang: semua baris hari-1 tercentang + kutipan supervisor yang bunyinya sesuai grade.

## 11b. Refresh & Resume (fix 13 Juli 2026)

- [ ] Di tengah interview (atau room mana pun): **refresh halaman → kembali ke simulasi
      di room yang sama**, BUKAN ke pemilihan posisi.
- [ ] Klik tombol "Lowongan" (keluar ke hub) → refresh → tetap di hub (tidak dipaksa masuk simulasi).
- [ ] Tutup tab, buka tab baru → mendarat di hub (perilaku sessionStorage yang diharapkan).
- [ ] Tombol "Interview selesai" di header hr_office SEBELUM bahas gaji → Sinta menolak
      dan menanyakan ekspektasi gaji (tidak lompat ke offering).

## 11c. Database Vantara — SQL editor (khusus Data Analyst)

- [ ] Apply sebagai Data Analyst → step task (5): supervisor menyebut akses database +
      tombol "Buka Database Vantara"; room Database (🗄️) muncul di sidebar (posisi lain TIDAK punya).
- [ ] Room terbuka: "Menyambungkan ke database..." → daftar tabel (products, distributors, sales, payments).
- [ ] `SELECT * FROM sales LIMIT 10` → hasil tampil; Ctrl+Enter juga menjalankan.
- [ ] Query non-SELECT (`DELETE FROM sales`) → ditolak "read-only".
- [ ] Query salah sintaks → pesan error tampil, app tidak crash.
- [ ] Latihan 1 (total revenue Jan 2026): tulis query benar → "Cek query-ku" → "Benar! +15 coin",
      coin di topbar bertambah; cek ulang → TIDAK dobel coin; refresh → status ✓ bertahan.
- [ ] Latihan 3: hasilnya memperlihatkan revenue Jawa Timur anjlok mulai 2026-05 (konsisten cerita).

## 11d. Teach-back & Refleksi (setelah task APPROVED)

- [ ] ±12 detik setelah ucapan selamat junior: junior bertanya minta DIAJARI
      (mis. DA: "cara nemuin duplikat gimana sih?"). Jawab dengan penjelasan →
      junior menanggapi isi penjelasan (bukan generik), bertanya lanjutan bila perlu.
- [ ] Chat supervisor: setelah "sudah jam 5" ada pertanyaan refleksi "satu hal yang paling
      kamu pelajari hari ini". Jawab → supervisor menanggapi natural.
- [ ] Halaman wishlist: teks share PERSONAL (menyebut role, gaji nego, grade, gaya kerja),
      bukan template generik; tombol copy menyalin teks tersebut.

## 11e. Posisi Admin Operasional (baru, 14 Juli 2026)

- [ ] Job listing menampilkan 6 posisi; kartu Admin Operasional (🗂️) lengkap dengan detail modal.
- [ ] Apply Admin → interview Sinta menyentuh kompetensi admin (teliti, Excel dasar, dokumen).
- [ ] Task day-1: download `task_admin_ops.xlsx` → sheet "Invoice 2026" berisi ±104 baris
      dengan 2 invoice dobel + 3 tanpa jatuh tempo + tunggakan UD Berkah Jaya (dari data universe).
- [ ] Review supervisor (Mbak Sari) menuntut 3 temuan wajib itu; APPROVED setelah lengkap.
- [ ] Academy admin: modul "Excel untuk Admin" (2 materi + misi) muncul setelah `npm run seed:lessons`.

## 11f. Hasil interview 3 tingkat + nego gaji human

- [ ] **Lulus normal:** interview bagus → kartu "Kamu diterima" biasa, offer sesuai nego.
- [ ] **Diterima bersyarat:** jawab interview dangkal/pendek terus (tapi sopan) → Sinta menerima
      "dengan catatan"; kartu bertuliskan catatan evaluasi; offering = batas bawah range;
      sambutan supervisor di Slack lebih dingin ("di sini yang bicara hasil kerja");
      surat referensi menulis "Lulus proses seleksi (dengan catatan evaluasi HR)".
      Lalu: selesaikan task tanpa revisi → kutipan surat berubah jadi redemption
      ("masuk dengan catatan, dan menepisnya lewat hasil kerja").
- [ ] **Ditolak:** jawab asal-asalan/kosong berulang (minimal 6 tanya-jawab) → Sinta menolak
      dengan 2 alasan spesifik + 1 saran; muncul 2 kartu: "Pelajari: Cara Menjawab Interview"
      (Academy terbuka meski belum diterima, modul dari HR) dan "Ulangi Interview"
      (chat HR di-reset, progress lain aman). Interview ulang berjalan normal.
- [ ] **Guard server:** coba pancing penolakan di 2-3 pesan pertama → TOLAK tidak terjadi
      (minimal 6 tanya-jawab).
- [ ] **Nego stretch:** minta angka di atas max range (contoh junior: 6,5-7 juta) DENGAN alasan
      kuat dan spesifik → Sinta menggali, "cek ke atasan", bisa setuju; angka final disebut
      eksplisit; **offering letter menampilkan angka yang disepakati itu** (bukan di-clamp turun).
- [ ] **Nego stretch tanpa alasan** ("pokoknya 7 juta") → Sinta menahan di max range dengan empati.
- [ ] Angka jauh di atas stretch (mis. 15 juta) → Sinta jujur soal batas; offering tidak pernah
      melebihi max+20%.

## 12. Wishlist, Multi-role, Kantor Hidup

- [ ] "Daftar Waitlist" → form 3 step → submit → halaman selesai. Selesaikan posisi KEDUA → form TIDAK muncul lagi (sekali seumur akun), langsung balik hub.
- [ ] Balik hub: posisi selesai berstatus "Hari-1 selesai"; apply posisi lain → run baru; keluar-masuk posisi → resume di titik terakhir; Restart hanya menghapus posisi itu.
- [ ] **Kantor hidup:** di Supabase, ubah `last_active` run aktif jadi kemarin (`update user_progress set last_active = now() - interval '10 hours' where user_id='...'`) → buka simulasi → NPC mengirim pesan "selama kamu pergi" (supervisor kalau step ≥ 5, junior kalau step 3-4). Muncul sekali, tidak berulang di refresh berikutnya.
- [ ] User beta lama (baris pra-level / level `intern_magang`): tetap bisa resume, level terbaca Intern.

## 13. API hardening (curl, pakai token dari Persiapan)

```bash
BASE="https://kantoran.vercel.app"   # atau URL Cloudflare
TOKEN="<paste token>"

# 13a. Tanpa token → 401
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/progress

# 13b. Step mundur ditolak → 409 (jalankan saat run aktif sudah step > 2)
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/progress \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"progress":{"position":"data_analyst","step":1,"coins":0,"tasksDone":0,"streak":0}}'

# 13c. Posisi tidak valid → 400
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/progress \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"progress":{"position":"hacker","step":1}}'

# 13d. npcId tidak valid → 400
curl -s -w "\n%{http_code}\n" -X POST $BASE/api/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"npcId":"admin","messages":[{"role":"user","content":"hai"}],"userContext":{"firstName":"X"},"positionId":"data_analyst"}'

# 13e. Stats → {"activeThisWeek": N}
curl -s $BASE/api/stats -H "Authorization: Bearer $TOKEN"
```

- [ ] 13a=401, 13b=409, 13c=400, 13d=400, 13e=JSON angka.

## 13b. Produksi & Observability (baru, 19 Juli 2026)

- [ ] Jalankan `supabase-migrations/005_observability.sql` di Supabase Studio (sekali).
- [ ] /privacy dan /terms terbuka; link dari footer landing dan halaman login berfungsi.
- [ ] Paste link kantoran ke WhatsApp/Telegram → kartu preview muncul (gambar hijau
      "Belajar kerja, sambil kerja beneran"), bukan URL telanjang.
- [ ] Buka /halaman-ngasal → halaman 404 bermerek "Ruangan ini tidak ada".
- [ ] Mainkan 1 alur (apply → interview start) → /admin kartu "Event Funnel (7 hari)"
      menunjukkan angka naik (apply, interview_start, dst).
- [ ] Kartu "Error Client Terbaru" di /admin: "Tidak ada error" (atau daftar error
      kalau memang ada — itu artinya fiturnya bekerja).
- [ ] Upload .xlsx di Workspace masih terbaca (parser baru exceljs); file .xls lama
      ditolak dengan pesan "pastikan format .xlsx".

## 14. Mobile (390px, WAJIB — traffic IG/TikTok)

- [ ] Guided tour: spotlight & drawer mulus.
- [ ] Keyboard tidak menutupi input chat; chat auto-scroll.
- [ ] Inbox: buka email → list menyembunyikan diri; tombol ✕ balik ke list.
- [ ] Surat Referensi & modal job listing bisa di-scroll penuh.

## Bug ditemukan?

Catat di CATATAN-PENGEMBANGAN.md dengan format: gejala → langkah reproduksi → dugaan akar masalah.
