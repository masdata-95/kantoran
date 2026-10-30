'use client'

import { useEffect, useRef, useState } from 'react'

// Pemutar HLS untuk video pustaka Mas Data. src adalah link bertoken dari /api/lessons
// (berlaku 3 jam). hls.js dimuat hanya saat pemutar dipakai, jadi tidak membebani bundle chat.
// Safari/iOS memutar HLS secara native; browser lain lewat hls.js.
export default function VideoPlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let cancelled = false
    let hls: { destroy: () => void } | undefined
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        setError('Browser ini belum bisa memutar video. Coba Chrome atau Safari terbaru.')
        return
      }
      const player = new Hls({ capLevelToPlayerSize: true })
      hls = player
      player.loadSource(src)
      player.attachMedia(video)
      player.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError('Video gagal dimuat. Muat ulang halaman, lalu coba lagi.')
      })
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  if (error) {
    return (
      <div className="rounded-xl border border-[#E5E3DC] bg-[#FAFAF7] aspect-video flex items-center justify-center p-4">
        <p className="text-sm text-[#4A4A45] text-center">{error}</p>
      </div>
    )
  }

  return (
    <video
      ref={ref}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      aria-label={title}
      className="w-full aspect-video rounded-xl bg-black"
    />
  )
}
