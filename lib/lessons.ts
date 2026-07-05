// Tipe bersama Vantara Academy — dipakai API routes dan komponen client

export type LessonType = 'text' | 'video' | 'mission'
export type LessonTrack = 'tools' | 'business'

export interface MissionSpec {
  brief: string
  rubric: { mustFind: string[]; goodToMention: string[] }
}

// Bentuk lesson yang dikirim ke client (body di-omit kalau modul terkunci)
export interface LessonDTO {
  id: string
  slug: string
  title: string
  type: LessonType
  sortOrder: number
  contentMd?: string
  youtubeVideoId?: string | null
  missionBrief?: string       // rubric TIDAK pernah dikirim ke client
  xp: number
  progress: { status: 'in_progress' | 'completed'; score: number | null } | null
}

export interface ModuleDTO {
  id: string
  slug: string
  title: string
  track: LessonTrack
  day: number
  npcId: string
  storyIntro?: string
  teaser?: string
  locked: boolean
  lessons: LessonDTO[]
}

export interface LessonsResponse {
  modules: ModuleDTO[]
}
