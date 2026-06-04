export interface Education {
  id: string
  institution: string
  major: string
  status: 'lulus' | 'kuliah'
  year?: string
}

export interface Experience {
  id: string
  company: string
  position: string
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  isCurrent: boolean
  description: string
  isSimulation?: boolean
}

export interface UserProfile {
  user_id?: string
  full_name: string
  gender: string
  city: string
  education: Education[]
  experience: Experience[]
  skills: string[]
  avatar_url?: string
  linkedin_url?: string
}

export const EMPTY_PROFILE: UserProfile = {
  full_name: '',
  gender: '',
  city: '',
  education: [],
  experience: [],
  skills: [],
}

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i))
