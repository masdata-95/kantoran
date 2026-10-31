import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { tahapUntuk, topikAktif, pecahGelembung, PANEL_MAKS, PANEL_TUTUP_MULAI } from '../lib/interviewPanel'
import { rapikanUmpanBalik } from '../lib/panelFeedback'

describe('naskah giliran panel', () => {
  it('urutan penanya mengikuti rencana: HR, HR+atasan, atasan, atasan+HR, HR', () => {
    expect(tahapUntuk(1).pembicara).toEqual(['sinta'])
    expect(tahapUntuk(2).pembicara).toEqual(['sinta', 'sup'])
    expect(tahapUntuk(3).pembicara).toEqual(['sup'])
    expect(tahapUntuk(4).pembicara).toEqual(['sup', 'sinta'])
    expect(tahapUntuk(5).pembicara).toEqual(['sinta'])
  })

  it('tidak ada tahap yang boleh menutup sebelum topik gaji; sesudahnya boleh', () => {
    for (let n = 1; n < PANEL_TUTUP_MULAI; n++) expect(tahapUntuk(n).bolehTutup).toBe(false)
    expect(tahapUntuk(PANEL_TUTUP_MULAI).bolehTutup).toBe(true)
    expect(tahapUntuk(PANEL_MAKS).bolehTutup).toBe(true)
  })

  it('atasan tidak pernah dapat giliran di tahap gaji pertama (HR bertanya ekspektasi)', () => {
    expect(tahapUntuk(5).pembicara).not.toContain('sup')
  })

  it('topik maju 0 → 1 → 2 dan semua lewat ketika selesai', () => {
    expect(topikAktif(0, false)).toBe(0)
    expect(topikAktif(1, false)).toBe(0)
    expect(topikAktif(2, false)).toBe(1)
    expect(topikAktif(3, false)).toBe(1)
    expect(topikAktif(5, false)).toBe(2)
    expect(topikAktif(7, true)).toBe(3)
  })
})

describe('pecahGelembung', () => {
  it('memecah dua penanya sesuai penanda', () => {
    const g = pecahGelembung('[SINTA] Oke, aku serahkan ke Rizky ya.\n[ATASAN] Halo. Langkah pertamamu apa?', tahapUntuk(2))
    expect(g).toEqual([
      { npc: 'sinta', text: 'Oke, aku serahkan ke Rizky ya.' },
      { npc: 'sup', text: 'Halo. Langkah pertamamu apa?' },
    ])
  })

  it('penanya yang tidak diizinkan di tahap itu dibuang (atasan tidak bicara saat HR bertanya)', () => {
    const g = pecahGelembung('[SINTA] Ceritakan satu proyekmu.\n[ATASAN] Gaji berapa?', tahapUntuk(1))
    expect(g).toEqual([{ npc: 'sinta', text: 'Ceritakan satu proyekmu.' }])
  })

  it('tanpa penanda sama sekali → milik penanya pertama tahap itu', () => {
    expect(pecahGelembung('Ceritakan satu proyekmu.', tahapUntuk(3))).toEqual([{ npc: 'sup', text: 'Ceritakan satu proyekmu.' }])
  })

  it('kalau semua penanda salah, teks tetap dipakai oleh penanya yang benar', () => {
    const g = pecahGelembung('[ATASAN] Kenapa Vantara?', tahapUntuk(1))
    expect(g).toEqual([{ npc: 'sinta', text: 'Kenapa Vantara?' }])
  })

  it('baris lanjutan tanpa penanda menempel ke gelembung sebelumnya, dan penanda tidak bocor', () => {
    const g = pecahGelembung('[SINTA] Oke.\nLanjut ya.', tahapUntuk(1))
    expect(g).toEqual([{ npc: 'sinta', text: 'Oke. Lanjut ya.' }])
    expect(JSON.stringify(g)).not.toMatch(/\[SINTA\]|\[ATASAN\]/)
  })
})

describe('rapikanUmpanBalik', () => {
  const bagus = { hr: { bagus: 'Perkenalanmu runtut.', tajam: 'Sebut hasil angka.' }, atasan: { bagus: 'Kamu cek data dulu.', tajam: 'Jelaskan alasannya.' }, contoh: 'Saya merapikan data penjualan dan hasilnya ...', catatanAtasan: 'Katanya mulai dari cek duplikat.' }

  it('bentuk benar → lolos dan dirapikan', () => {
    expect(rapikanUmpanBalik(bagus)).toMatchObject({ hr: { bagus: 'Perkenalanmu runtut.' }, catatanAtasan: 'Katanya mulai dari cek duplikat.' })
  })

  it('markdown dan tanda hubung panjang dibersihkan', () => {
    const r = rapikanUmpanBalik({ ...bagus, hr: { bagus: '**Bagus** — runtut', tajam: 'tajamkan' } })
    expect(r?.hr.bagus).toBe('Bagus, runtut')
  })

  it('bagian wajib hilang → null (kartu dilewati)', () => {
    expect(rapikanUmpanBalik({ hr: { bagus: 'x', tajam: '' }, atasan: bagus.atasan })).toBeNull()
    expect(rapikanUmpanBalik(null)).toBeNull()
    expect(rapikanUmpanBalik('bukan objek')).toBeNull()
  })

  it('contoh dan catatan opsional boleh kosong', () => {
    expect(rapikanUmpanBalik({ hr: bagus.hr, atasan: bagus.atasan })).toMatchObject({ contoh: '', catatanAtasan: '' })
  })
})

// ── rute /api/chat untuk npcId 'panel' ───────────────────────────────────────────
const callAI = vi.fn()
const getAuthUser = vi.fn()
const checkLimit = vi.fn()
const catatEvent = vi.fn()

vi.mock('@/lib/ai', () => ({ callAI: (...a: unknown[]) => callAI(...a), getLastAIFailure: () => 'gemini:503' }))
vi.mock('@/lib/events', () => ({ catatEvent: (...a: unknown[]) => catatEvent(...a) }))
vi.mock('@/lib/serverAuth', () => ({ getAuthUser: (...a: unknown[]) => getAuthUser(...a) }))
vi.mock('@/lib/rateLimit', () => ({
  checkLimit: (...a: unknown[]) => checkLimit(...a),
  LIMIT_MESSAGE: { chat: 'Batas chat hari ini tercapai.' },
}))

import { POST } from '../app/api/chat/route'

const ctx = { firstName: 'Mas', email: 'a@b.c', background: 'fresh_grad', bgRole: 'Junior Data Analyst', position: 'data_analyst', level: 'junior', experience: '', motivation: '' }

function percakapan(n: number, gajiDisebut = true) {
  const out: { role: string; content: string }[] = []
  for (let i = 0; i < n; i++) {
    out.push({ role: 'user', content: i === 5 && gajiDisebut ? 'ekspektasi gaji saya 5 juta' : `jawaban ${i + 1}` })
    if (i < n - 1) out.push({ role: 'assistant', content: `[SINTA] pertanyaan ${i + 1}` })
  }
  return out
}

async function kirim(n: number, gajiDisebut = true) {
  const req = { json: async () => ({ npcId: 'panel', messages: percakapan(n, gajiDisebut), userContext: ctx, positionId: 'data_analyst' }) } as unknown as NextRequest
  const res = await POST(req)
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  callAI.mockReset()
  getAuthUser.mockReset().mockResolvedValue({ id: 'u1', email: 'a@b.c' })
  checkLimit.mockReset().mockResolvedValue(true)
  catatEvent.mockReset()
})

describe('POST /api/chat, panel', () => {
  it('giliran dengan dua penanya → dua gelembung, token tidak bocor', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Oke, lanjut ke Rizky ya.\n[ATASAN] Kalau datanya ganda, kamu apakan?', provider: 'gemini' })
    const r = await kirim(2)
    expect(r.pesan).toEqual([
      { npc: 'sinta', text: 'Oke, lanjut ke Rizky ya.' },
      { npc: 'sup', text: 'Kalau datanya ganda, kamu apakan?' },
    ])
    expect(r.interviewDone).toBe(false)
  })

  it('prompt memuat tahap yang benar dan memberi tahu model penanya yang boleh bicara', async () => {
    callAI.mockResolvedValue({ text: '[SUP] x', provider: 'gemini' })
    await kirim(3)
    const prompt = callAI.mock.calls[0][1] as string
    expect(prompt).toContain('[ATASAN]')
    expect(prompt).toContain('pertanyaan lanjutan')
    // Tahap teknis tidak membuka aturan gaji.
    expect(prompt).not.toContain('STANDAR GAJI INTERNAL')
  })

  it('tahap gaji membawa standar gaji ke prompt', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Ekspektasimu berapa?', provider: 'gemini' })
    await kirim(5)
    expect(callAI.mock.calls[0][1]).toContain('STANDAR GAJI INTERNAL')
  })

  it('token menutup sebelum jawaban ke-6 diabaikan (tidak selesai, token tak tampil)', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Terima kasih, sampai jumpa. [SELESAI]', provider: 'gemini' })
    const r = await kirim(4)
    expect(r.interviewDone).toBe(false)
    expect(r.interviewOutcome).toBeUndefined()
    expect(String(r.reply)).not.toMatch(/\[SELESAI/)
  })

  it('[SELESAI] sesudah gaji dibahas → pass; [SELESAI_CATATAN] → conditional', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Deal 5 juta, offering sudah di Inbox.\n[ATASAN] Sampai ketemu di hari pertama. [SELESAI]', provider: 'gemini' })
    expect(await kirim(7)).toMatchObject({ interviewDone: true, interviewOutcome: 'pass' })
    callAI.mockResolvedValue({ text: '[SINTA] Aku terima dengan catatan. [SELESAI_CATATAN]', provider: 'gemini' })
    expect(await kirim(7)).toMatchObject({ interviewDone: true, interviewOutcome: 'conditional' })
  })

  it('token tanpa topik gaji pernah dibahas → tidak menutup', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Selesai ya. [SELESAI]', provider: 'gemini' })
    const r = await kirim(7, false)
    expect(r.interviewDone).toBe(false)
  })

  it('batas keras: jawaban ke-9 menutup walau model tidak memberi token', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Tawaran akhir 5 juta ya.\n[ATASAN] Sampai jumpa.', provider: 'gemini' })
    const r = await kirim(PANEL_MAKS)
    expect(r.interviewDone).toBe(true)
    expect(r.interviewOutcome).toBe('pass')
  })

  it('[TOLAK] tidak pernah menolak di panel', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Maaf belum bisa lanjut. [TOLAK]', provider: 'gemini' })
    const r = await kirim(7)
    expect(r.interviewOutcome).toBeUndefined()
    expect(String(r.reply)).not.toMatch(/\[TOLAK\]/)
  })

  it('nego berlanjut (belum ditutup) → hanya HR yang bicara', async () => {
    callAI.mockResolvedValue({ text: '[SINTA] Angka itu belum bisa kami penuhi.\n[ATASAN] Setuju.', provider: 'gemini' })
    const r = await kirim(7)
    expect(r.interviewDone).toBe(false)
    expect(r.pesan).toEqual([{ npc: 'sinta', text: 'Angka itu belum bisa kami penuhi.' }])
  })

  it('AI gagal → failed:true dan tercatat sebagai ai_error', async () => {
    callAI.mockResolvedValue(null)
    const r = await kirim(2)
    expect(r.failed).toBe(true)
    expect(catatEvent).toHaveBeenCalledWith('u1', 'ai_error', { npc: 'panel', alasan: 'gemini:503' })
  })
})
