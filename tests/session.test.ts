import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHash, createHmac } from 'crypto'
import {
  safeNext, sameOrigin, sameString, parseOAuthCookie,
  pkcePair, randomToken, sha256Hex,
} from '@/lib/session'
import { buatLinkVideo } from '@/lib/videoToken'

describe('safeNext (tujuan setelah login)', () => {
  it('menerima alamat di situs ini', () => {
    expect(safeNext('/cv')).toBe('/cv')
    expect(safeNext('/simulator?x=1#a')).toBe('/simulator?x=1#a')
  })
  it('menolak alamat luar dan trik pengalihan', () => {
    for (const bad of ['https://jahat.com', '//jahat.com', '/\\jahat.com', 'javascript:alert(1)', 'jahat.com', '/ok\nSet-Cookie: x=1', '']) {
      expect(safeNext(bad)).toBe('/simulator')
    }
    expect(safeNext(null)).toBe('/simulator')
    expect(safeNext(undefined, '/cv')).toBe('/cv')
  })
})

describe('sameOrigin (CSRF)', () => {
  it('GET/HEAD/OPTIONS selalu lolos', () => {
    expect(sameOrigin('GET', 'https://jahat.com', 'kantoran.id')).toBe(true)
    expect(sameOrigin('HEAD', 'https://jahat.com', 'kantoran.id')).toBe(true)
  })
  it('POST dari host yang sama lolos', () => {
    expect(sameOrigin('POST', 'https://kantoran.id', 'kantoran.id')).toBe(true)
    expect(sameOrigin('POST', 'http://localhost:3000', 'localhost:3000')).toBe(true)
  })
  it('POST dari host lain ditolak', () => {
    expect(sameOrigin('POST', 'https://jahat.com', 'kantoran.id')).toBe(false)
    expect(sameOrigin('DELETE', 'https://kantoran.id.jahat.com', 'kantoran.id')).toBe(false)
    expect(sameOrigin('POST', 'bukan-url', 'kantoran.id')).toBe(false)
  })
  it('POST tanpa Origin (curl, server ke server) lolos karena tak membawa cookie korban', () => {
    expect(sameOrigin('POST', null, 'kantoran.id')).toBe(true)
  })
})

describe('PKCE', () => {
  it('challenge = base64url(SHA-256(verifier)), sesuai RFC 7636', async () => {
    const { verifier, challenge } = await pkcePair()
    const expected = createHash('sha256').update(verifier).digest('base64url')
    expect(challenge).toBe(expected)
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('tiap pasangan berbeda', async () => {
    expect((await pkcePair()).verifier).not.toBe((await pkcePair()).verifier)
  })
})

describe('token dan hash sesi', () => {
  it('randomToken berpanjang tetap, URL-safe, dan unik', () => {
    const a = randomToken(32), b = randomToken(32)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })
  it('sha256Hex cocok dengan vektor uji standar', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('cookie OAuth', () => {
  it('membaca cookie yang sah dan membersihkan next-nya', () => {
    const raw = JSON.stringify({ state: 's', verifier: 'v', next: '//jahat.com' })
    expect(parseOAuthCookie(raw)).toEqual({ state: 's', verifier: 'v', next: '/simulator' })
  })
  it('menolak cookie rusak atau tak lengkap', () => {
    expect(parseOAuthCookie(undefined)).toBeNull()
    expect(parseOAuthCookie('bukan json')).toBeNull()
    expect(parseOAuthCookie(JSON.stringify({ state: 's' }))).toBeNull()
  })
  it('sameString membandingkan penuh', () => {
    expect(sameString('abc', 'abc')).toBe(true)
    expect(sameString('abc', 'abd')).toBe(false)
    expect(sameString('abc', 'abcd')).toBe(false)
  })
})

describe('link video bertoken', () => {
  afterEach(() => vi.useRealTimers())

  it('tandanya cocok dengan algoritma Worker video (HMAC-SHA256 dari "kode:exp")', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'))
    const url = await buatLinkVideo('rahasia-uji', 'https://video.contoh', 'looker-3-1-1')
    const m = /^https:\/\/video\.contoh\/t\/(\d+)\/([A-Za-z0-9_-]{43})\/looker-3-1-1\/index\.m3u8$/.exec(url)
    expect(m).not.toBeNull()
    const [, exp, tanda] = m!
    expect(tanda).toBe(createHmac('sha256', 'rahasia-uji').update(`looker-3-1-1:${exp}`).digest('base64url'))
  })

  it('berlaku sekitar 3 jam dan dibulatkan ke kelipatan 5 menit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-30T12:03:20Z'))
    const url = await buatLinkVideo('k', 'https://v', 'x-1-1')
    const exp = Number(/\/t\/(\d+)\//.exec(url)![1])
    const sisa = exp - Date.now() / 1000
    expect(sisa).toBeGreaterThanOrEqual(3 * 3600)
    expect(sisa).toBeLessThan(3 * 3600 + 300)
    expect(exp % 300).toBe(0)
  })

  it('kode berbeda menghasilkan tanda berbeda', async () => {
    const a = await buatLinkVideo('k', 'https://v', 'a-1-1')
    const b = await buatLinkVideo('k', 'https://v', 'b-1-1')
    expect(a.split('/')[5]).not.toBe(b.split('/')[5])
  })
})
