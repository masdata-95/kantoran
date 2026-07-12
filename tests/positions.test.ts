import { describe, it, expect } from 'vitest'
import { normalizeLevel, getSalaryRange, SALARY_RANGE, LEVELS, LEVEL_FOR_BG, POSITIONS } from '@/lib/positions'

describe('normalizeLevel', () => {
  it('meneruskan level baru apa adanya', () => {
    expect(normalizeLevel('intern')).toBe('intern')
    expect(normalizeLevel('junior')).toBe('junior')
    expect(normalizeLevel('mid')).toBe('mid')
  })

  it('melebur level lama intern_magang ke intern (run pra-merge harus tetap jalan)', () => {
    expect(normalizeLevel('intern_magang')).toBe('intern')
  })

  it('menerima key background lama (run pra-sistem-level)', () => {
    expect(normalizeLevel('student')).toBe('intern')
    expect(normalizeLevel('fresh_grad')).toBe('intern')
    expect(normalizeLevel('jobseeker')).toBe('junior')
    expect(normalizeLevel('career_switch')).toBe('mid')
  })

  it('fallback ke intern untuk nilai kosong atau tak dikenal', () => {
    expect(normalizeLevel(undefined)).toBe('intern')
    expect(normalizeLevel(null)).toBe('intern')
    expect(normalizeLevel('')).toBe('intern')
    expect(normalizeLevel('ceo')).toBe('intern')
  })
})

describe('getSalaryRange', () => {
  it('mengembalikan range yang benar per level, termasuk key lama', () => {
    expect(getSalaryRange('intern')).toEqual(SALARY_RANGE.intern)
    expect(getSalaryRange('intern_magang')).toEqual(SALARY_RANGE.intern)
    expect(getSalaryRange('student')).toEqual(SALARY_RANGE.intern)
    expect(getSalaryRange('career_switch')).toEqual(SALARY_RANGE.mid)
  })

  it('semua range punya min <= offer <= max', () => {
    for (const r of Object.values(SALARY_RANGE)) {
      expect(r.min).toBeLessThanOrEqual(r.offer)
      expect(r.offer).toBeLessThanOrEqual(r.max)
    }
  })
})

describe('konsistensi data posisi', () => {
  it('hanya ada 3 level yang ditawarkan', () => {
    expect(LEVELS.map(l => l.id)).toEqual(['intern', 'junior', 'mid'])
  })

  it('semua background punya default level yang valid', () => {
    for (const lv of Object.values(LEVEL_FOR_BG)) {
      expect(['intern', 'junior', 'mid']).toContain(lv)
    }
  })

  it('setiap posisi menghasilkan nama role untuk setiap level (termasuk level lama)', () => {
    for (const [key, pos] of Object.entries(POSITIONS)) {
      for (const lv of ['intern', 'junior', 'mid', 'intern_magang', 'student']) {
        const role = pos.getRole(lv)
        expect(role, `${key} getRole(${lv})`).toBeTruthy()
      }
    }
  })

  it('setiap posisi punya rubric dan teaser task mendatang', () => {
    for (const pos of Object.values(POSITIONS)) {
      expect(pos.taskRubric.mustFind.length).toBeGreaterThan(0)
      expect(pos.upcomingTasks.length).toBeGreaterThan(0)
    }
  })
})
