import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi | Kantoran',
  description: 'Kebijakan privasi Kantoran: data apa yang kami simpan, untuk apa, dan hak kamu atasnya.',
}

// Halaman legal — wajib UU PDP karena Kantoran menyimpan data pribadi + riwayat chat.
// Ditulis bahasa manusia, bukan legalese, supaya benar-benar dibaca.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
          <Link href="/" className="font-serif font-bold text-[#0F6E56] hover:underline">Kantoran</Link>
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#111111] mb-1">Kebijakan Privasi</h1>
        <p className="text-xs text-[#888780] mb-8">Berlaku sejak 19 Juli 2026 · Kantoran (kantoran.vercel.app)</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[#444441]">
          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Data yang kami kumpulkan</h2>
            <p className="mb-2">Saat kamu memakai Kantoran, kami menyimpan:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Akun Google:</strong> nama dan alamat email (dari login Google, kami tidak pernah melihat password-mu).</li>
              <li><strong>Profil karir:</strong> data yang kamu isi sendiri, nama, gender, kota, pendidikan, pengalaman, dan skill.</li>
              <li><strong>Aktivitas simulasi:</strong> progress, riwayat percakapan dengan karakter simulasi, dan hasil task.</li>
              <li><strong>File yang kamu upload</strong> (Excel hasil kerja, CV): isinya diproses untuk memberi penilaian, teks hasil ekstraksinya dipakai selama pemrosesan.</li>
              <li><strong>Data pemakaian:</strong> jumlah pemakaian fitur per hari (untuk pembatasan wajar) dan catatan kejadian teknis (untuk memperbaiki error).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Untuk apa data dipakai</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Menjalankan simulasi: menyimpan progress-mu, membuat karakter merespons konteksmu.</li>
              <li>Memberi penilaian atas jawaban interview, hasil task, dan CV-mu.</li>
              <li>Menghubungimu tentang produk (kalau kamu mendaftar waitlist).</li>
              <li>Memperbaiki produk lewat statistik agregat (tanpa identitas per orang).</li>
            </ul>
            <p className="mt-2">Kami <strong>tidak menjual</strong> data pribadimu kepada siapa pun.</p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Pemrosesan oleh AI</h2>
            <p>
              Karakter di Kantoran dijalankan oleh model AI. Artinya isi percakapanmu di dalam simulasi
              dan teks yang kamu submit (jawaban task, isi CV) dikirim ke penyedia layanan AI
              (saat ini Google Gemini, dengan cadangan Groq dan OpenRouter) untuk menghasilkan respons.
              Kami mengirim hanya yang diperlukan untuk fitur berjalan, dan tidak mengirim password
              atau data pembayaran apa pun.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Di mana data disimpan</h2>
            <p>
              Data disimpan di Supabase (database) dan aplikasi berjalan di infrastruktur cloud
              (saat ini Vercel/Cloudflare). Akses ke data dibatasi: setiap pengguna hanya bisa
              mengakses datanya sendiri.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Berapa lama disimpan</h2>
            <p>
              Selama akunmu aktif, supaya progress simulasimu tidak hilang. Kamu bisa menghapus
              progress per posisi kapan pun lewat tombol Restart di dalam aplikasi.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Hak kamu</h2>
            <p className="mb-2">Sesuai UU Perlindungan Data Pribadi, kamu berhak:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Meminta salinan data pribadimu yang kami simpan.</li>
              <li>Meminta perbaikan data yang keliru.</li>
              <li>Meminta penghapusan seluruh akun dan datamu.</li>
            </ul>
            <p className="mt-2">
              Kirim permintaan ke email di bawah, kami proses maksimal 7 hari kerja.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Kontak</h2>
            <p>
              Pertanyaan atau permintaan terkait privasi: <strong>masdata.business@gmail.com</strong>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">Perubahan kebijakan</h2>
            <p>
              Kalau kebijakan ini berubah, tanggal berlaku di atas diperbarui dan perubahan penting
              akan kami umumkan di dalam aplikasi.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E3DC] flex gap-4 text-xs text-[#888780]">
          <Link href="/" className="hover:text-[#0F6E56]">Beranda</Link>
          <Link href="/terms" className="hover:text-[#0F6E56]">Syarat &amp; Ketentuan</Link>
        </div>
      </div>
    </div>
  )
}
