'use client'

import { useState } from 'react'

// Pola lite-youtube: render thumbnail dulu, iframe baru dibuat saat diklik.
// Jauh lebih ringan daripada langsung embed iframe YouTube (hemat ~500KB per video).
export default function YouTubeEmbed({ videoId, title }: { videoId?: string | null; title: string }) {
  const [playing, setPlaying] = useState(false)

  // Slot video belum diisi — lesson tetap bisa diselesaikan lewat materi teksnya
  if (!videoId) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E3DC] bg-[#FAFAF7] aspect-video flex flex-col items-center justify-center gap-2 select-none">
        <span className="text-2xl">🎬</span>
        <p className="text-xs text-[#888780]">Video menyusul. Materi teksnya sudah lengkap di bawah.</p>
      </div>
    )
  }

  if (playing) {
    return (
      <div className="rounded-xl overflow-hidden aspect-video bg-black">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      style={{ cursor: 'pointer' }}
      className="relative rounded-xl overflow-hidden aspect-video w-full group bg-black"
      aria-label={`Putar video: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
        loading="lazy"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-14 h-14 rounded-full bg-[#0F6E56] group-hover:bg-[#085041] transition-colors flex items-center justify-center shadow-lg">
          <span className="text-white text-xl ml-1">▶</span>
        </span>
      </span>
    </button>
  )
}
