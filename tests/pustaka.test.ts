import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

interface Modul {
  slug: string
  grup: string
  title: string
  sort_order: number
  lessons: { slug: string; title: string; video_code: string; sort_order: number }[]
}

const katalog: Modul[] = JSON.parse(readFileSync(join(__dirname, '..', 'content', 'pustaka', 'katalog.json'), 'utf8'))
const semuaLesson = katalog.flatMap(m => m.lessons)

describe('katalog Pustaka Video', () => {
  it('memuat semua 84 video (45 Excel + 39 Looker)', () => {
    expect(semuaLesson).toHaveLength(84)
    expect(semuaLesson.filter(l => l.video_code.startsWith('excel-'))).toHaveLength(45)
    expect(semuaLesson.filter(l => l.video_code.startsWith('looker-'))).toHaveLength(39)
  })

  it('slug modul, slug pelajaran, dan kode video unik', () => {
    expect(new Set(katalog.map(m => m.slug)).size).toBe(katalog.length)
    expect(new Set(semuaLesson.map(l => l.slug)).size).toBe(semuaLesson.length)
    expect(new Set(semuaLesson.map(l => l.video_code)).size).toBe(semuaLesson.length)
  })

  it('kode video berbentuk yang diterima Worker video', () => {
    for (const l of semuaLesson) expect(l.video_code).toMatch(/^(excel-t\d{2}-\d+|looker-\d+-\d+-\d+)$/)
  })

  it('urutan modul dan pelajaran naik tanpa lubang, tiap modul punya judul dan grup', () => {
    katalog.forEach((m, i) => {
      expect(m.sort_order).toBe(i + 1)
      expect(m.title.trim()).not.toBe('')
      expect(['Excel', 'Looker Studio']).toContain(m.grup)
      m.lessons.forEach((l, j) => {
        expect(l.sort_order).toBe(j + 1)
        expect(l.title.trim()).not.toBe('')
      })
    })
  })

  it('7 pelajaran posisi yang sudah punya video_code tidak bentrok dengan kode di katalog yang tidak ada', () => {
    const kode = new Set(semuaLesson.map(l => l.video_code))
    for (const c of ['excel-t15-3', 'excel-t12-1', 'excel-t23-1', 'excel-t11-1', 'excel-t17-2', 'looker-2-1-1', 'looker-9-1-1']) {
      expect(kode.has(c)).toBe(true)
    }
  })
})
