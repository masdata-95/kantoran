import { describe, it, expect } from 'vitest'
import {
  countRevisions, computeGrade, getWorkStyle,
  GRADE_LABEL, GRADE_REVIEW, WORK_STYLES,
  type PerfHistory,
} from '@/lib/performance'

const feedback = (label: string) => ({ role: 'feedback', data: { label } })

describe('countRevisions', () => {
  it('menghitung kartu REVISION NEEDED di chat supervisor saja', () => {
    const history: PerfHistory = {
      sup_chat: [
        { role: 'npc', text: 'halo' },
        feedback('REVISION NEEDED'),
        feedback('TASK APPROVED'),
        feedback('REVISION NEEDED'),
      ],
      // kartu di room lain tidak ikut dihitung
      jnr: [feedback('REVISION NEEDED')],
    }
    expect(countRevisions(history)).toBe(2)
  })

  it('tetap mengenali label lama dengan emoji (history user beta)', () => {
    const history: PerfHistory = {
      sup_chat: [feedback('🔄 REVISION NEEDED')],
    }
    expect(countRevisions(history)).toBe(1)
  })

  it('nol untuk history kosong', () => {
    expect(countRevisions({})).toBe(0)
    expect(countRevisions({ sup_chat: [] })).toBe(0)
  })
})

describe('computeGrade', () => {
  it('0 revisi = exceeds, 1 = meets, 2+ = needs_improvement', () => {
    expect(computeGrade(0)).toBe('exceeds')
    expect(computeGrade(1)).toBe('meets')
    expect(computeGrade(2)).toBe('needs_improvement')
    expect(computeGrade(5)).toBe('needs_improvement')
  })

  it('setiap grade punya label dan narasi review', () => {
    for (const g of ['exceeds', 'meets', 'needs_improvement'] as const) {
      expect(GRADE_LABEL[g]).toBeTruthy()
      expect(GRADE_REVIEW[g]).toBeTruthy()
    }
  })
})

describe('getWorkStyle', () => {
  it('membaca trait dari pilihan dilema yang sudah dijawab', () => {
    const history: PerfHistory = {
      jnr: [
        { role: 'npc', text: 'gimana menurut lo?' },
        { role: 'choice', data: { chosen: 0, chosenTrait: 'integritas' } },
      ],
    }
    expect(getWorkStyle(history)?.id).toBe('integritas')
  })

  it('null kalau dilema belum dijawab atau trait tak dikenal', () => {
    expect(getWorkStyle({ jnr: [{ role: 'choice', data: {} }] })).toBeNull()
    expect(getWorkStyle({ jnr: [{ role: 'choice', data: { chosenTrait: 'ngasal' } }] })).toBeNull()
    expect(getWorkStyle({})).toBeNull()
  })

  it('semua work style punya narasi review dan catatan surat', () => {
    for (const ws of Object.values(WORK_STYLES)) {
      expect(ws.review).toBeTruthy()
      expect(ws.letterNote).toBeTruthy()
    }
  })
})
