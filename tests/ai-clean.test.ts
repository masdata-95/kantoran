import { describe, it, expect } from 'vitest'
import { cleanResponse } from '@/lib/ai'

describe('cleanResponse (anti AI-slop pada balasan NPC)', () => {
  it('membuang markdown bold/italic/header/bullet', () => {
    expect(cleanResponse('**tebal** dan *miring*')).toBe('tebal dan miring')
    expect(cleanResponse('# Judul\nisi')).toBe('Judul\nisi')
    expect(cleanResponse('- poin satu')).toBe('poin satu')
  })

  it('mengganti em/en dash jeda kalimat dengan koma', () => {
    expect(cleanResponse('bagus — tapi kurang detail')).toBe('bagus, tapi kurang detail')
    expect(cleanResponse('oke – lanjut')).toBe('oke, lanjut')
    expect(cleanResponse('ini penting - banget')).toBe('ini penting, banget')
  })

  it('TIDAK merusak kata majemuk berimbuhan tanda hubung', () => {
    expect(cleanResponse('kerjaan sehari-hari')).toBe('kerjaan sehari-hari')
    expect(cleanResponse('pelan-pelan aja')).toBe('pelan-pelan aja')
  })

  it('merapikan koma dobel dan koma sebelum tanda baca akhir', () => {
    expect(cleanResponse('oke —, siap')).toBe('oke, siap')
    expect(cleanResponse('mantap —.')).toBe('mantap.')
  })
})
