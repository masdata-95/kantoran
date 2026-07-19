import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan | Kantoran',
  description: 'Syarat dan ketentuan penggunaan Kantoran, platform simulasi dunia kerja.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
          <Link href="/" className="font-serif font-bold text-[#0F6E56] hover:underline">Kantoran</Link>
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#111111] mb-1">Syarat &amp; Ketentuan</h1>
        <p className="text-xs text-[#888780] mb-8">Berlaku sejak 19 Juli 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[#444441]">
          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">1. Tentang layanan</h2>
            <p>
              Kantoran adalah platform <strong>simulasi</strong> dunia kerja untuk latihan dan pembelajaran.
              PT Vantara Nusantara beserta seluruh karakter, posisi, gaji, dan dokumen di dalamnya
              (termasuk offering letter dan surat referensi) adalah <strong>fiktif</strong> dan bagian dari
              simulasi, bukan hubungan kerja, tawaran kerja, atau dokumen hukum yang sesungguhnya.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">2. Akun</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Login menggunakan akun Google milikmu sendiri.</li>
              <li>Kamu bertanggung jawab atas aktivitas di akunmu.</li>
              <li>Satu orang satu akun, wajar dan tanpa otomasi/bot.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">3. Penggunaan yang wajar</h2>
            <p className="mb-2">Kamu setuju untuk tidak:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Menyalahgunakan sistem (membanjiri layanan, mengeksploitasi celah, mengakses data pengguna lain).</li>
              <li>Mengirim konten yang melanggar hukum, menyerang orang lain, atau berbahaya melalui fitur chat.</li>
              <li>Menyalin atau mendistribusikan konten pembelajaran Kantoran secara komersial tanpa izin.</li>
            </ul>
            <p className="mt-2">Beberapa fitur dibatasi pemakaian hariannya agar layanan tetap sehat untuk semua orang.</p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">4. Konten buatan AI</h2>
            <p>
              Respons karakter, penilaian task, dan review CV dihasilkan oleh AI. Kami merancangnya
              sebaik mungkin, tapi keluarannya bisa keliru dan <strong>bukan nasihat profesional</strong>
              (karir, hukum, maupun keuangan). Gunakan sebagai bahan latihan dan pertimbangan, bukan
              satu-satunya dasar keputusan.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">5. Milikmu dan milik kami</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Konten yang kamu buat (jawaban, file yang kamu upload) tetap milikmu. Kamu memberi kami izin memprosesnya untuk menjalankan layanan.</li>
              <li>Kantoran, dunia Vantara, materi pembelajaran, dan tampilan produk adalah milik kami.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">6. Batasan tanggung jawab</h2>
            <p>
              Layanan disediakan &quot;sebagaimana adanya&quot; pada fase pengembangan ini. Kami tidak menjamin
              layanan bebas gangguan, dan tidak bertanggung jawab atas kerugian tidak langsung dari
              penggunaan layanan, sepanjang diizinkan hukum yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">7. Perubahan layanan &amp; ketentuan</h2>
            <p>
              Kantoran masih berkembang, fitur bisa berubah, bertambah, atau dihapus. Perubahan
              ketentuan penting akan diumumkan di dalam aplikasi; tanggal berlaku di atas selalu
              menunjukkan versi terbaru.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#111111] mb-1.5">8. Hukum yang berlaku &amp; kontak</h2>
            <p>
              Ketentuan ini diatur oleh hukum Republik Indonesia. Pertanyaan:
              <strong> halo.kantoran@gmail.com</strong>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E3DC] flex gap-4 text-xs text-[#888780]">
          <Link href="/" className="hover:text-[#0F6E56]">Beranda</Link>
          <Link href="/privacy" className="hover:text-[#0F6E56]">Kebijakan Privasi</Link>
        </div>
      </div>
    </div>
  )
}
