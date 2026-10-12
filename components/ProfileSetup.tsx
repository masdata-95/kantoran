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

const newEducation = (): Education => ({
  id: Date.now().toString(), institution: '', major: '', status: 'lulus', year: '',
})

const STEPS = [
  { title: 'Data diri', hint: 'Sinta dari HR membaca profil ini sebelum interview, jadi isi seperti kamu mengisi CV.' },
  { title: 'Pendidikan', hint: 'Mulai dari yang paling akhir. Cukup satu kalau memang baru satu.' },
  { title: 'Pengalaman', hint: 'Magang, part-time, freelance, organisasi kampus, semuanya dihitung. Belum punya juga tidak apa-apa.' },
  { title: 'Keahlian', hint: 'Pilih yang benar-benar pernah kamu pakai. Interviewer bisa menanyakannya.' },
  { title: 'Posisimu sekarang', hint: 'Dipakai untuk menyarankan jenjang awal. Saat melamar, kamu tetap bebas memilih jenjang lain.' },
]

const CATEGORIES = [
  { key: 'student', label: 'Mahasiswa tingkat akhir', desc: 'Masih kuliah, mau cari pengalaman kerja lebih awal.', role: 'Intern' },
  { key: 'fresh_grad', label: 'Baru lulus', desc: 'Sudah lulus, belum pernah kerja kantoran penuh waktu.', role: 'Intern' },
  { key: 'jobseeker', label: 'Sedang cari kerja', desc: 'Sudah ada sedikit pengalaman, sedang melamar ke sana-sini.', role: 'Junior' },
  { key: 'career_switch', label: 'Mau pindah bidang', desc: 'Sudah kerja di bidang lain, ingin mencoba bidang baru.', role: 'Mid-Level' },
]

const inputCls = 'w-full px-3 py-2.5 border border-[#D8D6CE] rounded-lg text-sm bg-white outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10'
const labelCls = 'block text-[13px] font-medium text-[#1A1A18] mb-1.5'
const selectSm = 'px-2 py-2 border border-[#D8D6CE] rounded-lg text-[13px] outline-none bg-white'

export default function ProfileSetup({ user, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profile, setProfile] = useState<UserProfile & { category?: string }>({
    ...EMPTY_PROFILE,
    full_name: user.user_metadata?.full_name || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    // Satu baris pendidikan kosong sejak awal: user langsung mengetik, tidak perlu
    // mencari tombol "tambah" dulu (dulu ada dua tombol tambah yang sama persis)
    education: [newEducation()],
    category: '',
  })

  const up = (field: keyof UserProfile, val: unknown) =>
    setProfile(prev => ({ ...prev, [field]: val }))

  const addEducation = () => up('education', [...profile.education, newEducation()])
  const updateEducation = (id: string, field: keyof Education, val: string) =>
    up('education', profile.education.map(e => e.id === id ? { ...e, [field]: val } : e))
  const removeEducation = (id: string) => up('education', profile.education.filter(e => e.id !== id))

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
  const updateExp = (id: string, field: keyof Experience, val: string | boolean) =>
    up('experience', profile.experience.map(e => e.id === id ? { ...e, [field]: val } : e))
  const removeExp = (id: string) => up('experience', profile.experience.filter(e => e.id !== id))

  const toggleSkill = (skill: string) => {
    const has = profile.skills.includes(skill)
    up('skills', has ? profile.skills.filter(s => s !== skill) : [...profile.skills, skill])
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    // Pengalaman yang dibiarkan kosong tidak ikut tersimpan (tidak muncul di CV/HR)
    const cleaned = {
      ...profile,
      experience: profile.experience.filter(e => e.company.trim() || e.position.trim()),
    }
    try {
      const res = await authFetch('/api/profile', { method: 'POST', body: JSON.stringify({ profile: cleaned }) })
      // Dulu gagal simpan tetap lanjut diam-diam → login berikutnya user dilempar ke
      // form ini lagi dan mengira datanya hilang. Sekarang kasih tahu dan biarkan coba lagi.
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onComplete(cleaned)
    } catch (e) {
      console.error(e)
      setSaveError('Profil belum tersimpan, koneksinya putus. Coba tekan simpan sekali lagi.')
      setSaving(false)
    }
  }

  const isStep1Valid = !!(profile.full_name.trim() && profile.city.trim())
  const isStep2Valid = profile.education.length > 0 &&
    profile.education.every(e => e.institution.trim() && e.major.trim())
  const realExp = profile.experience.filter(e => !e.isSimulation)

  const TOTAL = STEPS.length
  const current = STEPS[step - 1]
  const blocked = (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 sm:px-8 h-14 flex items-center justify-between border-b border-[#E5E3DC] bg-white">
        <span className="text-[15px] font-semibold text-[#0F6E56]">Kantoran</span>
        <span className="text-[13px] text-[#6B6A64] tabular">Profil {step}/{TOTAL}</span>
      </header>

      <main className="flex-1 flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">
          <div className="flex gap-1 mb-6" aria-hidden>
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i + 1 <= step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'}`} />
            ))}
          </div>

          <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1">{current.title}</h1>
          <p className="text-sm text-[#4A4A45] leading-relaxed mb-6">{current.hint}</p>

          <div className="bg-white rounded-xl border border-[#E5E3DC]">
            <div className="p-5 sm:p-6">

              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls} htmlFor="ps-name">Nama lengkap</label>
                    <input id="ps-name" value={profile.full_name} onChange={e => up('full_name', e.target.value)}
                      placeholder="Nama yang biasa kamu pakai di CV" autoComplete="name" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ps-city">Kota domisili</label>
                    <input id="ps-city" value={profile.city} onChange={e => up('city', e.target.value)}
                      placeholder="Misalnya Bekasi" autoComplete="address-level2" className={inputCls} />
                  </div>
                  <div>
                    <p className={labelCls}>Jenis kelamin <span className="font-normal text-[#6B6A64]">(opsional)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {['Laki-laki', 'Perempuan', 'Tidak ingin menyebutkan'].map(g => (
                        <button key={g} type="button" onClick={() => up('gender', profile.gender === g ? '' : g)}
                          style={{ cursor: 'pointer' }}
                          aria-pressed={profile.gender === g}
                          className={`py-2 px-3 rounded-lg border text-[13px] transition-colors ${
                            profile.gender === g ? 'border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56] font-medium' : 'border-[#D8D6CE] text-[#4A4A45] hover:border-[#0F6E56]'
                          }`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ps-li">LinkedIn <span className="font-normal text-[#6B6A64]">(opsional)</span></label>
                    <input id="ps-li" value={profile.linkedin_url || ''} onChange={e => up('linkedin_url', e.target.value)}
                      placeholder="linkedin.com/in/namamu" inputMode="url" className={inputCls} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  {profile.education.map((edu, idx) => (
                    <div key={edu.id} className={idx > 0 ? 'pt-4 border-t border-[#E5E3DC]' : ''}>
                      {profile.education.length > 1 && (
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[13px] font-medium text-[#6B6A64]">Pendidikan {idx + 1}</p>
                          <button type="button" onClick={() => removeEducation(edu.id)} style={{ cursor: 'pointer' }} className="text-[13px] text-[#B42318] hover:underline">Hapus</button>
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className={labelCls} htmlFor={`edu-i-${edu.id}`}>Kampus atau sekolah</label>
                          <input id={`edu-i-${edu.id}`} value={edu.institution} onChange={e => updateEducation(edu.id, 'institution', e.target.value)}
                            placeholder="Misalnya Universitas Gunadarma" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls} htmlFor={`edu-m-${edu.id}`}>Jurusan</label>
                          <input id={`edu-m-${edu.id}`} value={edu.major} onChange={e => updateEducation(edu.id, 'major', e.target.value)}
                            placeholder="Misalnya S1 Manajemen" className={inputCls} />
                        </div>
                        <div className="flex gap-2">
                          <select value={edu.status} onChange={e => updateEducation(edu.id, 'status', e.target.value)}
                            aria-label="Status pendidikan" style={{ cursor: 'pointer' }} className={`${inputCls} flex-1`}>
                            <option value="lulus">Sudah lulus</option>
                            <option value="kuliah">Masih kuliah</option>
                          </select>
                          {edu.status === 'lulus' && (
                            <input value={edu.year || ''} onChange={e => updateEducation(edu.id, 'year', e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="Tahun lulus" inputMode="numeric" aria-label="Tahun lulus" className={`${inputCls} w-32`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addEducation} style={{ cursor: 'pointer' }}
                    className="self-start text-[13px] font-medium text-[#0F6E56] hover:underline">
                    + Tambah pendidikan lain
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4">
                  {realExp.length === 0 && (
                    <p className="text-sm text-[#4A4A45]">
                      Belum ada yang ditambahkan. Kalau memang belum punya pengalaman, langsung tekan <strong className="font-medium">Lewati</strong>.
                    </p>
                  )}
                  {realExp.map((exp, idx) => (
                    <div key={exp.id} className={idx > 0 ? 'pt-4 border-t border-[#E5E3DC]' : ''}>
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-[13px] font-medium text-[#6B6A64]">Pengalaman {idx + 1}</p>
                        <button type="button" onClick={() => removeExp(exp.id)} style={{ cursor: 'pointer' }} className="text-[13px] text-[#B42318] hover:underline">Hapus</button>
                      </div>
                      <div className="flex flex-col gap-3">
                        <input value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)}
                          placeholder="Perusahaan atau organisasi" aria-label="Perusahaan atau organisasi" className={inputCls} />
                        <input value={exp.position} onChange={e => updateExp(exp.id, 'position', e.target.value)}
                          placeholder="Posisi, misalnya Staf Magang Keuangan" aria-label="Posisi" className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[13px] text-[#6B6A64] mb-1">Mulai</p>
                            <div className="flex gap-1">
                              <select value={exp.startMonth} onChange={e => updateExp(exp.id, 'startMonth', e.target.value)} aria-label="Bulan mulai" style={{ cursor: 'pointer' }} className={`${selectSm} flex-1 min-w-0`}>
                                {MONTHS.map(m => <option key={m}>{m}</option>)}
                              </select>
                              <select value={exp.startYear} onChange={e => updateExp(exp.id, 'startYear', e.target.value)} aria-label="Tahun mulai" style={{ cursor: 'pointer' }} className={`${selectSm} w-[72px]`}>
                                {YEARS.map(y => <option key={y}>{y}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <p className="text-[13px] text-[#6B6A64] mb-1">Selesai</p>
                            {exp.isCurrent ? (
                              <div className="px-2 py-2 text-[13px] text-[#0F6E56] font-medium">Sampai sekarang</div>
                            ) : (
                              <div className="flex gap-1">
                                <select value={exp.endMonth} onChange={e => updateExp(exp.id, 'endMonth', e.target.value)} aria-label="Bulan selesai" style={{ cursor: 'pointer' }} className={`${selectSm} flex-1 min-w-0`}>
                                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                                </select>
                                <select value={exp.endYear} onChange={e => updateExp(exp.id, 'endYear', e.target.value)} aria-label="Tahun selesai" style={{ cursor: 'pointer' }} className={`${selectSm} w-[72px]`}>
                                  {YEARS.map(y => <option key={y}>{y}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[13px] text-[#4A4A45]" style={{ cursor: 'pointer' }}>
                          <input type="checkbox" checked={exp.isCurrent} onChange={e => updateExp(exp.id, 'isCurrent', e.target.checked)} className="accent-[#0F6E56]" />
                          Masih di sini sampai sekarang
                        </label>
                        <textarea value={exp.description} onChange={e => updateExp(exp.id, 'description', e.target.value)}
                          placeholder="Apa yang kamu kerjakan di sana? Satu dua kalimat cukup. (opsional)"
                          aria-label="Deskripsi pengalaman" className={`${inputCls} resize-none min-h-[72px]`} />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addExperience} style={{ cursor: 'pointer' }}
                    className="self-start text-[13px] font-medium text-[#0F6E56] hover:underline">
                    + Tambah pengalaman
                  </button>
                </div>
              )}

              {step === 4 && (
                <div>
                  {profile.skills.length > 0 && (
                    <div className="mb-4 pb-4 border-b border-[#E5E3DC]">
                      <p className="text-[13px] text-[#6B6A64] mb-2 tabular">{profile.skills.length} dipilih</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.map(s => (
                          <button key={s} type="button" onClick={() => toggleSkill(s)} style={{ cursor: 'pointer' }}
                            aria-label={`Hapus ${s}`}
                            className="text-[13px] bg-[#0F6E56] text-white pl-2.5 pr-2 py-1 rounded-md flex items-center gap-1.5 hover:bg-[#085041]">
                            {s} <span aria-hidden className="opacity-70">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-4 max-h-[340px] overflow-y-auto pr-1">
                    {Object.entries(SKILLS_PRESET).map(([category, skills]) => (
                      <div key={category}>
                        <p className="text-[13px] font-medium text-[#1A1A18] mb-2">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map(skill => {
                            const on = profile.skills.includes(skill)
                            return (
                              <button key={skill} type="button" onClick={() => toggleSkill(skill)} style={{ cursor: 'pointer' }}
                                aria-pressed={on}
                                className={`text-[13px] px-2.5 py-1 rounded-md border transition-colors ${
                                  on ? 'bg-[#E1F5EE] text-[#0F6E56] border-[#0F6E56]' : 'bg-white text-[#4A4A45] border-[#D8D6CE] hover:border-[#0F6E56]'
                                }`}>
                                {skill}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Posisimu sekarang">
                  {CATEGORIES.map(cat => {
                    const on = profile.category === cat.key
                    return (
                      <button key={cat.key} type="button" role="radio" aria-checked={on}
                        onClick={() => setProfile(prev => ({ ...prev, category: cat.key }))}
                        style={{ cursor: 'pointer' }}
                        className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
                          on ? 'border-[#0F6E56] bg-[#E1F5EE]/60' : 'border-[#D8D6CE] hover:border-[#0F6E56]'
                        }`}>
                        <span className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${on ? 'border-[#0F6E56]' : 'border-[#B8B6AE]'}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-[#0F6E56]" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-[#1A1A18]">{cat.label}</span>
                          <span className="block text-[13px] text-[#4A4A45] mt-0.5">{cat.desc}</span>
                          <span className="block text-[13px] text-[#6B6A64] mt-1">Saran jenjang: {cat.role}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[#E5E3DC] px-5 sm:px-6 py-4 flex justify-between items-center gap-3">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(s => s - 1)} style={{ cursor: 'pointer' }} className="text-sm text-[#4A4A45] hover:text-[#1A1A18]">
                  Kembali
                </button>
              ) : <span />}

              {step < TOTAL ? (
                <button type="button" onClick={() => setStep(s => s + 1)} disabled={blocked}
                  style={{ cursor: blocked ? 'not-allowed' : 'pointer' }} className="btn-teal text-sm">
                  {step === 3 && realExp.length === 0 ? 'Lewati' : 'Lanjut'}
                </button>
              ) : (
                <button type="button" onClick={handleSave} disabled={saving || !profile.category}
                  style={{ cursor: (saving || !profile.category) ? 'not-allowed' : 'pointer' }} className="btn-teal text-sm">
                  {saving ? 'Menyimpan...' : 'Simpan dan lihat lowongan'}
                </button>
              )}
            </div>
          </div>

          {saveError && <p className="mt-3 text-sm text-[#B42318]" role="alert">{saveError}</p>}
          {step === 1 && !isStep1Valid && (
            <p className="mt-3 text-[13px] text-[#6B6A64]">Nama dan kota wajib diisi.</p>
          )}
          {step === 2 && !isStep2Valid && (
            <p className="mt-3 text-[13px] text-[#6B6A64]">Isi nama kampus dan jurusan untuk lanjut.</p>
          )}
          <p className="mt-6 text-[13px] text-[#6B6A64]">Semua isian bisa diubah nanti dari menu Profil di dalam simulasi.</p>
        </div>
      </main>
    </div>
  )
}
