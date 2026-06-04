'use client'

import { useState } from 'react'
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
    about: 'Tim Data & Analytics PT Vantara Nusantara bertanggung jawab mengolah data bisnis dari lini produk Lumière, Roots&Co, dan Vanta Glow untuk menghasilkan insight yang mendukung keputusan strategis perusahaan.',
    responsibilities: [
      'Mengolah dan membersihkan data penjualan dari berbagai channel distribusi',
      'Membuat laporan mingguan dan bulanan untuk tim Marketing dan Finance',
      'Mengidentifikasi tren penjualan dan anomali data',
      'Berkolaborasi dengan tim lintas departemen untuk kebutuhan data',
    ],
    qualifications: [
      'Familiar dengan Excel atau Google Sheets (pivot table, VLOOKUP)',
      'Kemampuan analisis data dasar dan berpikir logis',
      'Nilai plus: pernah belajar SQL atau Python',
      'Teliti dan terbiasa bekerja dengan angka',
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
      'Memahami konsep dasar digital marketing',
      'Familiar dengan metrik campaign (CTR, conversion rate, CPA)',
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
    about: 'HR PT Vantara Nusantara mengelola seluruh aspek people management dari rekrutmen, onboarding, employee relations, hingga pengembangan talenta. Tim ini menjadi jembatan antara manajemen dan karyawan.',
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
    about: 'Tim Business Development PT Vantara Nusantara bertugas mengidentifikasi dan mengembangkan peluang bisnis baru, termasuk partnership strategis, ekspansi pasar, dan pengembangan channel distribusi.',
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
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  const salRange = background ? SALARY_RANGE[background] : SALARY_RANGE['jobseeker']
  const formatSalary = (n: number) => `${(n / 1000000).toFixed(1)} jt`

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E3DC] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#0F6E56]" />
            <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
            <span className="text-[#E5E3DC]">·</span>
            <span className="text-xs text-[#888780]">Lowongan Kerja</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mb-1">
            Pilih posisi yang ingin kamu lamar
          </h1>
          <p className="text-sm text-[#888780]">
            PT Vantara Nusantara · Jakarta Selatan · Hybrid 3x WFO/minggu
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Job Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {Object.entries(POSITIONS).map(([key, pos]) => {
            const detail = POSITION_DETAILS[key]
            const role = pos.getRole(background)
            const isSelected = selectedJob === key

            return (
              <button
                key={key}
                onClick={() => setSelectedJob(isSelected ? null : key)}
                style={{ cursor: 'pointer' }}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-[#0F6E56] bg-[#E1F5EE] shadow-sm'
                    : 'border-[#E5E3DC] bg-white hover:border-[#0F6E56] hover:shadow-sm'
                }`}
              >
                {/* Company + icon */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F1EFE8] flex items-center justify-center text-xl">
                    {pos.icon}
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#0F6E56] flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>

                {/* Company name */}
                <p className="text-[10px] font-medium text-[#888780] mb-0.5">PT Vantara Nusantara</p>

                {/* Position */}
                <p className="text-sm font-bold text-[#111111] mb-0.5">{role}</p>
                <p className="text-xs text-[#888780] mb-3">{pos.dept}</p>

                {/* Salary estimate */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs font-semibold text-[#0F6E56]">
                    Rp {formatSalary(salRange.min)} – {formatSalary(salRange.max)}/bln
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {detail?.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] bg-[#F1EFE8] text-[#444441] px-1.5 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* View detail hint */}
                <p className="text-[10px] text-[#888780] mt-3">
                  {isSelected ? 'Lihat detail di bawah' : 'Klik untuk lihat detail'}
                </p>
              </button>
            )
          })}
        </div>

        {/* Job Detail Drawer */}
        {selectedJob && (() => {
          const pos = POSITIONS[selectedJob]
          const detail = POSITION_DETAILS[selectedJob]
          const role = pos.getRole(background)
          if (!pos || !detail) return null

          return (
            <div className="bg-white rounded-2xl border border-[#0F6E56]/20 shadow-sm overflow-hidden mb-6 animate-fadeUp">
              {/* Detail header */}
              <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                    {pos.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/80 text-xs mb-0.5">PT Vantara Nusantara</p>
                    <h2 className="text-white font-bold text-lg">{role}</h2>
                    <p className="text-white/80 text-sm">{pos.dept}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 text-white/90 text-xs">
                  <span>📍 Jakarta Selatan</span>
                  <span>🏠 Hybrid 3x WFO</span>
                  <span>💰 Rp {formatSalary(salRange.min)}–{formatSalary(salRange.max)}/bln</span>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-5">
                {/* About */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">Tentang Tim</p>
                  <p className="text-sm leading-relaxed text-[#444441]">{detail.about}</p>
                </div>

                {/* Responsibilities */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">Yang Akan Kamu Kerjakan</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.responsibilities.map((r, i) => (
                      <div key={i} className="flex gap-2 text-sm text-[#444441]">
                        <span className="text-[#0F6E56] flex-shrink-0 mt-0.5">→</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Qualifications */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">Yang Kami Cari</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.qualifications.map((q, i) => (
                      <div key={i} className="flex gap-2 text-sm text-[#444441]">
                        <span className="text-[#0F6E56] flex-shrink-0 mt-0.5">✓</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => onApply(selectedJob)}
                  style={{ cursor: 'pointer' }}
                  className="btn-teal w-full text-sm py-3"
                >
                  Lamar Posisi Ini →
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
