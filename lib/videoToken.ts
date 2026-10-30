// Tanda tangan link video. DISALIN apa adanya dari portal-masdata/video/src/tanda.ts
// supaya portal, Kantoran, dan Worker video menghitung tanda dengan cara yang sama.
// (Bagian cocokTanda hanya dipakai Worker video, jadi tidak ikut disalin.)
//
//   const url = await buatLinkVideo(process.env.KUNCI_VIDEO!, process.env.VIDEO_BASE!, 'looker-3-1-1')
//
// Hanya Web Crypto, tanpa pustaka.

const enc = new TextEncoder()

async function hmac(kunci: string, pesan: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(kunci), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(pesan)))
  let s = ''
  for (const b of sig) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Link master playlist, berlaku `detik` ke depan (bawaan 3 jam). */
export async function buatLinkVideo(kunci: string, dasar: string, kode: string, detik = 3 * 3600): Promise<string> {
  // Dibulatkan ke 5 menit: murid yang membuka ulang halaman dalam rentang
  // yang sama mendapat link yang sama, jadi cache browser tetap terpakai.
  const exp = Math.ceil((Date.now() / 1000 + detik) / 300) * 300
  return `${dasar}/t/${exp}/${await hmac(kunci, `${kode}:${exp}`)}/${kode}/index.m3u8`
}
