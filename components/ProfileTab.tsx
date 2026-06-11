'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Education, Experience } from '@/lib/profile'
import { MONTHS, YEARS } from '@/lib/profile'
import { SKILLS_PRESET } from '@/lib/skills'
import { authFetch } from '@/lib/supabase'

interface Props {
  user: User
  profile: UserProfile
  onUpdate: (profile: UserProfile) => void
  simulationExperience?: Experience
}

export default function ProfileTab({ user, profile, onUpdate, simulationExperience }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<UserProfile>(profile)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('main')

  const up = (field: keyof UserProfile, val: unknown) =>
    setDraft(prev => ({ ...prev, [field]: val }))

  const allExperience = [
    ...(simulationExperience ? [simulationExperience] : []),
    ...(draft.experience || []).filter(e => !e.isSimulation)
  ]

  const handleSave = async () => {
    setSaving(true)
    try {
      await authFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({ profile: draft })
      })
      onUpdate(draft)
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const toggleSkill = (skill: string) => {
    const has = draft.skills.includes(skill)
    up('skills', has ? draft.skills.filter(s => s !== skill) : [...draft.skills, skill])
  }

  const addExp = () => {
    const exp: Experience = {
      id: Date.now().toString(),
      company: '', position: '',
      startMonth: 'Januari', startYear: new Date().getFullYear().toString(),
      endMonth: 'Desember', endYear: new Date().getFullYear().toString(),
      isCurrent: false, description: ''
    }
    up('experience', [...(draft.experience || []), exp])
  }

  const updateExp = (id: string, field: keyof Experience, val: string | boolean) => {
    up('experience', draft.experience.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  const removeExp = (id: string) => {
    up('experience', draft.experience.filter(e => e.id !== id))
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Edit header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E3DC] flex-shrink-0">
          <button onClick={() => { setEditing(false); setDraft(profile) }} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#111111]">← Batal</button>
          <span className="text-xs font-semibold text-[#111111]">Edit Profil</span>
          <button onClick={handleSave} disabled={saving} style={{ cursor: saving ? 'not-allowed' : 'pointer' }} className="text-xs font-semibold text-[#0F6E56] disabled:opacity-40">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#E5E3DC] flex-shrink-0 overflow-x-auto">
          {['Diri', 'Pendidikan', 'Pengalaman', 'Skill'].map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s.toLowerCase())}
              style={{ cursor: 'pointer' }}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                activeSection === s.toLowerCase()
                  ? 'border-[#0F6E56] text-[#0F6E56]'
                  : 'border-transparent text-[#888780]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {activeSection === 'diri' && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1">Nama *</label>
                <input value={draft.full_name} onChange={e => up('full_name', e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1">Jenis Kelamin</label>
                <div className="flex gap-1.5">
                  {['Laki-laki', 'Perempuan', 'Tidak ingin menyebutkan'].map(g => (
                    <button key={g} onClick={() => up('gender', g)} style={{ cursor: 'pointer' }}
                      className={`flex-1 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-all ${
                        draft.gender === g ? 'border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56]' : 'border-[#E5E3DC] text-[#888780]'
                      }`}
                    >{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1">Kota</label>
                <input value={draft.city} onChange={e => up('city', e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-1">LinkedIn</label>
                <input value={draft.linkedin_url || ''} onChange={e => up('linkedin_url', e.target.value)}
                  placeholder="linkedin.com/in/username"
                  className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56]" />
              </div>
            </>
          )}

          {activeSection === 'pendidikan' && (
            <>
              {draft.education.map((edu, idx) => (
                <div key={edu.id} className="border border-[#E5E3DC] rounded-xl p-3">
                  <div className="flex justify-between mb-2">
                    <p className="text-[10px] font-bold text-[#888780]">Pendidikan {idx + 1}</p>
                    {draft.education.length > 1 && (
                      <button onClick={() => up('education', draft.education.filter(e => e.id !== edu.id))}
                        style={{ cursor: 'pointer' }} className="text-[10px] text-red-400">Hapus</button>
                    )}
                  </div>
                  <input value={edu.institution} onChange={e => up('education', draft.education.map(ed => ed.id === edu.id ? { ...ed, institution: e.target.value } : ed))}
                    placeholder="Universitas *" className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56] mb-2" />
                  <input value={edu.major} onChange={e => up('education', draft.education.map(ed => ed.id === edu.id ? { ...ed, major: e.target.value } : ed))}
                    placeholder="Jurusan *" className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56] mb-2" />
                  <div className="flex gap-2">
                    <select value={edu.status} onChange={e => up('education', draft.education.map(ed => ed.id === edu.id ? { ...ed, status: e.target.value as 'lulus' | 'kuliah' } : ed))}
                      style={{ cursor: 'pointer' }} className="flex-1 px-2 py-2 border border-[#E5E3DC] rounded-lg text-xs bg-white outline-none">
                      <option value="lulus">Sudah lulus</option>
                      <option value="kuliah">Masih kuliah</option>
                    </select>
                    {edu.status === 'lulus' && (
                      <input value={edu.year || ''} onChange={e => up('education', draft.education.map(ed => ed.id === edu.id ? { ...ed, year: e.target.value } : ed))}
                        placeholder="Tahun" className="w-20 px-2 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none focus:border-[#0F6E56]" />
                    )}
                  </div>
                </div>
              ))}
              <button onClick={() => up('education', [...draft.education, { id: Date.now().toString(), institution: '', major: '', status: 'lulus' as const, year: '' }])}
                style={{ cursor: 'pointer' }} className="w-full py-2 border-2 border-dashed border-[#E5E3DC] rounded-xl text-xs text-[#888780] hover:border-[#0F6E56]">
                + Tambah pendidikan
              </button>
            </>
          )}

          {activeSection === 'pengalaman' && (
            <>
              {draft.experience.filter(e => !e.isSimulation).map((exp, idx) => (
                <div key={exp.id} className="border border-[#E5E3DC] rounded-xl p-3">
                  <div className="flex justify-between mb-2">
                    <p className="text-[10px] font-bold text-[#888780]">Pengalaman {idx + 1}</p>
                    <button onClick={() => removeExp(exp.id)} style={{ cursor: 'pointer' }} className="text-[10px] text-red-400">Hapus</button>
                  </div>
                  <input value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)}
                    placeholder="Perusahaan *" className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56] mb-2" />
                  <input value={exp.position} onChange={e => updateExp(exp.id, 'position', e.target.value)}
                    placeholder="Posisi *" className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-sm outline-none focus:border-[#0F6E56] mb-2" />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[9px] text-[#888780] mb-1">Mulai</p>
                      <div className="flex gap-1">
                        <select value={exp.startMonth} onChange={e => updateExp(exp.id, 'startMonth', e.target.value)} style={{ cursor: 'pointer' }} className="flex-1 px-1 py-1.5 border border-[#E5E3DC] rounded-lg text-[10px] bg-white outline-none">
                          {MONTHS.map(m => <option key={m}>{m}</option>)}
                        </select>
                        <select value={exp.startYear} onChange={e => updateExp(exp.id, 'startYear', e.target.value)} style={{ cursor: 'pointer' }} className="w-14 px-1 py-1.5 border border-[#E5E3DC] rounded-lg text-[10px] bg-white outline-none">
                          {YEARS.map(y => <option key={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                    {!exp.isCurrent && (
                      <div>
                        <p className="text-[9px] text-[#888780] mb-1">Selesai</p>
                        <div className="flex gap-1">
                          <select value={exp.endMonth} onChange={e => updateExp(exp.id, 'endMonth', e.target.value)} style={{ cursor: 'pointer' }} className="flex-1 px-1 py-1.5 border border-[#E5E3DC] rounded-lg text-[10px] bg-white outline-none">
                            {MONTHS.map(m => <option key={m}>{m}</option>)}
                          </select>
                          <select value={exp.endYear} onChange={e => updateExp(exp.id, 'endYear', e.target.value)} style={{ cursor: 'pointer' }} className="w-14 px-1 py-1.5 border border-[#E5E3DC] rounded-lg text-[10px] bg-white outline-none">
                            {YEARS.map(y => <option key={y}>{y}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#888780] mb-2" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={exp.isCurrent} onChange={e => updateExp(exp.id, 'isCurrent', e.target.checked)} />
                    Masih bekerja di sini
                  </label>
                  <textarea value={exp.description} onChange={e => updateExp(exp.id, 'description', e.target.value)}
                    placeholder="Deskripsi singkat (opsional)"
                    className="w-full px-3 py-2 border border-[#E5E3DC] rounded-lg text-xs outline-none focus:border-[#0F6E56] resize-none min-h-[60px]" />
                </div>
              ))}
              <button onClick={addExp} style={{ cursor: 'pointer' }} className="w-full py-2 border-2 border-dashed border-[#E5E3DC] rounded-xl text-xs text-[#888780] hover:border-[#0F6E56]">
                + Tambah pengalaman
              </button>
            </>
          )}

          {activeSection === 'skill' && (
            <>
              {draft.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-[#E1F5EE] rounded-xl mb-2">
                  {draft.skills.map(s => (
                    <button key={s} onClick={() => toggleSkill(s)} style={{ cursor: 'pointer' }}
                      className="text-[10px] bg-[#0F6E56] text-white px-2 py-1 rounded-full">
                      {s} ×
                    </button>
                  ))}
                </div>
              )}
              {Object.entries(SKILLS_PRESET).map(([cat, skills]) => (
                <div key={cat}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#888780] mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {skills.map(skill => (
                      <button key={skill} onClick={() => toggleSkill(skill)} style={{ cursor: 'pointer' }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                          draft.skills.includes(skill)
                            ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                            : 'bg-white text-[#444441] border-[#E5E3DC] hover:border-[#0F6E56]'
                        }`}
                      >{skill}</button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  // View mode
  const firstEdu = profile.education[0]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Profile header */}
      <div className="p-4 border-b border-[#E5E3DC] flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full av-teal flex items-center justify-center text-lg font-semibold">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-[#111111] truncate">{profile.full_name || 'Nama belum diisi'}</p>
            <p className="text-xs text-[#888780] truncate">{profile.city || 'Kota belum diisi'}</p>
            {firstEdu && (
              <p className="text-[10px] text-[#888780] truncate">{firstEdu.major} · {firstEdu.institution}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => { setEditing(true); setDraft(profile); setActiveSection('diri') }}
          style={{ cursor: 'pointer' }}
          className="w-full text-xs font-medium text-[#0F6E56] border border-[#0F6E56]/30 bg-[#E1F5EE] hover:bg-[#0F6E56] hover:text-white py-1.5 rounded-lg transition-all"
        >
          Edit profil
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Skills */}
        {profile.skills.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Keahlian</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map(s => (
                <span key={s} className="text-[10px] bg-[#F1EFE8] text-[#444441] px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {allExperience.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Pengalaman Kerja</p>
            <div className="flex flex-col gap-2">
              {allExperience.map(exp => (
                <div key={exp.id} className={`p-3 rounded-xl border ${exp.isSimulation ? 'border-[#0F6E56]/20 bg-[#E1F5EE]' : 'border-[#E5E3DC] bg-white'}`}>
                  {exp.isSimulation && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#0F6E56] bg-[#0F6E56]/10 px-1.5 py-0.5 rounded-full mb-1 inline-block">Simulasi Kantoran</span>
                  )}
                  <p className="text-xs font-semibold text-[#111111]">{exp.position}</p>
                  <p className="text-[10px] text-[#888780]">{exp.company}</p>
                  <p className="text-[10px] text-[#AAAAAA]">
                    {exp.startMonth} {exp.startYear}, {exp.isCurrent ? 'Sekarang' : `${exp.endMonth} ${exp.endYear}`}
                  </p>
                  {exp.description && <p className="text-[10px] text-[#888780] mt-1 leading-relaxed">{exp.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {profile.education.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Pendidikan</p>
            <div className="flex flex-col gap-2">
              {profile.education.map(edu => (
                <div key={edu.id} className="p-3 rounded-xl border border-[#E5E3DC] bg-white">
                  <p className="text-xs font-semibold text-[#111111]">{edu.major}</p>
                  <p className="text-[10px] text-[#888780]">{edu.institution}</p>
                  <p className="text-[10px] text-[#AAAAAA]">
                    {edu.status === 'kuliah' ? 'Masih kuliah' : `Lulus ${edu.year || ''}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.linkedin_url && (
          <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
            style={{ cursor: 'pointer' }}
            className="text-xs text-[#0F6E56] font-medium hover:underline">
            LinkedIn Profile →
          </a>
        )}
      </div>
    </div>
  )
}
