'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Education, Experience } from '@/lib/profile'
import { EMPTY_PROFILE, MONTHS, YEARS } from '@/lib/profile'
import { SKILLS_PRESET } from '@/lib/skills'
import { authFetch } from '@/lib/supabase'

interface Props {
  user: User
  onComplete: (profile: UserProfile) => void
}

export default function ProfileSetup({ user, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile & { category?: string }>({
    ...EMPTY_PROFILE,
    full_name: user.user_metadata?.full_name || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    category: '',
  })

  const up = (field: keyof UserProfile, val: unknown) =>
    setProfile(prev => ({ ...prev, [field]: val }))

  const addEducation = () => {
    const edu: Education = {
      id: Date.now().toString(),
      institution: '', major: '', status: 'lulus', year: ''
    }
    up('education', [...profile.education, edu])
  }

  const updateEducation = (id: string, field: keyof Education, val: string) => {
    up('education', profile.education.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  const removeEducation = (id: string) => {
    up('education', profile.education.filter(e => e.id !== id))
  }

  const addExperience = () => {
    const exp: Experience = {
      id: Date.now().toString(),
      company: '', position: '',
      startMonth: 'Januari', startYear: new Date().getFullYear().toString(),
      endMonth: 'Desember', endYear: new Date().getFullYear().toString(),
      isCurrent: false, description: ''
    }
    up('experience', [...profile.experience, exp])
  }

  const updateExp = (id: string, field: keyof Experience, val: string | boolean) => {
    up('experience', profile.experience.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  const removeExp = (id: string) => {
    up('experience', profile.experience.filter(e => e.id !== id))
  }

  const toggleSkill = (skill: string) => {
    const has = profile.skills.includes(skill)
    up('skills', has ? profile.skills.filter(s => s !== skill) : [...profile.skills, skill])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await authFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({ profile })
      })
      onComplete(profile)
    } catch (e) {
      console.error(e)
      onComplete(profile) // proceed anyway
    } finally {
      setSaving(false)
    }
  }

  const isStep1Valid = profile.full_name.trim() && profile.gender && profile.city.trim()
  const isStep2Valid = profile.education.length > 0 &&
    profile.education.every(e => e.institution.trim() && e.major.trim())

  const TOTAL = 5

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-4">
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#0F6E56]" />

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]" />
          <span className="font-serif text-2xl font-bold text-[#111111]">Kantoran</span>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
              i + 1 < step ? 'bg-[#1D9E75]' : i + 1 === step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'
            }`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E3DC] shadow-sm overflow-hidden">
          <div className="p-6">

            {/* Step 1, Data Diri */}
            {step === 1 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-1">Langkah 1 dari {TOTAL}</p>
                <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Data diri</h2>
                <p className="text-sm text-[#888780] mb-5">Ini akan jadi profil kamu di Kantoran dan digunakan oleh HR saat interview.</p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Nama lengkap *</label>
                    <input
                      value={profile.full_name}
                      onChange={e => up('full_name', e.target.value)}
                      placeholder="Sesuai KTP atau nama yang biasa dipakai"
                      className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Jenis kelamin *</label>
                    <div className="flex gap-2">
                      {['Laki-laki', 'Perempuan', 'Tidak ingin menyebutkan'].map(g => (
                        <button
                          key={g}
                          onClick={() => up('gender', g)}
                          style={{ cursor: 'pointer' }}
                          className={`flex-1 py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                            profile.gender === g
                              ? 'border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56]'
                              : 'border-[#E5E3DC] text-[#888780] hover:border-[#0F6E56]'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Kota domisili *</label>
                    <input
                      value={profile.city}
                      onChange={e => up('city', e.target.value)}
                      placeholder="Contoh: Jakarta, Bandung, Surabaya"
                      className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">LinkedIn (opsional)</label>
                    <input
                      value={profile.linkedin_url || ''}
                      onChange={e => up('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2, Pendidikan */}
            {step === 2 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-1">Langkah 2 dari {TOTAL}</p>
                <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Pendidikan</h2>
                <p className="text-sm text-[#888780] mb-5">Minimal satu entri pendidikan. Mulai dari yang paling terakhir.</p>

                {profile.education.map((edu, idx) => (
                  <div key={edu.id} className="border border-[#E5E3DC] rounded-xl p-4 mb-3 relative">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-semibold text-[#888780]">Pendidikan {idx + 1}</p>
                      {profile.education.length > 1 && (
                        <button onClick={() => removeEducation(edu.id)} style={{ cursor: 'pointer' }} className="text-xs text-red-400 hover:text-red-600">Hapus</button>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        value={edu.institution}
                        onChange={e => updateEducation(edu.id, 'institution', e.target.value)}
                        placeholder="Nama universitas / institusi *"
                        className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                      />
                      <input
                        value={edu.major}
                        onChange={e => updateEducation(edu.id, 'major', e.target.value)}
                        placeholder="Jurusan / program studi *"
                        className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                      />
                      <div className="flex gap-2">
                        <select
                          value={edu.status}
                          onChange={e => updateEducation(edu.id, 'status', e.target.value)}
                          style={{ cursor: 'pointer' }}
                          className="flex-1 px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] bg-white"
                        >
                          <option value="lulus">Sudah lulus</option>
                          <option value="kuliah">Masih kuliah</option>
                        </select>
                        {edu.status === 'lulus' && (
                          <input
                            value={edu.year || ''}
                            onChange={e => updateEducation(edu.id, 'year', e.target.value)}
                            placeholder="Tahun lulus"
                            className="w-28 px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addEducation}
                  style={{ cursor: 'pointer' }}
                  className="w-full py-2.5 border-2 border-dashed border-[#E5E3DC] rounded-xl text-sm text-[#888780] hover:border-[#0F6E56] hover:text-[#0F6E56] transition-all"
                >
                  + Tambah pendidikan
                </button>

                {profile.education.length === 0 && (
                  <button onClick={addEducation} style={{ cursor: 'pointer' }} className="w-full mt-2 py-2.5 btn-teal text-sm">
                    Tambah pendidikan pertama
                  </button>
                )}
              </div>
            )}

            {/* Step 3, Pengalaman */}
            {step === 3 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-1">Langkah 3 dari {TOTAL}</p>
                <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Pengalaman kerja</h2>
                <p className="text-sm text-[#888780] mb-5">Isi kalau ada. Bisa magang, part-time, freelance, atau organisasi. Kalau belum ada, skip saja.</p>

                {profile.experience.filter(e => !e.isSimulation).map((exp, idx) => (
                  <div key={exp.id} className="border border-[#E5E3DC] rounded-xl p-4 mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-semibold text-[#888780]">Pengalaman {idx + 1}</p>
                      <button onClick={() => removeExp(exp.id)} style={{ cursor: 'pointer' }} className="text-xs text-red-400 hover:text-red-600">Hapus</button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        value={exp.company}
                        onChange={e => updateExp(exp.id, 'company', e.target.value)}
                        placeholder="Nama perusahaan / organisasi *"
                        className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                      />
                      <input
                        value={exp.position}
                        onChange={e => updateExp(exp.id, 'position', e.target.value)}
                        placeholder="Posisi / jabatan *"
                        className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56]"
                      />

                      {/* Period */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-[#888780] mb-1">Mulai</p>
                          <div className="flex gap-1">
                            <select value={exp.startMonth} onChange={e => updateExp(exp.id, 'startMonth', e.target.value)} style={{ cursor: 'pointer' }} className="flex-1 px-2 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none bg-white">
                              {MONTHS.map(m => <option key={m}>{m}</option>)}
                            </select>
                            <select value={exp.startYear} onChange={e => updateExp(exp.id, 'startYear', e.target.value)} style={{ cursor: 'pointer' }} className="w-16 px-1 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none bg-white">
                              {YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#888780] mb-1">Selesai</p>
                          {exp.isCurrent ? (
                            <div className="px-2 py-2 text-xs text-[#0F6E56] font-medium">Saat ini</div>
                          ) : (
                            <div className="flex gap-1">
                              <select value={exp.endMonth} onChange={e => updateExp(exp.id, 'endMonth', e.target.value)} style={{ cursor: 'pointer' }} className="flex-1 px-2 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none bg-white">
                                {MONTHS.map(m => <option key={m}>{m}</option>)}
                              </select>
                              <select value={exp.endYear} onChange={e => updateExp(exp.id, 'endYear', e.target.value)} style={{ cursor: 'pointer' }} className="w-16 px-1 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none bg-white">
                                {YEARS.map(y => <option key={y}>{y}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-[#888780]" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={exp.isCurrent} onChange={e => updateExp(exp.id, 'isCurrent', e.target.checked)} className="rounded" />
                        Masih bekerja di sini
                      </label>

                      <textarea
                        value={exp.description}
                        onChange={e => updateExp(exp.id, 'description', e.target.value)}
                        placeholder="Deskripsi singkat tanggung jawab dan pencapaian (opsional)"
                        className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] resize-none min-h-[70px]"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addExperience}
                  style={{ cursor: 'pointer' }}
                  className="w-full py-2.5 border-2 border-dashed border-[#E5E3DC] rounded-xl text-sm text-[#888780] hover:border-[#0F6E56] hover:text-[#0F6E56] transition-all"
                >
                  + Tambah pengalaman kerja
                </button>

                <p className="text-xs text-[#888780] text-center mt-3">
                  Belum punya pengalaman? Tidak apa-apa, langsung skip ke langkah berikutnya.
                </p>
              </div>
            )}

            {/* Step 4, Skills */}
            {step === 4 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-1">Langkah 4 dari {TOTAL}</p>
                <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Keahlian</h2>
                <p className="text-sm text-[#888780] mb-4">Pilih skill yang kamu kuasai. Ini akan terlihat di profil dan CV kamu.</p>

                {profile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 p-3 bg-[#E1F5EE] rounded-xl">
                    {profile.skills.map(s => (
                      <button key={s} onClick={() => toggleSkill(s)} style={{ cursor: 'pointer' }}
                        className="text-xs bg-[#0F6E56] text-white px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-[#085041]"
                      >
                        {s} <span className="opacity-70">×</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
                  {Object.entries(SKILLS_PRESET).map(([category, skills]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">{category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map(skill => (
                          <button
                            key={skill}
                            onClick={() => toggleSkill(skill)}
                            style={{ cursor: 'pointer' }}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              profile.skills.includes(skill)
                                ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                                : 'bg-white text-[#444441] border-[#E5E3DC] hover:border-[#0F6E56]'
                            }`}
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5, Kategori */}
            {step === 5 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-1">Langkah 5 dari {TOTAL}</p>
                <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Kamu saat ini...</h2>
                <p className="text-sm text-[#888780] mb-5">Ini menentukan estimasi gaji dan level posisi yang ditawarkan kepadamu.</p>

                <div className="flex flex-col gap-3">
                  {[
                    { key: 'fresh_grad', label: 'Fresh Graduate', icon: '🎓', desc: 'Baru lulus, belum punya pengalaman kerja kantoran', role: 'Intern' },
                    { key: 'jobseeker', label: 'Job Seeker', icon: '🔍', desc: 'Aktif mencari kerja, sudah punya sedikit pengalaman', role: 'Junior' },
                    { key: 'career_switch', label: 'Career Switcher', icon: '🔄', desc: 'Sudah kerja di bidang lain, ingin pindah karir', role: 'Mid-Level' },
                    { key: 'student', label: 'Mahasiswa Tingkat Akhir', icon: '📚', desc: 'Masih kuliah, butuh pengalaman kerja lebih awal', role: 'Intern Magang' },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setProfile(prev => ({ ...prev, category: cat.key }))}
                      style={{ cursor: 'pointer' }}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                        (profile as { category?: string }).category === cat.key
                          ? 'border-[#0F6E56] bg-[#E1F5EE]'
                          : 'border-[#E5E3DC] hover:border-[#0F6E56]'
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-[#111111]">{cat.label}</p>
                        <p className="text-xs text-[#888780] mt-0.5">{cat.desc}</p>
                        <p className="text-xs font-medium text-[#0F6E56] mt-1">Kamu akan melamar sebagai {cat.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer navigation */}
          <div className="border-t border-[#E5E3DC] px-6 py-4 flex justify-between items-center bg-[#FAFAF7]">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} style={{ cursor: 'pointer' }} className="text-sm text-[#888780] hover:text-[#111111]">
                ← Kembali
              </button>
            ) : <div />}

            {step < TOTAL ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                style={{ cursor: ((step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)) ? 'not-allowed' : 'pointer' }}
                className="btn-teal text-sm disabled:opacity-40"
              >
                {step === 3 && profile.experience.filter(e => !e.isSimulation).length === 0 ? 'Lewati →' : 'Lanjut →'}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !(profile as { category?: string }).category}
                style={{ cursor: (saving || !(profile as { category?: string }).category) ? 'not-allowed' : 'pointer' }}
                className="btn-teal text-sm disabled:opacity-40"
              >
                {saving ? 'Menyimpan...' : 'Simpan & Lihat Lowongan →'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#888780] mt-4">
          Profil bisa diedit kapanpun di tab Profil setelah masuk
        </p>
      </div>
    </div>
  )
}
