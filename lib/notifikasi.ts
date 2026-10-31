// Bunyi pendek untuk pesan baru di simulator. WebAudio supaya tidak perlu berkas audio.
// Browser baru mengizinkan suara setelah pengguna berinteraksi dengan halaman; kalau
// belum, pemanggilan ini diam-diam tidak berbunyi.

const KUNCI_SUARA = 'kantoran_suara_notif'

let ctx: AudioContext | null = null

export function bacaPengaturanSuara(): boolean {
  try { return localStorage.getItem(KUNCI_SUARA) !== 'off' } catch { return true }
}

export function simpanPengaturanSuara(aktif: boolean) {
  try { localStorage.setItem(KUNCI_SUARA, aktif ? 'on' : 'off') } catch { /* abaikan */ }
}

export function bunyiNotif() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.setValueAtTime(1320, t + 0.09)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.36)
  } catch { /* abaikan: tanpa suara pun notifikasi visual tetap ada */ }
}
