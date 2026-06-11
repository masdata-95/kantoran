'use client'

import { useState, useEffect } from 'react'
import { POSITIONS, SALARY_RANGE } from '@/lib/positions'
import type { BackgroundType } from '@/lib/positions'

interface Props {
  background: BackgroundType | ''
  onApply: (positionId: string) => void
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

  // Prevent body scroll when modal open
  useEffect(() => {
    if (modalJob) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [modalJob])

  const salRange = background ? SALARY_RANGE[background] : SALARY_RANGE['jobseeker']
  const formatSalary = (n: number) => `${(n / 1000000).toFixed(1)} jt`

  const getCategoryLabel = (bg: BackgroundType | '') => {
    const map: Record<string, string> = {
      fresh_grad: 'Fresh Graduate — Intern',
      student: 'Mahasiswa — Intern Magang',
      jobseeker: 'Job Seeker — Junior',
      career_switch: 'Career Switcher — Mid-Level',
    }
    return bg ? map[bg] || '' : ''
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E3DC] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
            <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
            <span className="text-[#E5E3DC] mx-1">·</span>
            <span className="text-xs text-[#888780]">Lowongan Kerja</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-serif text-xl font-bold text-[#111111]">Pilih posisi yang ingin kamu lamar</h1>
              <p className="text-xs text-[#888780] mt-0.5">PT Vantara Nusantara · Jakarta Selatan · Hybrid</p>
            </div>
            {background && (
              <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-3 py-1 text-[10px] font-semibold text-[#0F6E56] flex-shrink-0">
                {getCategoryLabel(background)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Grid */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(POSITIONS).map(([key, pos]) => {
            const detail = POSITION_DETAILS[key]
            const role = pos.getRole(background)

            return (
              <button
                key={key}
                onClick={() => setModalJob(key)}
                style={{ cursor: 'pointer' }}
                className="text-left p-4 rounded-2xl border border-[#E5E3DC] bg-white hover:border-[#0F6E56] hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F1EFE8] flex items-center justify-center text-xl group-hover:bg-[#E1F5EE] transition-colors">
                    {pos.icon}
                  </div>
                  <span className="text-[9px] text-[#888780] font-medium bg-[#F1EFE8] px-2 py-0.5 rounded-full">
                    Tersedia
                  </span>
                </div>

                <p className="text-[10px] font-medium text-[#888780] mb-0.5">PT Vantara Nusantara</p>
                <p className="text-sm font-bold text-[#111111] mb-0.5 group-hover:text-[#0F6E56] transition-colors">{role}</p>
                <p className="text-xs text-[#888780] mb-3">{pos.dept}</p>

                <div className="flex items-center gap-1 mb-3">
                  <span className="text-xs font-semibold text-[#0F6E56]">
                    Rp {formatSalary(salRange.min)}–{formatSalary(salRange.max)}/bln
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {detail?.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] bg-[#F1EFE8] text-[#444441] px-1.5 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="text-[10px] text-[#0F6E56] font-medium group-hover:underline">
                  Lihat detail →
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal Overlay */}
      {modalJob && (() => {
        const pos = POSITIONS[modalJob]
        const detail = POSITION_DETAILS[modalJob]
        const role = pos?.getRole(background)
        if (!pos || !detail) return null

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalJob(null) }}
          >
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl animate-fadeUp">

              {/* Modal header */}
              <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] px-6 py-5 relative">
                <button
                  onClick={() => setModalJob(null)}
                  style={{ cursor: 'pointer' }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors text-sm"
                >
                  ✕
                </button>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                    {pos.icon}
                  </div>
                  <div className="flex-1 pr-8">
                    <p className="text-white/75 text-xs mb-0.5">PT Vantara Nusantara</p>
                    <h2 className="text-white font-bold text-lg leading-tight">{role}</h2>
                    <p className="text-white/75 text-sm">{pos.dept}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 text-white/85 text-xs">
                  <span>📍 Jakarta Selatan</span>
                  <span>🏠 Hybrid 3x/minggu</span>
                  <span>💰 Rp {formatSalary(salRange.min)}–{formatSalary(salRange.max)}/bln</span>
                </div>
              </div>

              {/* Modal body - scrollable */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="p-6 flex flex-col gap-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Tentang Tim</p>
                    <p className="text-sm leading-relaxed text-[#444441]">{detail.about}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Yang Akan Kamu Kerjakan</p>
                    <div className="flex flex-col gap-2">
                      {detail.responsibilities.map((r, i) => (
                        <div key={i} className="flex gap-2 text-sm text-[#444441]">
                          <span className="text-[#0F6E56] flex-shrink-0 mt-0.5">→</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Yang Kami Cari</p>
                    <div className="flex flex-col gap-2">
                      {detail.qualifications.map((q, i) => (
                        <div key={i} className="flex gap-2 text-sm text-[#444441]">
                          <span className="text-[#0F6E56] flex-shrink-0 mt-0.5">✓</span>
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer - CTA */}
              <div className="border-t border-[#E5E3DC] px-6 py-4 bg-[#FAFAF7]">
                <button
                  onClick={() => {
                    setModalJob(null)
                    onApply(modalJob)
                  }}
                  style={{ cursor: 'pointer' }}
                  className="btn-teal w-full py-3.5 text-sm font-semibold"
                >
                  Lamar Posisi Ini →
                </button>
                <p className="text-center text-xs text-[#888780] mt-2">
                  Kamu akan diinterview langsung setelah apply
                </p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
