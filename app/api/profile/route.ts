import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'
import { one, run, parseJson, nowIso } from '@/lib/db'

interface ProfileRow {
  user_id: string
  education: string
  experience: string
  skills: string
  [k: string]: unknown
}

// Kolom JSON disimpan sebagai teks; klien tetap menerima array seperti dulu.
const toProfile = (r: ProfileRow) => ({
  ...r,
  education: parseJson(r.education, []),
  experience: parseJson(r.experience, []),
  skills: parseJson(r.skills, []),
})

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const row = await one<ProfileRow>('SELECT * FROM user_profiles WHERE user_id = ?', user.id)
  return NextResponse.json({ profile: row ? toProfile(row) : null })
}

const TEXT_FIELDS = ['full_name', 'gender', 'city', 'category', 'avatar_url', 'linkedin_url'] as const
const JSON_FIELDS = ['education', 'experience', 'skills'] as const

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const profile = body?.profile
  if (!profile || typeof profile !== 'object') {
    return NextResponse.json({ error: 'Missing profile' }, { status: 400 })
  }
  if (JSON.stringify(profile).length > 200_000) {
    return NextResponse.json({ error: 'Profile too large' }, { status: 413 })
  }

  // user_id selalu dari sesi — abaikan userId dari client. Hanya kolom yang dikenal
  // yang ditulis; field yang tidak dikirim tidak menimpa nilai lama (sama seperti upsert Postgres).
  const text = TEXT_FIELDS.map(f => (typeof profile[f] === 'string' ? profile[f] : null))
  const json = JSON_FIELDS.map(f => (Array.isArray(profile[f]) ? JSON.stringify(profile[f]) : null))

  await run(
    `INSERT INTO user_profiles
       (user_id, full_name, gender, city, category, avatar_url, linkedin_url,
        education, experience, skills, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, '[]'), COALESCE(?, '[]'), COALESCE(?, '[]'), ?)
     ON CONFLICT (user_id) DO UPDATE SET
       full_name    = COALESCE(excluded.full_name,    user_profiles.full_name),
       gender       = COALESCE(excluded.gender,       user_profiles.gender),
       city         = COALESCE(excluded.city,         user_profiles.city),
       category     = COALESCE(excluded.category,     user_profiles.category),
       avatar_url   = COALESCE(excluded.avatar_url,   user_profiles.avatar_url),
       linkedin_url = COALESCE(excluded.linkedin_url, user_profiles.linkedin_url),
       education    = COALESCE(?, user_profiles.education),
       experience   = COALESCE(?, user_profiles.experience),
       skills       = COALESCE(?, user_profiles.skills),
       updated_at   = excluded.updated_at`,
    user.id, ...text, ...json, nowIso(), ...json
  )

  const row = await one<ProfileRow>('SELECT * FROM user_profiles WHERE user_id = ?', user.id)
  return NextResponse.json({ profile: row ? toProfile(row) : null })
}
