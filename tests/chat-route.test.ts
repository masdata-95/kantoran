import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// AI, sesi, dan rate limit dipalsukan: yang diuji adalah aturan di rute (token hasil interview,
// penjaga TOLAK dini, pembatasan payload, kegagalan AI), bukan kualitas jawaban model.
const callAI = vi.fn()
const getAuthUser = vi.fn()
const checkLimit = vi.fn()

vi.mock('@/lib/ai', () => ({ callAI: (...a: unknown[]) => callAI(...a) }))
vi.mock('@/lib/serverAuth', () => ({ getAuthUser: (...a: unknown[]) => getAuthUser(...a) }))
vi.mock('@/lib/rateLimit', () => ({
  checkLimit: (...a: unknown[]) => checkLimit(...a),
  LIMIT_MESSAGE: { chat: 'Batas chat hari ini tercapai.' },
}))

import { POST } from '../app/api/chat/route'

const ctx = { firstName: 'Mas', email: 'a@b.c', background: 'fresh_grad', bgRole: 'Junior Analyst', position: 'data_analyst', level: 'junior', experience: '', motivation: '' }

function userMsgs(n: number) {
  const out: { role: string; content: string }[] = []
  for (let i = 0; i < n; i++) {
    out.push({ role: 'user', content: `jawaban ${i + 1}` })
    if (i < n - 1) out.push({ role: 'assistant', content: `pertanyaan ${i + 1}` })
  }
  return out
}

async function kirim(body: Record<string, unknown>) {
  const req = { json: async () => body } as unknown as NextRequest
  const res = await POST(req)
  return { status: res.status, data: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  callAI.mockReset()
  getAuthUser.mockReset().mockResolvedValue({ id: 'u1', email: 'a@b.c' })
  checkLimit.mockReset().mockResolvedValue(true)
})

describe('POST /api/chat, akses dan validasi', () => {
  it('tanpa sesi → 401, AI tidak dipanggil', async () => {
    getAuthUser.mockResolvedValue(null)
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(1), userContext: ctx })
    expect(r.status).toBe(401)
    expect(callAI).not.toHaveBeenCalled()
  })

  it('batas harian tercapai → balasan biasa (200), bukan error, AI tidak dipanggil', async () => {
    checkLimit.mockResolvedValue(false)
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(1), userContext: ctx })
    expect(r.status).toBe(200)
    expect(r.data.reply).toBe('Batas chat hari ini tercapai.')
    expect(callAI).not.toHaveBeenCalled()
  })

  it('npcId tak dikenal, field kurang, atau pesan kosong → 400', async () => {
    expect((await kirim({ npcId: 'hacker', messages: userMsgs(1), userContext: ctx })).status).toBe(400)
    expect((await kirim({ npcId: 'sinta', userContext: ctx })).status).toBe(400)
    expect((await kirim({ npcId: 'sinta', messages: [{ role: 'user', content: '' }], userContext: ctx })).status).toBe(400)
  })

  it('NPC posisi (sup/jnr/mgr) dengan posisi tak valid → 400', async () => {
    for (const npcId of ['sup', 'jnr', 'mgr']) {
      expect((await kirim({ npcId, messages: userMsgs(1), userContext: ctx, positionId: 'tidak_ada' })).status).toBe(400)
    }
  })

  it('history dipotong 40 pesan terakhir dan tiap pesan maksimal 2000 karakter; role dipaksa user/assistant', async () => {
    callAI.mockResolvedValue({ text: 'oke', provider: 'gemini' })
    const banyak = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'system' : 'user', content: 'x'.repeat(5000) }))
    await kirim({ npcId: 'sinta', messages: banyak, userContext: ctx })
    const [dikirim] = callAI.mock.calls[0]
    expect(dikirim).toHaveLength(40)
    expect(dikirim.every((m: { content: string }) => m.content.length <= 2000)).toBe(true)
    expect(dikirim.every((m: { role: string }) => m.role === 'user' || m.role === 'assistant')).toBe(true)
  })
})

describe('POST /api/chat, hasil interview Sinta', () => {
  it('[SELESAI] → interviewDone, outcome pass, token tidak sampai ke pengguna', async () => {
    callAI.mockResolvedValue({ text: 'Mantap, kamu lolos. [SELESAI]', provider: 'gemini' })
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(12), userContext: ctx })
    expect(r.data).toMatchObject({ interviewDone: true, interviewOutcome: 'pass' })
    expect(String(r.data.reply)).not.toMatch(/\[SELESAI/)
  })

  it('[SELESAI_CATATAN] → conditional (bukan pass, urutan pemeriksaan benar)', async () => {
    callAI.mockResolvedValue({ text: 'Aku terima dengan catatan. [SELESAI_CATATAN]', provider: 'gemini' })
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(12), userContext: ctx })
    expect(r.data).toMatchObject({ interviewDone: true, interviewOutcome: 'conditional' })
    expect(String(r.data.reply)).not.toMatch(/\[/)
  })

  it('[TOLAK] dengan 6 jawaban atau lebih → rejected', async () => {
    callAI.mockResolvedValue({ text: 'Maaf, belum bisa lanjut. [TOLAK]', provider: 'gemini' })
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(6), userContext: ctx })
    expect(r.data.interviewOutcome).toBe('rejected')
    expect(String(r.data.reply)).not.toMatch(/\[TOLAK\]/)
  })

  it('[TOLAK] sebelum 6 jawaban → tidak dihormati: tanpa outcome, token dibuang', async () => {
    callAI.mockResolvedValue({ text: 'Maaf, belum bisa lanjut. [TOLAK]', provider: 'gemini' })
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(5), userContext: ctx })
    expect(r.data.interviewOutcome).toBeUndefined()
    expect(r.data.interviewDone).toBe(false)
    // Perilaku saat ini: teks penolakan tetap sampai ke pengguna walau interview tidak ditutup.
    expect(String(r.data.reply)).toContain('belum bisa lanjut')
  })

  it('token hanya berlaku untuk Sinta: NPC lain tidak menutup interview', async () => {
    callAI.mockResolvedValue({ text: 'Siap. [SELESAI]', provider: 'gemini' })
    const r = await kirim({ npcId: 'jnr', messages: userMsgs(8), userContext: ctx, positionId: 'data_analyst' })
    expect(r.data.interviewDone).toBe(false)
    expect(r.data.interviewOutcome).toBeUndefined()
  })

  it('semua provider AI gagal → failed:true (UI menampilkan tombol kirim ulang), bukan bubble NPC', async () => {
    callAI.mockResolvedValue(null)
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(3), userContext: ctx })
    expect(r.status).toBe(200)
    expect(r.data.failed).toBe(true)
  })

  it('error tak terduga → tetap 200 dengan failed:true', async () => {
    callAI.mockRejectedValue(new Error('boom'))
    const r = await kirim({ npcId: 'sinta', messages: userMsgs(3), userContext: ctx })
    expect(r.status).toBe(200)
    expect(r.data.failed).toBe(true)
  })
})
