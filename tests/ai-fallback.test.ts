import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Perilaku callAI saat Gemini bermasalah, terutama dengan SATU kunci (kondisi staging):
// satu gangguan sesaat tidak boleh membuat semua pesan berikutnya gagal selama semenit.

const jawabanGemini = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const galat = (status: number) => new Response(JSON.stringify({ error: { message: 'x' } }), { status })

async function muatAI(kunci: string[]) {
  vi.resetModules()
  for (const k of ['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GROQ_API_KEY_1', 'OPENROUTER_API_KEY']) vi.stubEnv(k, '')
  kunci.forEach((k, i) => vi.stubEnv(`GEMINI_API_KEY_${i + 1}`, k))
  return import('../lib/ai')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('callAI dengan satu kunci Gemini', () => {
  it('gangguan 503 sesaat lalu sukses → percobaan kedua menyelamatkan balasan', async () => {
    const { callAI } = await muatAI(['k1'])
    fetchMock.mockResolvedValueOnce(galat(503)).mockResolvedValueOnce(jawabanGemini('halo'))
    const r = await callAI([{ role: 'user', content: 'hai' }], 'sys')
    expect(r?.text).toBe('halo')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('kegagalan total pada satu pesan tidak memblokir pesan berikutnya (tanpa cooldown 60 detik)', async () => {
    const { callAI } = await muatAI(['k1'])
    fetchMock.mockResolvedValueOnce(galat(503)).mockResolvedValueOnce(galat(503))
    expect(await callAI([{ role: 'user', content: 'a' }], 'sys')).toBeNull()

    fetchMock.mockResolvedValueOnce(jawabanGemini('pulih'))
    const r2 = await callAI([{ role: 'user', content: 'b' }], 'sys')
    expect(r2?.text).toBe('pulih') // dulu: null seketika karena satu-satunya kunci "gagal" selama 60 detik
  })

  it('jawaban kosong (diblokir/terpotong) tidak mengistirahatkan kunci', async () => {
    const { callAI } = await muatAI(['k1'])
    const kosong = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 })
    fetchMock.mockResolvedValueOnce(kosong()).mockResolvedValueOnce(kosong())
    expect(await callAI([{ role: 'user', content: 'a' }], 'sys')).toBeNull()
    fetchMock.mockResolvedValueOnce(jawabanGemini('lancar'))
    expect((await callAI([{ role: 'user', content: 'b' }], 'sys'))?.text).toBe('lancar')
  })

  it('kuota habis (429) pada satu kunci tetap dicoba lagi di permintaan berikutnya, bukan langsung menyerah', async () => {
    const { callAI } = await muatAI(['k1'])
    fetchMock.mockResolvedValueOnce(galat(429)).mockResolvedValueOnce(galat(429))
    expect(await callAI([{ role: 'user', content: 'a' }], 'sys')).toBeNull()
    const sebelum = fetchMock.mock.calls.length
    fetchMock.mockResolvedValueOnce(jawabanGemini('kuota pulih'))
    expect((await callAI([{ role: 'user', content: 'b' }], 'sys'))?.text).toBe('kuota pulih')
    expect(fetchMock.mock.calls.length).toBeGreaterThan(sebelum)
  })

  it('tanpa kunci sama sekali → null tanpa memanggil jaringan', async () => {
    const { callAI } = await muatAI([])
    expect(await callAI([{ role: 'user', content: 'a' }], 'sys')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('kunci dikirim lewat header, bukan query string', async () => {
    const { callAI } = await muatAI(['rahasia-k1'])
    fetchMock.mockResolvedValueOnce(jawabanGemini('ok'))
    await callAI([{ role: 'user', content: 'a' }], 'sys')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('rahasia-k1')
    expect((init as { headers: Record<string, string> }).headers['x-goog-api-key']).toBe('rahasia-k1')
  })
})
