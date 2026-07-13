// Pembanding hasil query untuk grading otomatis tantangan SQL — deterministik,
// tanpa AI, tanpa server. Toleran terhadap urutan baris dan nama kolom alias,
// yang dinilai adalah ISI hasilnya.

export interface QueryResult {
  columns: string[]
  values: unknown[][]
}

// Baris → string kanonik: NULL seragam, angka dibulatkan 2 desimal, string di-trim.
// Hasil di-sort supaya perbandingan tidak peduli urutan baris.
export function normalizeRows(result: QueryResult): string[] {
  return result.values
    .map(row => row.map(v => {
      if (v === null || v === undefined) return 'NULL'
      if (typeof v === 'number') return String(Math.round(v * 100) / 100)
      const s = String(v).trim()
      const n = Number(s)
      // String numerik murni ('4500') disamakan dengan angka; '2026-01' bukan numerik → tetap string
      if (s !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s)) {
        return String(Math.round(n * 100) / 100)
      }
      return s
    }).join('|'))
    .sort()
}

export function resultsMatch(a: QueryResult, b: QueryResult): boolean {
  if (a.columns.length !== b.columns.length) return false
  if (a.values.length !== b.values.length) return false
  const na = normalizeRows(a)
  const nb = normalizeRows(b)
  return na.every((row, i) => row === nb[i])
}
