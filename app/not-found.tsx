import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]" />
          <span className="font-serif text-xl font-bold text-[#111111]">Kantoran</span>
        </div>
        <h1 className="font-serif text-xl font-bold text-[#111111] mb-2">Ruangan ini tidak ada.</h1>
        <p className="text-sm text-[#888780] leading-relaxed mb-6">
          Halaman yang kamu cari tidak ditemukan. Mungkin sudah dipindah, atau memang belum dibangun.
        </p>
        <Link href="/" className="btn-teal text-sm px-6 py-2.5 inline-block" style={{ cursor: 'pointer' }}>
          Kembali ke lobby
        </Link>
      </div>
    </div>
  )
}
