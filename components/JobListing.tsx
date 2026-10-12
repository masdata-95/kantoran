'use client'

import { useState, useEffect } from 'react'
import { POSITIONS, SALARY_RANGE, LEVELS, LEVEL_FOR_BG, normalizeLevel } from '@/lib/positions'
import type { BackgroundType, LevelType } from '@/lib/positions'
import { supabase, authFetch } from '@/lib/supabase'

interface Props {
  background: BackgroundType | ''
  onApply: (positionId: string, level: LevelType) => void
}

// Run tersimpan per posisi — job listing merangkap hub karir multi-role
interface RunInfo {
  position: string
  level: string | null
  step: number
  coins: number
  tasks_done: number
}

const runStatusLabel = (step: number) => {
  if (step >= 10) return 'Hari 1 selesai'
  if (step >= 5) return 'Mengerjakan task'
  if (step >= 3) return 'Hari pertama'
  if (step >= 2) return 'Offering letter'
  return 'Tahap interview'
}

const POSITION_DETAILS: Record<string, {
  about: string
  responsibilities: string[]
  qualifications: string[]
  tags: string[]
}> = {
  data_analyst: {
    about: 'Tim Data & Analytics PT Vantara Nusantara mengolah data bisnis dari lini produk Lumière, Roots&Co, dan Vanta Glow untuk menghasilkan insight yang mendukung keputusan strategis perusahaan.',
    responsibilities: [
      'Mengolah dan membersihkan data penjualan dari berbagai channel distribusi',
      'Membuat laporan mingguan dan bulanan untuk tim Marketing dan Finance',
      'Mengidentifikasi tren penjualan dan anomali data',
      'Berkolaborasi dengan tim lintas departemen untuk kebutuhan data',
    ],
    qualifications: [
      'Familiar dengan Excel atau Google Sheets (pivot table, VLOOKUP)',
      'Kemampuan analisis data dasar dan berpikir logis',
      'Teliti dan terbiasa bekerja dengan angka',
      'Nilai plus: pernah belajar SQL atau Python',
    ],
    tags: ['Excel', 'SQL', 'Analitik', 'Laporan'],
  },
  marketing_analyst: {
    about: 'Departemen Marketing PT Vantara Nusantara mengelola strategi brand dan campaign untuk ketiga lini produk. Tim ini bekerja dengan data campaign, consumer insight, dan analisis kompetitor.',
    responsibilities: [
      'Menganalisis performa campaign digital (Meta, TikTok, Google Ads)',
      'Menyiapkan laporan insight consumer untuk tim brand',
      'Membantu riset kompetitor dan tren pasar',
      'Mengukur efektivitas konten dan channel distribusi',
    ],
    qualifications: [
      'Memahami konsep dasar digital marketing dan metrik campaign',
      'Familiar dengan CTR, conversion rate, CPA',
      'Nilai plus: pernah kelola akun sosial media atau konten',
      'Kreatif dan punya interest di dunia brand',
    ],
    tags: ['Digital Marketing', 'Analitik', 'Social Media', 'Data'],
  },
  finance_analyst: {
    about: 'Tim Finance PT Vantara Nusantara mengelola perencanaan keuangan, budgeting, dan pelaporan finansial untuk seluruh operasional perusahaan yang mencakup tiga lini produk FMCG.',
    responsibilities: [
      'Membantu penyusunan laporan keuangan bulanan',
      'Melakukan variance analysis antara budget dan aktual',
      'Menyiapkan data untuk kebutuhan audit internal',
      'Berkoordinasi dengan departemen lain untuk rekonsiliasi anggaran',
    ],
    qualifications: [
      'Memahami dasar-dasar laporan keuangan (P&L, neraca)',
      'Teliti dan terbiasa bekerja dengan angka dalam volume besar',
      'Nilai plus: background akuntansi atau manajemen keuangan',
      'Familiar dengan Excel untuk financial modeling',
    ],
    tags: ['Excel', 'Keuangan', 'Akuntansi', 'Analitik'],
  },
  hr_generalist: {
    about: 'HR PT Vantara Nusantara mengelola seluruh aspek people management dari rekrutmen, onboarding, employee relations, hingga pengembangan talenta.',
    responsibilities: [
      'Membantu proses rekrutmen dari screening CV hingga koordinasi interview',
      'Mendukung program onboarding karyawan baru',
      'Mengelola administrasi HR dan data karyawan',
      'Membantu pelaksanaan program employee engagement',
    ],
    qualifications: [
      'Kemampuan komunikasi verbal dan tulisan yang baik',
      'Empati dan kemampuan mendengarkan yang kuat',
      'Terorganisir dan mampu mengelola banyak tugas sekaligus',
      'Nilai plus: pernah terlibat rekrutmen atau event organizing',
    ],
    tags: ['Rekrutmen', 'Komunikasi', 'People', 'Administrasi'],
  },
  admin_ops: {
    about: 'Tim Operations & Sales Support PT Vantara Nusantara adalah nadi administrasi perusahaan: memastikan order, invoice, kontrak, dan dokumen operasional dari tiga lini produk tercatat rapi dan bisa dipercaya.',
    responsibilities: [
      'Merekap dan memvalidasi invoice serta pembayaran distributor',
      'Mengelola arsip kontrak dan dokumen operasional',
      'Mengatur jadwal meeting dan kebutuhan administratif tim',
      'Menjadi penghubung administrasi antara Sales, Finance, dan Gudang',
    ],
    qualifications: [
      'Teliti, rapi, dan bisa dipercaya memegang dokumen penting',
      'Excel dasar: sort, filter, SUM, dan rekap sederhana',
      'Komunikasi tertulis yang jelas dan sopan',
      'Nilai plus: pernah pegang administrasi organisasi, toko, atau usaha keluarga',
    ],
    tags: ['Excel', 'Administrasi', 'Dokumen', 'Teliti'],
  },
  bizdev: {
    about: 'Tim Business Development PT Vantara Nusantara bertugas mengidentifikasi dan mengembangkan peluang bisnis baru, termasuk partnership strategis dan pengembangan channel distribusi.',
    responsibilities: [
      'Melakukan riset dan evaluasi calon mitra bisnis potensial',
      'Membantu persiapan proposal dan presentasi untuk calon partner',
      'Menganalisis peluang pasar baru untuk produk Vantara',
      'Berkoordinasi dengan tim internal untuk eksekusi partnership',
    ],
    qualifications: [
      'Kemampuan komunikasi dan presentasi yang kuat',
      'Analytical thinking dan pemahaman dasar bisnis',
      'Ambisius, proaktif, dan tidak takut ditolak',
      'Nilai plus: pernah terlibat kegiatan sales atau pitching',
    ],
    tags: ['Business Development', 'Negosiasi', 'Riset', 'Strategi'],
  },
}

export default function JobListing({ background, onApply }: Props) {
  const [modalJob, setModalJob] = useState<string | null>(null)
  const [runs, setRuns] = useState<Record<string, RunInfo>>({})
  const defaultLevel: LevelType = background ? (LEVEL_FOR_BG[background] || 'intern') : 'intern'
  const [pickedLevel, setPickedLevel] = useState<LevelType>(defaultLevel)
  const [resetting, setResetting] = useState(false)
  const [confirmReplay, setConfirmReplay] = useState(false)
  const [resetError, setResetError] = useState('')
  // Kehadiran sosial: jumlah orang aktif minggu ini (tampil kalau cukup ramai)
  const [activeCount, setActiveCount] = useState<number | null>(null)

  useEffect(() => {
    authFetch('/api/stats')
      .then(r => r.json())
      .then(d => setActiveCount(typeof d.activeThisWeek === 'number' ? d.activeThisWeek : null))
      .catch(() => {})
  }, [])

  // Kunci scroll halaman + Escape untuk menutup saat modal terbuka
  useEffect(() => {
    if (!modalJob) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalJob(null) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [modalJob])

  // Muat status run tersimpan per posisi (Mulai / Lanjutkan / Selesai)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/progress?list=1')
        const data = await res.json()
        if (cancelled) return
        const map: Record<string, RunInfo> = {}
        for (const r of (data.progresses || []) as RunInfo[]) {
          if (r.position && r.step > 0) map[r.position] = r
        }
        setRuns(map)
      } catch { /* tanpa status pun listing tetap jalan */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Buka modal detail: pre-select level dari run tersimpan, atau default background
  const openJobModal = (key: string) => {
    const run = runs[key]
    setPickedLevel(run?.level ? normalizeLevel(run.level) : defaultLevel)
    setConfirmReplay(false)
    setResetError('')
    setModalJob(key)
  }

  const formatSalary = (n: number) => (n / 1000000).toFixed(1).replace(/\.0$/, '').replace('.', ',')
  const salaryText = (lv: LevelType) => `Rp ${formatSalary(SALARY_RANGE[lv].min)} sampai ${formatSalary(SALARY_RANGE[lv].max)} juta`

  const handleReplay = async (positionId: string, level: LevelType) => {
    setResetting(true)
    setResetError('')
    try {
      const res = await authFetch('/api/reset', { method: 'POST', body: JSON.stringify({ position: positionId }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onApply(positionId, level)
    } catch {
      setResetError('Gagal memulai ulang. Periksa koneksi lalu coba lagi.')
      setResetting(false)
    }
  }

  const runCount = Object.keys(runs).length

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-white border-b border-[#E5E3DC] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#0F6E56]">Kantoran</span>
          <button onClick={() => supabase.auth.signOut()} style={{ cursor: 'pointer' }} className="text-[13px] text-[#6B6A64] hover:text-[#1A1A18]">
            Keluar akun
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[22px] font-semibold text-[#1A1A18]">Lowongan di PT Vantara Nusantara</h1>
        <p className="text-sm text-[#4A4A45] mt-1 leading-relaxed">
          Perusahaan personal care di Jakarta Selatan, kerja hybrid tiga hari di kantor.
          {runCount === 0
            ? ' Pilih satu posisi untuk dilamar. Posisi lain tetap bisa kamu coba nanti.'
            : ' Lamaran yang sudah berjalan tersimpan, kamu bisa pindah posisi kapan saja.'}
        </p>
        {activeCount !== null && activeCount >= 3 && (
          <p className="text-[13px] text-[#6B6A64] mt-2 tabular">
            {activeCount} orang menjalani simulasi di sini minggu ini.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {Object.entries(POSITIONS).map(([key, pos]) => {
            const detail = POSITION_DETAILS[key]
            const run = runs[key]
            const role = run?.level ? pos.getRole(run.level) : pos.title
            const isDone = !!run && run.step >= 10
            const isActive = !!run && !isDone

            return (
              <button
                key={key}
                onClick={() => openJobModal(key)}
                style={{ cursor: 'pointer' }}
                className={`text-left p-4 rounded-xl border bg-white hover:border-[#0F6E56] transition-colors ${
                  isActive ? 'border-[#0F6E56]/60' : 'border-[#E5E3DC]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#1A1A18]">{role}</p>
                    <p className="text-[13px] text-[#6B6A64]">{pos.dept}</p>
                  </div>
                  {isDone ? (
                    <span className="text-[11px] font-medium bg-[#E1F5EE] text-[#0F6E56] px-2 py-0.5 rounded flex-shrink-0">Hari 1 selesai</span>
                  ) : isActive ? (
                    <span className="text-[11px] font-medium bg-[#FAEEDA] text-[#854F0B] px-2 py-0.5 rounded flex-shrink-0">{runStatusLabel(run.step)}</span>
                  ) : null}
                </div>

                <p className="text-[13px] text-[#4A4A45] mt-3 line-clamp-2">{detail?.responsibilities[0]}.</p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F1EFE8]">
                  <span className="text-[13px] text-[#1A1A18] tabular">
                    {run?.level
                      ? salaryText(normalizeLevel(run.level))
                      : `Rp ${formatSalary(SALARY_RANGE.intern.min)} sampai ${formatSalary(SALARY_RANGE.mid.max)} juta`}
                  </span>
                  <span className="text-[13px] font-medium text-[#0F6E56]">
                    {isActive ? 'Lanjutkan' : isDone ? 'Lihat' : 'Detail'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-[13px] text-[#6B6A64] mt-4">Gaji per bulan, tergantung jenjang yang kamu pilih.</p>
      </main>

      {modalJob && (() => {
        const pos = POSITIONS[modalJob]
        const detail = POSITION_DETAILS[modalJob]
        if (!pos || !detail) return null
        const run = runs[modalJob]
        const isDone = !!run && run.step >= 10
        const isActive = !!run && !isDone
        const runLevel = run?.level ? normalizeLevel(run.level) : null
        const shownLevel = isActive && runLevel ? runLevel : pickedLevel
        const role = pos.getRole(shownLevel)

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ backgroundColor: 'rgba(20,20,18,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalJob(null) }}
            role="dialog" aria-modal="true" aria-labelledby="job-title"
          >
            <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-fadeUp">
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#E5E3DC] flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-[#6B6A64]">PT Vantara Nusantara · {pos.dept}</p>
                  <h2 id="job-title" className="text-lg font-semibold text-[#1A1A18] leading-snug mt-0.5">{role}</h2>
                  <p className="text-[13px] text-[#4A4A45] mt-1 tabular">Jakarta Selatan · Hybrid 3 hari WFO · {salaryText(shownLevel)}/bulan</p>
                </div>
                <button
                  onClick={() => setModalJob(null)}
                  style={{ cursor: 'pointer' }}
                  aria-label="Tutup"
                  className="w-8 h-8 -mr-2 rounded-md flex items-center justify-center text-[#6B6A64] hover:bg-[#F1EFE8] flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="px-5 sm:px-6 py-5 flex flex-col gap-6">
                  {isActive && (
                    <p className="text-[13px] text-[#854F0B] bg-[#FAEEDA]/70 rounded-lg px-3.5 py-2.5 leading-relaxed">
                      Lamaranmu di sini masih berjalan ({runStatusLabel(run.step).toLowerCase()}). Chat dan progress tersimpan, kamu lanjut dari titik terakhir.
                    </p>
                  )}
                  {isDone && (
                    <p className="text-[13px] text-[#0F6E56] bg-[#E1F5EE]/70 rounded-lg px-3.5 py-2.5 leading-relaxed">
                      Hari pertama di posisi ini sudah selesai, dengan {run.tasks_done} task dan {run.coins} coin. Buka lagi untuk membaca surat referensi dan chat timmu.
                    </p>
                  )}

                  {!isActive && (
                    <fieldset>
                      <legend className="text-sm font-medium text-[#1A1A18] mb-2">Jenjang yang dilamar</legend>
                      <div className="flex flex-col gap-2" role="radiogroup">
                        {LEVELS.map(lv => {
                          const isPicked = pickedLevel === lv.id
                          const isSuggested = lv.id === defaultLevel
                          return (
                            <button
                              key={lv.id}
                              type="button"
                              role="radio"
                              aria-checked={isPicked}
                              onClick={() => setPickedLevel(lv.id)}
                              style={{ cursor: 'pointer' }}
                              className={`flex items-start gap-3 text-left px-3.5 py-3 rounded-lg border transition-colors ${
                                isPicked ? 'border-[#0F6E56] bg-[#E1F5EE]/60' : 'border-[#D8D6CE] hover:border-[#0F6E56]'
                              }`}
                            >
                              <span className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${isPicked ? 'border-[#0F6E56]' : 'border-[#B8B6AE]'}`}>
                                {isPicked && <span className="w-2 h-2 rounded-full bg-[#0F6E56]" />}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-[#1A1A18]">{lv.label}</span>
                                {isSuggested && <span className="ml-2 text-[11px] text-[#6B6A64]">sesuai profilmu</span>}
                                <span className="block text-[13px] text-[#4A4A45] mt-0.5">{lv.desc}</span>
                              </span>
                              <span className="text-[13px] text-[#4A4A45] flex-shrink-0 tabular">
                                {formatSalary(SALARY_RANGE[lv.id].min)}–{formatSalary(SALARY_RANGE[lv.id].max)} jt
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[13px] text-[#6B6A64] mt-2 leading-relaxed">
                        Jenjang menentukan rentang gaji yang bisa kamu nego, kedalaman pertanyaan interview, dan standar penilaian task.
                      </p>
                    </fieldset>
                  )}

                  <section>
                    <h3 className="text-sm font-medium text-[#1A1A18] mb-1.5">Tentang tim</h3>
                    <p className="text-sm leading-relaxed text-[#4A4A45]">{detail.about}</p>
                  </section>

                  <section>
                    <h3 className="text-sm font-medium text-[#1A1A18] mb-1.5">Pekerjaanmu</h3>
                    <ul className="list-disc pl-5 flex flex-col gap-1 text-sm text-[#4A4A45] marker:text-[#B8B6AE]">
                      {detail.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-sm font-medium text-[#1A1A18] mb-1.5">Yang kami cari</h3>
                    <ul className="list-disc pl-5 flex flex-col gap-1 text-sm text-[#4A4A45] marker:text-[#B8B6AE]">
                      {detail.qualifications.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </section>
                </div>
              </div>

              <div className="border-t border-[#E5E3DC] px-5 sm:px-6 py-4 bg-white">
                {isActive ? (
                  <button
                    onClick={() => { setModalJob(null); onApply(modalJob, normalizeLevel(run.level)) }}
                    style={{ cursor: 'pointer' }}
                    className="btn-teal w-full py-3 text-sm"
                  >
                    Lanjutkan lamaran ini
                  </button>
                ) : isDone ? (
                  confirmReplay ? (
                    <div>
                      <p className="text-[13px] text-[#4A4A45] mb-3 leading-relaxed">
                        Mengulang akan menghapus chat, gaji, dan surat referensi di posisi ini, lalu mulai interview baru sebagai {pos.getRole(pickedLevel)}. Posisi lain tidak terpengaruh.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmReplay(false)} disabled={resetting} style={{ cursor: 'pointer' }} className="btn-teal-outline flex-1 py-2.5 text-sm">Batal</button>
                        <button onClick={() => handleReplay(modalJob, pickedLevel)} disabled={resetting} style={{ cursor: resetting ? 'wait' : 'pointer' }} className="btn-teal flex-1 py-2.5 text-sm">
                          {resetting ? 'Menyiapkan...' : 'Ya, ulangi'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmReplay(true)} style={{ cursor: 'pointer' }} className="btn-teal-outline flex-1 py-2.5 text-sm">
                        Ulangi dari awal
                      </button>
                      <button
                        onClick={() => { setModalJob(null); onApply(modalJob, runLevel || pickedLevel) }}
                        style={{ cursor: 'pointer' }}
                        className="btn-teal flex-1 py-2.5 text-sm"
                      >
                        Buka lagi
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => { setModalJob(null); onApply(modalJob, pickedLevel) }}
                    style={{ cursor: 'pointer' }}
                    className="btn-teal w-full py-3 text-sm"
                  >
                    Lamar sebagai {role}
                  </button>
                )}
                {resetError && <p className="text-[13px] text-[#B42318] mt-2" role="alert">{resetError}</p>}
                {!isActive && !isDone && (
                  <p className="text-center text-[13px] text-[#6B6A64] mt-2">Setelah melamar, Sinta dari HR langsung mengajakmu interview lewat chat.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
