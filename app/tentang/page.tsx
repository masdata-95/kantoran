import type { Metadata } from 'next'
import Link from 'next/link'

// Halaman identitas: siapa yang membuat & mengelola Kantoran. Dibutuhkan untuk verifikasi
// perusahaan (Claude for Startups, payment gateway, PSE) dan kepercayaan pengguna.
// Nama PT ditambahkan di sini begitu badan hukum terbit.
export const metadata: Metadata = {
  title: 'Tentang Kantoran',
  description: 'Kantoran adalah simulasi kerja kantoran lewat chat, dibuat dan dikelola oleh Zhofar Murry Setiawan (@masdata) sejak 2026.',
  alternates: { canonical: '/tentang' },
}

const LINKEDIN_COMPANY = 'https://www.linkedin.com/company/kantoran/'
const INSTAGRAM = 'https://www.instagram.com/kantoranid_/'
const FOUNDER_LINKEDIN = 'https://www.linkedin.com/in/zhofarms1/'

export default function TentangPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] px-5 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- "/" adalah landing statis (rewrite), butuh muat ulang penuh */}
        <a href="/" className="text-[15px] font-semibold text-[#0F6E56] hover:underline">Kantoran</a>

        <h1 className="text-[28px] leading-tight font-semibold text-[#1A1A18] mt-8 mb-3">Tentang Kantoran</h1>
        <p className="text-[17px] leading-relaxed text-[#3A3A36]">
          Kantoran adalah simulasi kerja kantoran lewat chat. Pengguna melamar ke perusahaan fiktif,
          diinterview HR, menegosiasikan gaji, menandatangani offering letter, lalu mengerjakan task
          Excel dari supervisor yang memberi penilaian atas hasil kerjanya.
        </p>

        <div className="flex flex-col gap-8 mt-10 text-[15px] leading-relaxed text-[#3A3A36]">
          <section>
            <h2 className="text-lg font-semibold text-[#1A1A18] mb-2">Kenapa Kantoran dibuat</h2>
            <p>
              Banyak mahasiswa tingkat akhir dan fresh graduate belum pernah merasakan dinamika kerja kantoran
              sebelum benar-benar masuk: diwawancara HR, membaca offering letter, menerima task dengan tenggat,
              dan direvisi atasan. Kantoran memberi tempat untuk mengalami semua itu lebih dulu, tanpa risiko,
              dan pulang dengan cerita konkret untuk interview kerja yang sesungguhnya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1A1A18] mb-2">Siapa di balik Kantoran</h2>
            <div className="bg-white border border-[#E5E3DC] rounded-xl p-5">
              <p className="font-semibold text-[#1A1A18]">Zhofar Murry Setiawan</p>
              <p className="text-sm text-[#6B6A64]">Founder · dikenal sebagai @masdata</p>
              <p className="mt-3">
                Kreator konten seputar data, Excel, dan karier. Kantoran dibangun dari pertanyaan yang paling
                sering datang dari audiensnya: bagaimana rasanya kerja kantoran, dan bagaimana menyiapkan diri sebelum masuk.
              </p>
              <a href={FOUNDER_LINKEDIN} rel="noopener" target="_blank" className="inline-block mt-3 text-sm font-medium text-[#0F6E56] hover:underline">
                Profil LinkedIn
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1A1A18] mb-2">Pengelola</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-[#6B6A64]">Nama layanan</dt><dd>Kantoran</dd>
              <dt className="text-[#6B6A64]">Dikelola oleh</dt><dd>Zhofar Murry Setiawan (perorangan)</dd>
              <dt className="text-[#6B6A64]">Berdiri</dt><dd>2026</dd>
              <dt className="text-[#6B6A64]">Negara</dt><dd>Indonesia</dd>
              <dt className="text-[#6B6A64]">Website</dt><dd>kantoran.id</dd>
              <dt className="text-[#6B6A64]">Email</dt><dd><a href="mailto:halo@kantoran.id" className="text-[#0F6E56] hover:underline">halo@kantoran.id</a></dd>
              <dt className="text-[#6B6A64]">LinkedIn</dt><dd><a href={LINKEDIN_COMPANY} rel="noopener" target="_blank" className="text-[#0F6E56] hover:underline">linkedin.com/company/kantoran</a></dd>
              <dt className="text-[#6B6A64]">Instagram</dt><dd><a href={INSTAGRAM} rel="noopener" target="_blank" className="text-[#0F6E56] hover:underline">@kantoranid_</a></dd>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1A1A18] mb-2">Tentang PT Vantara Nusantara</h2>
            <p>
              PT Vantara Nusantara, beserta merek Lumière, Roots&amp;Co, dan Vanta Glow, adalah perusahaan
              <strong className="font-semibold text-[#1A1A18]"> fiktif</strong> di dalam simulasi. Perusahaan itu
              tidak berhubungan dengan Kantoran sebagai pengelola, dan orang-orang di dalamnya (HR, supervisor,
              rekan kerja) diperankan oleh AI.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-[#E5E3DC] flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6B6A64]">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- landing statis */}
          <a href="/" className="hover:text-[#0F6E56]">Beranda</a>
          <Link href="/simulator" className="hover:text-[#0F6E56]">Mulai simulasi</Link>
          <Link href="/privacy" className="hover:text-[#0F6E56]">Kebijakan Privasi</Link>
          <Link href="/terms" className="hover:text-[#0F6E56]">Syarat &amp; Ketentuan</Link>
        </div>
      </div>
    </div>
  )
}
