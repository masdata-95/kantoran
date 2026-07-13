import { describe, it, expect } from 'vitest'
import { normalizeRows, resultsMatch, type QueryResult } from '@/lib/sqlCompare'

const q = (columns: string[], values: unknown[][]): QueryResult => ({ columns, values })

describe('resultsMatch (grading otomatis tantangan SQL)', () => {
  it('cocok meski urutan baris berbeda', () => {
    const a = q(['sku', 'total'], [['LUM-001', 100], ['RTC-002', 50]])
    const b = q(['sku', 'total'], [['RTC-002', 50], ['LUM-001', 100]])
    expect(resultsMatch(a, b)).toBe(true)
  })

  it('cocok meski nama kolom alias berbeda (yang dinilai isinya)', () => {
    const a = q(['SUM(revenue)'], [[123456]])
    const b = q(['total'], [[123456]])
    expect(resultsMatch(a, b)).toBe(true)
  })

  it('angka dari string numerik disamakan dengan angka asli', () => {
    const a = q(['n'], [['4500']])
    const b = q(['n'], [[4500]])
    expect(resultsMatch(a, b)).toBe(true)
  })

  it('string tanggal YYYY-MM TIDAK dianggap angka', () => {
    expect(normalizeRows(q(['bulan'], [['2026-01']]))[0]).toBe('2026-01')
  })

  it('pembulatan 2 desimal menoleransi floating point', () => {
    const a = q(['avg'], [[3.14159]])
    const b = q(['avg'], [[3.14]])
    expect(resultsMatch(a, b)).toBe(true)
  })

  it('NULL seragam dan berbeda dari string kosong', () => {
    expect(resultsMatch(q(['x'], [[null]]), q(['x'], [[null]]))).toBe(true)
    expect(resultsMatch(q(['x'], [[null]]), q(['x'], [['']]))).toBe(false)
  })

  it('tidak cocok kalau jumlah baris atau kolom beda', () => {
    expect(resultsMatch(q(['a'], [[1], [2]]), q(['a'], [[1]]))).toBe(false)
    expect(resultsMatch(q(['a'], [[1]]), q(['a', 'b'], [[1, 2]]))).toBe(false)
  })

  it('tidak cocok kalau nilai beda', () => {
    expect(resultsMatch(q(['a'], [[1]]), q(['a'], [[2]]))).toBe(false)
  })
})
