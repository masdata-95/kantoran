'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import type { User } from '@supabase/supabase-js'
import { supabase, authFetch } from '@/lib/supabase'
import { POSITIONS, getSalaryRange, normalizeLevel, LEVEL_FOR_BG, type BackgroundType, type LevelType } from '@/lib/positions'
import type { ModuleDTO } from '@/lib/lessons'
// xlsx di-load dinamis saat upload file saja — library berat, jangan masuk bundle awal

// Academy di-load dinamis — react-markdown dkk tidak membebani bundle chat utama
const AcademyPanel = dynamicImport(() => import('@/components/academy/AcademyPanel'), { ssr: false })
// SQL editor (Data Analyst) juga dinamis — sql.js WASM hanya dimuat saat room dibuka
const SqlEditor = dynamicImport(() => import('@/components/SqlEditor'), { ssr: false })

import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import ReferenceLetter from '@/components/ReferenceLetter'
import { countRevisions, computeGrade, GRADE_LABEL, GRADE_REVIEW, getWorkStyle, isConditionalOffer } from '@/lib/performance'
import { track } from '@/lib/track'
import {
  Mail, Handshake, MessagesSquare, Monitor, GraduationCap, Folder, Database, ScrollText,
  Coffee, LogOut, RotateCcw, Briefcase, Menu, X, Coins, SendHorizontal, Lock, FileSpreadsheet, Download,
} from 'lucide-react'

// Tur pengenalan UI untuk user yang baru pertama kali masuk simulasi.
// Selector menunjuk atribut data-tour di elemen bersangkutan.
const TOUR_STEPS: TourStep[] = [
  { title: 'Ini kantor barumu', body: 'Semuanya terjadi lewat chat dan email, persis kerja kantoran. Tur ini cuma enam langkah singkat.' },
  { title: 'Undangan sudah di Inbox', body: 'Email undangan interview masuk ke Inbox. Tidak perlu dibuka dulu, interview-nya langsung di layar ini (HR Office).' },
  { target: '[data-tour="team"]', title: 'Orang-orang di kantor', body: 'Sekarang baru Sinta dari HR yang bisa diajak bicara. Supervisor dan rekan tim muncul setelah kamu tanda tangan kontrak.', needsSidebar: true },
  { target: '[data-tour="rooms"]', title: 'Ruangan', body: 'Yang bergembok terbuka satu per satu sesuai perjalananmu. Kalau ada pesan baru, notifikasinya muncul di atas layar.', needsSidebar: true },
  { target: '[data-tour="coins"]', title: 'Coin', body: 'Bertambah tiap kamu membalas chat, menyelesaikan latihan, atau task disetujui. Anggap saja skor.' },
  { title: 'Sinta sudah menyapamu', body: 'Balas seperti chat dengan HR sungguhan: jujur, jelas, tidak perlu terlalu formal. Interviewnya sekitar 15 menit, di akhir ada nego gaji.' },
]

// ── TYPES ─────────────────────────────────────────
interface Message {
  id: string
  // 'choice' = dilema dengan pilihan; jawaban user menentukan gaya kerja (lib/performance.ts)
  role: 'npc' | 'user' | 'system' | 'email' | 'task' | 'feedback' | 'action' | 'learn' | 'cliff' | 'offering' | 'choice'
  npcId?: string
  text?: string
  data?: Record<string, unknown>
  // Banner gangguan koneksi — TIDAK pernah masuk history AI (lihat buildHistory)
  isError?: boolean
}

interface Notification {
  id: string
  room: string
  roomLabel: string
  text: string
}

interface SimState {
  firstName: string
  email: string
  background: BackgroundType | ''
  bgRole: string
  level: string // jenjang dipilih saat apply (intern | junior | mid)
  position: string
  experience: string
  motivation: string
  step: number
  coins: number
  tasksDone: number
  streak: number
  phaseUnlocked: number
  salaryExpected: number
  salaryOffered: number
  chatHistory: Record<string, Message[]>
  unreadCounts: Record<string, number>
  interviewDone: boolean
  simDay: number // hari simulasi; day-1 = alur scripted, day 2+ dari pipeline /api/tasks
}

const INITIAL: SimState = {
  firstName: '', email: '', background: '', bgRole: '', level: '', position: '',
  experience: '', motivation: '', step: 0, coins: 0, tasksDone: 0,
  streak: 0, phaseUnlocked: 0, salaryExpected: 0, salaryOffered: 0,
  chatHistory: {}, unreadCounts: {}, interviewDone: false, simDay: 1,
}

// Task season dari /api/tasks (day 2+ premium; terkunci hanya kirim {slug,day,title,teaser}).
// Task-1 day-1 TIDAK ada di sini (tetap hardcoded di POSITIONS) — daftar ini task ke-2 dst.
interface SeasonTask {
  slug: string
  day: number
  sort_order?: number
  title: string
  teaser?: string
  brief?: string
  context?: string
  task_type?: string
  file_name?: string
  cross_ref?: string
  locked?: boolean
}

// ── NPC CONFIG ────────────────────────────────────
const NPC_INITIALS: Record<string, Record<string, string>> = {
  data_analyst:       { sup: 'RP', mgr: 'DK', jnr: 'GA' },
  marketing_analyst:  { sup: 'DP', mgr: 'BK', jnr: 'AL' },
  finance_analyst:    { sup: 'AW', mgr: 'PH', jnr: 'NS' },
  hr_generalist:      { sup: 'BR', mgr: 'TS', jnr: 'LL' },
  bizdev:             { sup: 'RF', mgr: 'PA', jnr: 'MR' },
  admin_ops:          { sup: 'SW', mgr: 'DW', jnr: 'FR' },
}

const NPC_AV: Record<string, string> = {
  sinta: 'av-teal', sup: 'av-blue', mgr: 'av-purple', jnr: 'av-amber'
}

// Room → NPC yang menjawab di room itu (dipakai handleSend + retry)
const ROOM_NPC: Record<string, string> = {
  hr_office: 'sinta',
  sup_chat: 'sup',
  mgr_chat: 'mgr',
  pantry: 'jnr',
  slack: 'jnr',
  jnr: 'jnr',
}

// Room boleh dibuka pada step tertentu? Dipakai saat restore room terakhir setelah
// refresh — jangan pernah mendaratkan user di room yang masih terkunci.
const isRoomAvailable = (room: string, step: number): boolean => {
  const phase = step >= 3 ? 1 : 0
  const locked: Record<string, boolean> = {
    inbox: false, hr_office: false,
    slack: phase < 1, meeting: phase < 1, sup_chat: phase < 1, mgr_chat: phase < 1,
    jnr: phase < 1, pantry: phase < 1, workspace: phase < 1, reference: phase < 1,
    academy: step < 4, file_manager: step < 5, database: step < 5,
  }
  return room in locked && !locked[room]
}

// Ringkasan CV dari profil untuk Sinta. Dulu profil diisi 3 menit tapi tidak pernah
// sampai ke HR, jadi interview menanyakan ulang semuanya. Server memotong di 600 char.
const buildCvSummary = (p?: UserProfile | null): string => {
  if (!p) return ''
  const edu = (p.education || [])
    .filter(e => e.institution?.trim())
    .map(e => `${e.major || 'jurusan tidak disebut'} di ${e.institution}${e.status === 'kuliah' ? ' (masih kuliah)' : e.year ? ` (lulus ${e.year})` : ''}`)
    .join('; ')
  const exp = (p.experience || [])
    .filter(e => !e.isSimulation && (e.company?.trim() || e.position?.trim()))
    .map(e => `${e.position || 'anggota'} di ${e.company || '-'}${e.description ? `, ${e.description.slice(0, 100)}` : ''}`)
    .join('; ')
  const skills = (p.skills || []).slice(0, 10).join(', ')
  return [
    edu && `Pendidikan: ${edu}`,
    exp ? `Pengalaman: ${exp}` : 'Pengalaman: belum ada pengalaman kerja',
    skills && `Skill yang dicantumkan: ${skills}`,
    p.city && `Domisili: ${p.city}`,
  ].filter(Boolean).join('. ')
}

// Gaji hasil nego dibaca dari offering letter di inbox — salaryOffered di state
// hilang setelah refresh, offering letter tidak.
const getOfferSalary = (history: Record<string, Message[]>): number => {
  const offer = (history['inbox'] || []).find(m => m.role === 'email' && m.data?.isOffering)
  return Number(offer?.data?.salary || 0)
}

// Interview berjalan di step 0. Run dianggap ada (layak disimpan / dipulihkan)
// begitu user sudah membalas Sinta, bukan menunggu step > 0. Dulu refresh di
// tengah interview 15 menit menghapus seluruh percakapan.
const hasStartedInterview = (history: Record<string, Message[]> | undefined): boolean =>
  (history?.['hr_office'] || []).some(m => m.role === 'user')

// Nama channel Slack tim, satu sumber (dulu header & pesan sistem beda format)
const channelOf = (pos?: { dept: string }) =>
  pos?.dept.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'general'

// Nama panggilan NPC: "Mbak Sari Wulandari" → "Mbak Sari", "Rizky Pratama" → "Rizky"
const callName = (full?: string) => {
  const w = (full || '').split(' ')
  return ['Mbak', 'Pak', 'Bu', 'Kak', 'Mas'].includes(w[0]) ? w.slice(0, 2).join(' ') : w[0] || ''
}

const fmtJuta = (n: number) => (n / 1000000).toFixed(1).replace(/\.0$/, '').replace('.', ',')

// ── MAIN COMPONENT ────────────────────────────────
import ProfileTab from '@/components/ProfileTab'
import type { UserProfile } from '@/lib/profile'
import type { Experience } from '@/lib/profile'

export default function SimulatorApp({ user, userProfile, initialPosition, initialBackground, initialLevel, onExit, onWishlist }: {
  user: User
  userProfile?: UserProfile | null
  initialPosition?: string
  initialBackground?: string
  initialLevel?: LevelType
  onExit?: () => void
  onWishlist?: (coins: number, tasksDone: number, recap?: string) => void
}) {
  const [state, setState] = useState<SimState>(INITIAL)
  const [view, setView]   = useState('inbox')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [progLoading, setProgLoading] = useState(true)
  const [showApp, setShowApp] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<string>('')
  const [reviewResult, setReviewResult] = useState<{ review: string; isApproved: boolean } | null>(null)
  // Daftar task pipeline (task-2 day-1, lalu day 2+). Task terkunci hanya bawa {slug,day,title,teaser}.
  const [seasonTasks, setSeasonTasks] = useState<SeasonTask[]>([])
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  // Pesan error di Workspace (file tak terbaca / review gagal) — pengganti alert()
  const [workspaceError, setWorkspaceError] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(userProfile || null)
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // drawer di mobile
  const [viewportH, setViewportH] = useState<number | null>(null) // tinggi area terlihat (di atas keyboard)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const supDmSentRef = useRef(false)
  const orientationStartedRef = useRef(false)
  const viewRef = useRef(view)
  // Academy = bekal OPSIONAL (bukan gate): task turun setelah standup, training
  // disarankan supervisor saat user butuh (revisi pertama). trainingDone dipakai
  // untuk apresiasi supervisor + milestone surat referensi.
  const [trainingDone, setTrainingDone] = useState(false)
  const trainingAdvanceRef = useRef(false) // guard: task step 4→5 hanya sekali
  const trainingVacuousRef = useRef(false) // posisi tanpa konten training → tanpa apresiasi
  // Tur pengenalan UI — sekali saja per akun (flag localStorage)
  const [showTour, setShowTour] = useState(false)
  const tourKey = `kantoran_tour_v1_${user.id}`

  // Keep viewRef in sync with view state
  useEffect(() => { viewRef.current = view }, [view])

  // Auto focus input after send
  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus()
        }
      })
    })
  }, [])

  // Watch loading state, refocus when loading finishes
  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus()
        }
      })
    }
  }, [loading])

  // Auto scroll messages
  useEffect(() => {
    if (msgsRef.current) {
      setTimeout(() => {
        msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [state.chatHistory, view, viewportH])

  // Fix keyboard mobile: ukur area terlihat (di atas keyboard) via VisualViewport.
  // h-dvh saja tidak cukup di iOS Safari, keyboard menutupi input + chat.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      setViewportH(vv.height)
      // pin window ke atas supaya layout tidak ter-scroll ke balik keyboard
      window.scrollTo(0, 0)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [])

  // Kunci scroll body selama di simulator (cegah halaman geser saat keyboard muncul)
  useEffect(() => {
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = prev.overflow
      document.body.style.position = prev.position
      document.body.style.width = prev.width
    }
  }, [])

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [user.id])

  // Mirror state ke ref supaya interval auto-save tidak perlu dibuat ulang tiap render
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Muat daftar task pipeline begitu app siap. Gagal/kosong → day 2 tetap jatuh ke
  // wishlist seperti sebelumnya (aman, tidak menghalangi day-1).
  useEffect(() => {
    if (!showApp || !state.position) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`/api/tasks?position=${encodeURIComponent(state.position)}`)
        const data = await res.json()
        if (!cancelled && Array.isArray(data.tasks)) setSeasonTasks(data.tasks as SeasonTask[])
      } catch { /* biarkan kosong */ }
    })()
    return () => { cancelled = true }
  }, [showApp, state.position])

  // Auto-save every 30s — interval dibuat SEKALI; dirty-check di saveProgress
  // memastikan user idle tidak menghasilkan write ke database sama sekali
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current
      if (s.position && (s.step > 0 || hasStartedInterview(s.chatHistory))) saveProgress()
    }, 30000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // HP: user pindah app / kunci layar di tengah interview → simpan saat itu juga,
  // jangan menunggu siklus 30 detik berikutnya
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      const s = stateRef.current
      if (s.position && (s.step > 0 || hasStartedInterview(s.chatHistory))) saveProgress()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save langsung tiap step berubah, transisi penting (offering, kontrak, task) tidak boleh hilang
  useEffect(() => {
    if (state.step > 0) saveProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step])

  // Slack → Supervisor DM trigger
  // After user sends 1 message in slack OR 90 seconds, supervisor sends DM
  useEffect(() => {
    if (state.step !== 3) return
    const slackMsgs = (state.chatHistory['slack'] || []).filter(m => m.role === 'user')
    const npcMsgs = (state.chatHistory['slack'] || []).filter(m => m.role === 'npc').length

    // Trigger after user sends first message AND 3+ NPC responses in slack
    if (slackMsgs.length >= 1 && npcMsgs >= 3 && !supDmSentRef.current) {
      supDmSentRef.current = true
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        addMsg('sup_chat', {
          role: 'npc', npcId: 'sup',
          text: `${state.firstName}, yuk kita standup sebentar. Ada beberapa hal yang mau aku sampaikan untuk hari pertama kamu.`
        }, true)
        showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Mengajakmu standup sebentar')
        setState(prev => ({
          ...prev,
          unreadCounts: { ...prev.unreadCounts, sup_chat: (prev.unreadCounts['sup_chat'] || 0) + 1 }
        }))
      }, 1500)
    }
  }, [state.chatHistory['slack']])

  // Auto-trigger supervisor DM after 90 seconds in Slack (if user doesn't chat)
  useEffect(() => {
    if (state.step !== 3) return
    // Kalau DM supervisor sudah ada di history (mis. habis reload), jangan kirim ulang
    if ((state.chatHistory['sup_chat'] || []).length > 0) {
      supDmSentRef.current = true
      return
    }
    supDmSentRef.current = false
    const timer = setTimeout(() => {
      if (supDmSentRef.current) return
      supDmSentRef.current = true
      const pos = POSITIONS[state.position]
      addMsg('sup_chat', {
        role: 'npc', npcId: 'sup',
        text: `${state.firstName}, yuk standup sebentar. Banyak yang mau aku jelasin untuk hari pertama kamu di sini.`
      }, true)
      showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Mengajakmu standup sebentar')
      setState(prev => ({
        ...prev,
        unreadCounts: { ...prev.unreadCounts, sup_chat: (prev.unreadCounts['sup_chat'] || 0) + 1 }
      }))
    }, 90000)
    return () => clearTimeout(timer)
  }, [state.step])

  // Step 3 → 4: saat user membuka DM supervisor setelah diajak standup, mulai orientasi
  useEffect(() => {
    if (orientationStartedRef.current) return
    if (state.step !== 3 || view !== 'sup_chat') return
    if ((state.chatHistory['sup_chat'] || []).length === 0) return
    orientationStartedRef.current = true
    handleNextStep(4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, state.step, state.chatHistory])

  // Tutup drawer mobile tiap kali pindah ruangan
  useEffect(() => { setSidebarOpen(false) }, [view])

  // Simpan room terakhir per (user, posisi) — dipulihkan saat refresh
  useEffect(() => {
    if (!showApp || !state.position) return
    try { sessionStorage.setItem(`kantoran_last_view_${user.id}_${state.position}`, view) } catch { /* abaikan */ }
  }, [view, showApp, state.position, user.id])

  // Tampilkan tur saat pertama kali masuk simulasi (masih di tahap awal, belum pernah lihat tur)
  useEffect(() => {
    if (!showApp) return
    try {
      if (!localStorage.getItem(tourKey) && stateRef.current.step <= 1) setShowTour(true)
    } catch { /* localStorage tidak tersedia → lewati tur */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showApp])

  const finishTour = useCallback(() => {
    try { localStorage.setItem(tourKey, '1') } catch { /* abaikan */ }
    setShowTour(false)
    setSidebarOpen(false)
  }, [tourKey])

  // Step tur yang menyorot elemen di dalam sidebar butuh drawer terbuka di mobile
  const handleTourStep = useCallback((step: TourStep) => {
    if (window.innerWidth < 768) setSidebarOpen(!!step.needsSidebar)
  }, [])

  // Clear unread when viewing a room
  useEffect(() => {
    if (state.unreadCounts[view] > 0) {
      setState(prev => ({
        ...prev,
        unreadCounts: { ...prev.unreadCounts, [view]: 0 }
      }))
    }
  }, [view])

  // Show notification helper
  const showNotif = useCallback((room: string, roomLabel: string, text: string) => {
    const n: Notification = { id: Date.now().toString(), room, roomLabel, text }
    setNotification(n)
    setTimeout(() => setNotification(null), 5000)
  }, [])

  // Cek apakah modul training day-1 sudah selesai (termasuk misi praktiknya).
  // Bukan gate lagi — dipakai untuk apresiasi supervisor + baris surat referensi.
  const evalTraining = useCallback((modules: ModuleDTO[]) => {
    const gateModule = modules.find(m => m.day === 1 && m.track === 'tools' && !m.locked)
    // Posisi tanpa konten training → anggap selesai, tapi tandai supaya tidak ada apresiasi palsu
    if (!gateModule || gateModule.lessons.length === 0) {
      trainingVacuousRef.current = true
      setTrainingDone(true)
      return
    }
    if (gateModule.lessons.every(l => l.progress?.status === 'completed')) setTrainingDone(true)
  }, [])

  // Reload di step 4+: cek status training dari server (untuk surat referensi & apresiasi)
  useEffect(() => {
    if (state.step < 4 || trainingDone || !state.position) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`/api/lessons?position=${encodeURIComponent(state.position)}`)
        const data = await res.json()
        if (!cancelled && res.ok) evalTraining(data.modules || [])
      } catch { /* gagal fetch → AcademyPanel jadi sumber status berikutnya */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.position])

  // Step 4 → 5: task turun setelah user menjawab standup — TIDAK menunggu training.
  // Belajar itu opsional; kerjaan tetap datang seperti kantor sungguhan.
  useEffect(() => {
    if (state.step !== 4 || trainingAdvanceRef.current) return
    const userMsgs = (state.chatHistory['sup_chat'] || []).filter(m => m.role === 'user').length
    if (userMsgs < 1) return
    trainingAdvanceRef.current = true
    setTimeout(() => {
      addMsg('sup_chat', {
        role: 'npc', npcId: 'sup',
        text: `Oke, noted. Ini task pertamamu. Baca brief-nya dulu, kalau ada yang nggak jelas tanya sebelum mulai.`
      })
      setTimeout(() => handleNextStep(5), 1500)
    }, 6000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chatHistory['sup_chat'], state.step])

  // Fallback: user diam 2 menit setelah orientasi → task tetap turun
  useEffect(() => {
    if (state.step !== 4 || trainingAdvanceRef.current) return
    const t = setTimeout(() => {
      if (trainingAdvanceRef.current || stateRef.current.step !== 4) return
      trainingAdvanceRef.current = true
      addMsg('sup_chat', {
        role: 'npc', npcId: 'sup',
        text: `Anyway, ini task pertamamu. Standup bisa nyusul, yang penting kamu mulai pegang kerjaan dulu.`
      })
      setTimeout(() => handleNextStep(5), 1500)
    }, 120000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step])

  // Apresiasi kalau user menyelesaikan training (opsional) setelah task berjalan —
  // sekali saja (cek history), dan tidak untuk posisi tanpa konten training
  useEffect(() => {
    if (!trainingDone || trainingVacuousRef.current || state.step < 5) return
    const already = (state.chatHistory['sup_chat'] || []).some(
      m => m.role === 'npc' && (m.text || '').includes('training module kamu kelar')
    )
    if (already) return
    setTimeout(() => {
      addMsg('sup_chat', {
        role: 'npc', npcId: 'sup',
        text: `Btw aku lihat training module kamu kelar, termasuk misinya. Bagus, itu bakal kepake banget di task-mu.`
      }, viewRef.current === 'sup_chat')
      addCoins(10)
      track('training_done', { position: stateRef.current.position })
    }, 2000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDone, state.step])

  const loadProgress = async () => {
    try {
      // Multi-role: muat progress khusus posisi yang dibuka dari hub karir
      const qs = initialPosition ? `?position=${encodeURIComponent(initialPosition)}` : ''
      const res = await authFetch(`/api/progress${qs}`)
      const { progress } = await res.json()
      if (progress && (progress.step > 0 || hasStartedInterview(progress.chat_history as Record<string, Message[]>))) {
        const loadedHistory = (progress.chat_history as Record<string, Message[]>) || {}
        // interviewDone juga dipulihkan dari kartu "interview_done" di history —
        // refresh setelah interview selesai tapi sebelum klik offering TIDAK boleh
        // membuka interview lagi (kartu bisa dobel)
        const hasDoneCard = (loadedHistory['hr_office'] || []).some(
          m => m.role === 'action' && (m.data as Record<string, unknown> | undefined)?.type === 'interview_done'
        )
        setState(prev => ({
          ...prev,
          firstName: progress.first_name || '',
          email: progress.email || '',
          background: (progress.background || initialBackground || '') as import('@/lib/positions').BackgroundType | '',
          bgRole: progress.bg_role || '',
          level: progress.level || '',
          position: progress.position || initialPosition || '',
          step: progress.step || 0,
          coins: progress.coins || 0,
          tasksDone: progress.tasks_done || 0,
          streak: progress.streak || 0,
          phaseUnlocked: progress.step >= 3 ? 1 : 0,
          chatHistory: loadedHistory,
          interviewDone: progress.step >= 2 || hasDoneCard,
          simDay: progress.sim_day || 1,
        }))
        // Refresh harus mendarat kembali di room terakhir yang dibuka, bukan reset ke slack/inbox
        let initialView = progress.step >= 3 ? 'slack' : progress.step >= 2 ? 'inbox' : 'hr_office'
        try {
          const savedView = sessionStorage.getItem(`kantoran_last_view_${user.id}_${progress.position || initialPosition || ''}`)
          if (savedView && isRoomAvailable(savedView, progress.step || 0)) initialView = savedView
        } catch { /* sessionStorage tidak tersedia */ }
        setView(initialView)
        setShowApp(true)

        // Kantor tetap hidup saat user pergi: kembali setelah > 8 jam → ada pesan
        // yang "terjadi selama kamu tidak ada". last_active ter-update saat auto-save,
        // jadi tidak dobel dalam sesi yang sama.
        const gapMs = progress.last_active ? Date.now() - new Date(progress.last_active).getTime() : 0
        const stepNow = progress.step || 0
        if (gapMs > 8 * 3600 * 1000 && stepNow >= 3 && stepNow < 10) {
          const posNow = POSITIONS[progress.position || '']
          setTimeout(() => {
            if (stepNow >= 5) {
              addMsg('sup_chat', {
                role: 'npc', npcId: 'sup',
                text: `${progress.first_name || 'Hei'}, gimana progress task kemarin? Kalau ada yang ngeganjel bilang aja, jangan dipendam.`
              })
              showNotif('sup_chat', posNow?.supervisor.name || 'Supervisor', 'Ada pesan baru selama kamu pergi')
            } else {
              addMsg('jnr', {
                role: 'npc', npcId: 'jnr',
                text: `eh kemarin lo langsung cabut ya? seru tau, pantry sempet heboh gara-gara mesin kopi error terus semua panik wkwk. btw semangat ya hari ini!`
              })
              showNotif('jnr', posNow?.junior.name || 'Teman tim', 'Ada pesan baru selama kamu pergi')
            }
          }, 2500)
        }
      }
    } catch (e) {
      console.error('Load progress error:', e)
    } finally {
      setProgLoading(false)
    }
  }

  // Auto-start simulator when initialPosition is provided (from job listing)
  useEffect(() => {
    if (!progLoading && !showApp && initialPosition) {
      const pos = POSITIONS[initialPosition]
      if (!pos) return
      const bg = (initialBackground || 'fresh_grad') as import('@/lib/positions').BackgroundType
      const level = initialLevel || LEVEL_FOR_BG[bg] || 'intern'
      const role = pos.getRole(level)
      const firstName = userProfile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Kamu'

      // Build inbox email and HR Office message directly into initial state
      const inviteEmailId = `invite-${Date.now()}`
      const sintaMsgId = `sinta-${Date.now() + 1}`

      const inviteEmail = {
        id: inviteEmailId,
        role: 'email' as const,
        data: {
          from: 'sinta@vantara.co.id',
          subject: `Undangan Seleksi, ${role}`,
          preview: 'Kami mengundang kamu ke tahap seleksi untuk posisi ini.',
          isInvite: true,
          body: `Halo ${firstName},

Terima kasih sudah melamar posisi ${role} di PT Vantara Nusantara.

Kami dengan senang hati mengundang kamu ke tahap seleksi awal berupa sesi interview singkat. Estimasi waktu: 15-20 menit.

Silakan buka menu HR Office untuk memulai sesi interview dengan Sinta Maharani, HR Business Partner kami.

Sampai jumpa!

Sinta Maharani
HR Business Partner
PT Vantara Nusantara`
        }
      }

      const sintaMsg = {
        id: sintaMsgId,
        role: 'npc' as const,
        npcId: 'sinta',
        // Satu pertanyaan saja (aturan prompt Sinta) + bukti CV sudah dibaca
        text: (() => {
          const edu = userProfile?.education?.find(e => e.institution?.trim() && e.major?.trim())
          return edu
            ? `Halo ${firstName}, aku Sinta dari HR Vantara. CV kamu udah aku baca, ${edu.major} di ${edu.institution} ya. Santai aja, anggap ngobrol biasa. Gimana kabarnya hari ini?`
            : `Halo ${firstName}, aku Sinta dari HR Vantara. Santai aja, anggap ngobrol biasa. Gimana kabarnya hari ini?`
        })()
      }

      const initState: SimState = {
        ...INITIAL,
        firstName,
        email: user.email || '',
        background: bg,
        bgRole: role,
        level,
        position: initialPosition,
        step: 0,
        chatHistory: {
          inbox: [inviteEmail],
          hr_office: [sintaMsg],
        },
        unreadCounts: {
          inbox: 1,
        }
      }

      setState(initState)
      setShowApp(true)
      // Daratkan langsung di HR Office: Sinta sudah menyapa + kolom ketik terlihat,
      // hilangkan friksi navigasi inbox->email->HR Office yang membakar apply->interview.
      // Email undangan tetap di Inbox (badge unread) untuk imersi, tapi bukan penghalang.
      setView('hr_office')
      setTimeout(() => {
        showNotif('hr_office', 'Sinta Maharani', 'Sinta sudah menyapamu. Balas untuk mulai interview.')
      }, 800)
    }
  }, [progLoading, showApp, initialPosition])

  const lastSavedRef = useRef('')
  const saveProgress = useCallback(async () => {
    try {
      const s = stateRef.current
      const payload = JSON.stringify({
        progress: {
          firstName: s.firstName,
          email: s.email || user.email,
          background: s.background,
          bgRole: s.bgRole,
          level: s.level,
          position: s.position,
          step: s.step,
          coins: s.coins,
          tasksDone: s.tasksDone,
          streak: s.streak,
          simDay: s.simDay,
          chatHistory: s.chatHistory,
        }
      })
      // Dirty-check: jangan tulis ulang blob yang sama ke database
      if (payload === lastSavedRef.current) return
      const res = await authFetch('/api/progress', { method: 'POST', body: payload })
      // Hanya tandai tersimpan kalau server benar-benar menerima — save yang gagal
      // (409 stale / 500) harus dicoba lagi di siklus berikutnya, bukan dianggap beres
      if (res.ok) lastSavedRef.current = payload
    } catch (e) { console.error('Save progress error:', e) }
  }, [user])

  const addMsg = useCallback((room: string, msg: Omit<Message, 'id'>, silent = false) => {
    const newMsg: Message = { ...msg, id: `${Date.now()}-${Math.random()}` }
    setState(prev => {
      const newHistory = {
        ...prev.chatHistory,
        [room]: [...(prev.chatHistory[room] || []), newMsg]
      }
      const newUnread = { ...prev.unreadCounts }
      // Only increment unread if not currently viewing this room
      if (!silent) {
        // We can't access view state here directly, increment is handled in the UI
        newUnread[room] = (newUnread[room] || 0) + 1
      }
      return { ...prev, chatHistory: newHistory, unreadCounts: newUnread }
    })
    return newMsg
  }, [])

  const addCoins = useCallback((n: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + n }))
  }, [])

  // Antar satu task pipeline: brief ke sup_chat + kartu file di file_manager.
  // File day 1 dari /tasks (public); day >= 2 dari /api/task-file (bucket, cek entitlement).
  const deliverTask = (task: SeasonTask, num: number) => {
    const p = POSITIONS[stateRef.current.position]
    const ctx = [task.context, task.cross_ref].filter(Boolean).join(' ')
    addMsg('sup_chat', {
      role: 'task',
      data: {
        num, title: task.title,
        deadline: task.day === 1 ? 'Sore ini' : 'Besok jam 09.00',
        dept: `Dept. ${p?.dept}`, body: task.brief, ctx,
      }
    })
    addMsg('sup_chat', { role: 'action', data: { label: 'Buka File Manager', goTo: 'file_manager' } })
    if (task.file_name) {
      addMsg('file_manager', {
        role: 'task',
        data: {
          title: task.title,
          body: 'Download file di bawah, kerjakan, lalu upload hasilnya di Workspace.',
          file: task.file_name,
          href: task.day >= 2 ? `/api/task-file?slug=${task.slug}` : `/tasks/${task.file_name}`,
          isDownload: true,
        }
      }, true)
    }
    showNotif('sup_chat', p?.supervisor.name || 'Supervisor', `Task baru: ${task.title}`)
  }

  // Hari kerja selesai (task terakhir hari itu approved) → beat penutup + gerbang hari
  // berikutnya. Hari berikutnya terbuka (entitlement) → tombol advance (nextStep 97);
  // terkunci / konten habis → gerbang wishlist (nextStep 99, perilaku lama).
  const finishDay = (newCoins: number, newTasksDone: number, next?: SeasonTask) => {
    const p = POSITIONS[stateRef.current.position]
    const day = stateRef.current.simDay
    const name = stateRef.current.firstName
    if (day === 1) {
      track('day1_done', {
        position: stateRef.current.position, level: stateRef.current.level,
        revisions: countRevisions(stateRef.current.chatHistory), coins: newCoins,
      })
    }
    const canAdvance = !!next && !next.locked && next.day > day
    const dayAction: Omit<Message, 'id'> = {
      role: 'action',
      data: canAdvance
        ? { label: `Lanjut ke hari ke-${next!.day}`, nextStep: 97, type: 'day_done', coins: newCoins, tasksDone: newTasksDone }
        : { label: 'Selesai untuk hari ini', nextStep: 99, type: 'day_done', coins: newCoins, tasksDone: newTasksDone },
    }
    setTimeout(() => {
      if (day === 1) {
        addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `${name}! Denger-denger task pertamamu approved ya, selamat! Aku dulu sampe minggu kedua baru approved wkwk` })
        setTimeout(() => {
          addMsg('jnr', { role: 'npc', npcId: 'jnr', text: p?.teachBack || 'eh btw, ajarin dong tadi lo ngerjainnya gimana?' })
          showNotif('jnr', p?.junior.name || 'Teman tim', `${(p?.junior.name || 'Junior').split(' ')[0]} minta tolong diajari sesuatu`)
        }, 12000)
      }
      setTimeout(() => {
        addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Good work hari ini ${name}. Sudah jam 5, bisa pulang dulu.${canAdvance ? ' Besok standup jam 9, ada lanjutannya.' : ''}` })
        addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Kebiasaan tim tiap pulang: sebut satu hal yang paling kamu pelajari hari ini. Apa punyamu?` })
        addMsg('sup_chat', dayAction)
        showNotif('sup_chat', p?.supervisor.name || 'Supervisor', 'Hari ini selesai, ada pesan untukmu')
        if (day === 1) {
          setTimeout(() => {
            addMsg('mgr_chat', { role: 'npc', npcId: 'mgr', text: `${name}, ${p?.supervisor.name.split(' ')[0]} cerita task pertamamu langsung approved. Jarang-jarang itu terjadi di hari pertama. Besok pagi mampir ke ruanganku ya, ada hal yang mau aku diskusikan soal kamu.` })
            showNotif('mgr_chat', p?.manager.name || 'Manager', 'Mengirim pesan untukmu')
          }, 3500)
        }
      }, 2000)
    }, 1500)
  }

  // Build full conversation history from chat messages for AI memory
  const buildHistory = useCallback((room: string, npcId: string) => {
    const messages = state.chatHistory[room] || []
    const history: { role: 'user' | 'assistant'; content: string }[] = []
    for (const msg of messages) {
      // Banner error JANGAN masuk memori AI — dulu teks "gangguan koneksi" terkirim
      // sebagai "jawaban Sinta" dan bikin interview lompat topik setelah error
      if (msg.isError) continue
      if (msg.role === 'user' && msg.text) {
        history.push({ role: 'user', content: msg.text })
      } else if (msg.role === 'npc' && msg.text && msg.npcId === npcId) {
        history.push({ role: 'assistant', content: msg.text })
      }
    }
    return history.slice(-30)
  }, [state.chatHistory])

  const callChat = async (npcId: string, userMsg: string, room: string): Promise<{ reply: string; interviewDone: boolean; interviewOutcome?: string; failed: boolean }> => {
    setLoading(true)
    try {
      const history = buildHistory(room, npcId)
      const messages = [...history, { role: 'user' as const, content: userMsg }]
      const res = await authFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          npcId,
          messages,
          userContext: {
            firstName: state.firstName,
            email: state.email || user.email,
            background: state.background,
            bgRole: state.bgRole,
            level: state.level,
            position: state.position,
            experience: state.experience || buildCvSummary(profile),
            motivation: state.motivation,
            step: state.step,
          },
          positionId: state.position,
        })
      })
      const data = await res.json()
      return {
        reply: (data.reply as string) || 'Maaf, ada gangguan sebentar. Coba lagi ya!',
        interviewDone: Boolean(data.interviewDone),
        interviewOutcome: data.interviewOutcome as string | undefined,
        failed: Boolean(data.failed) || !data.reply,
      }
    } catch {
      return { reply: 'Maaf ada gangguan koneksi. Coba lagi ya!', interviewDone: false, failed: true }
    } finally {
      setLoading(false)
    }
  }

  // Kirim userMsg ke NPC dan proses balasannya. Dipakai handleSend (pesan baru)
  // dan handleRetry (kirim ulang pesan user terakhir tanpa menduplikasinya di history).
  const deliverReply = async (npcId: string, userMsg: string, room: string) => {
    // callChat builds full history from chatHistory for AI memory
    const { reply, interviewDone: serverSaysDone, interviewOutcome, failed } = await callChat(npcId, userMsg, room)

    if (failed) {
      // Gangguan koneksi → banner error + tombol "Kirim ulang", BUKAN bubble NPC.
      // Kalau masuk history sebagai pesan NPC, AI membacanya seolah topik sudah
      // dijawab dan lompat ke tahap berikutnya (temuan beta Juli 2026).
      addMsg(room, { role: 'system', text: reply, isError: true }, true)
      return
    }

    addMsg(room, { role: 'npc', npcId, text: reply }, true)
    addCoins(2)

    // Notify if user navigated to a different room while waiting for reply
    if (viewRef.current !== room) {
      const roomLabels: Record<string, string> = {
        hr_office: 'Sinta Maharani',
        sup_chat: pos?.supervisor.name || 'Supervisor',
        mgr_chat: pos?.manager.name || 'Manager',
        pantry: pos?.junior.name || 'Pantry',
        slack: 'Slack',
        jnr: pos?.junior.name || 'Kolega',
      }
      showNotif(room, roomLabels[room] || room, 'Membalas pesanmu')
      setState(prev => ({
        ...prev,
        unreadCounts: { ...prev.unreadCounts, [room]: (prev.unreadCounts[room] || 0) + 1 }
      }))
    }

    // Interview DITOLAK: bukan pintu keluar, tapi cabang cerita — Sinta sudah memberi
    // alasan spesifik; tawarkan belajar (Academy) + interview ulang
    if (npcId === 'sinta' && interviewOutcome === 'rejected' && !state.interviewDone) {
      track('interview_rejected', { position: state.position, level: state.level })
      setTimeout(() => {
        addMsg('hr_office', {
          role: 'action',
          data: { label: 'Pelajari cara menjawab interview', goTo: 'academy', type: 'interview_rejected' }
        }, true)
        addMsg('hr_office', {
          role: 'action',
          data: { label: 'Ulangi interview', nextStep: 98 }
        }, true)
      }, 1500)
      return
    }

    // Check if interview is done, use functional setState to get latest state
    if (npcId === 'sinta') {
      const conditional = interviewOutcome === 'conditional'
      setState(prev => {
        if (!prev.interviewDone) {
          // Sumber utama: token [SELESAI] dari server. Fallback keyword HARUS sangat ketat:
          // frasa seperti "kamu diterima" pernah false-positive pada pertanyaan pengandaian
          // ("KALAU kamu diterima di sini, gimana kamu..."), jadi hanya frasa penutup
          // eksplisit + pesan tidak boleh diakhiri pertanyaan + interview sudah panjang
          // (>= 8 tanya jawab, sesuai durasi minimal di prompt Sinta sebelum bahas gaji).
          const hrMsgs = prev.chatHistory['hr_office'] || []
          const userMsgCount = hrMsgs.filter(m => m.role === 'user').length
          // Guard nego gaji: interview TIDAK boleh selesai (termasuk via [SELESAI])
          // kalau gaji belum pernah dibahas — offering letter bakal pakai angka default
          const salaryDiscussed = hrMsgs.some(m =>
            !m.isError && (m.role === 'user' || m.role === 'npc') &&
            m.text && /gaji|juta|salary/i.test(m.text)
          )
          const doneSignals = [
            'sampai jumpa di hari pertama', 'sampai ketemu di kantor',
            'akan kami kirimkan offering', 'offering letter akan',
            'kami kirim offering', 'selamat bergabung', 'welcome to the team',
            'kami tutup interview', 'interview kita cukup sampai',
          ]
          const endsWithQuestion = reply.trim().endsWith('?')
          const isDone = salaryDiscussed && (serverSaysDone ||
            (userMsgCount >= 8 && !endsWithQuestion && doneSignals.some(s => reply.toLowerCase().includes(s))))
          if (isDone) {
            track('interview_done', { position: prev.position, level: prev.level, conditional })
            setTimeout(() => {
              addMsg('hr_office', {
                role: 'action',
                data: {
                  label: conditional
                    ? 'Interview selesai. Sinta menerimamu dengan catatan evaluasi, offering letter dikirim ke Inbox.'
                    : 'Interview selesai. Sinta mengirim offering letter ke Inbox.',
                  subLabel: 'Buka offering letter',
                  nextStep: 2,
                  type: 'interview_done',
                  // Diterima bersyarat: offer konservatif + supervisor lebih dingin +
                  // baris "dengan catatan" di surat referensi (lib/performance.ts)
                  conditional,
                }
              })
            }, 1500)
            return { ...prev, interviewDone: true }
          }
        }
        return prev
      })
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    focusInput()

    const npcId = ROOM_NPC[view] || 'sinta'
    const room = view

    // Analytics: pesan pertama user ke Sinta = interview benar-benar dimulai
    if (room === 'hr_office' && !(state.chatHistory['hr_office'] || []).some(m => m.role === 'user')) {
      track('interview_start', { position: state.position, level: state.level })
    }

    addMsg(room, { role: 'user', text: msg }, true)
    await deliverReply(npcId, msg, room)
  }

  // Retry setelah gangguan koneksi: buang banner error, kirim ulang pesan user
  // terakhir TANPA menambahkannya lagi ke history (tidak dobel di chat maupun di AI)
  const handleRetry = async (room: string) => {
    if (loading) return
    const lastUser = [...(state.chatHistory[room] || [])].reverse().find(m => m.role === 'user' && m.text)
    if (!lastUser?.text) return
    setState(prev => ({
      ...prev,
      chatHistory: {
        ...prev.chatHistory,
        [room]: (prev.chatHistory[room] || []).filter(m => !m.isError)
      }
    }))
    await deliverReply(ROOM_NPC[room] || 'sinta', lastUser.text, room)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleLogout = async () => {
    await saveProgress()
    await supabase.auth.signOut()
  }

  // Keluar ke hub karir (job listing) — progress tersimpan, bisa lanjut atau coba posisi lain
  const handleExit = async () => {
    await saveProgress()
    onExit?.()
  }

  const handleRestart = async () => {
    if (!confirm('Ulangi posisi ini dari awal?\n\nChat, gaji hasil nego, dan surat referensi di posisi ini akan dihapus. Posisi lain tidak terpengaruh.')) return
    try {
      // Multi-role: reset hanya run posisi yang sedang dibuka
      await authFetch('/api/reset', { method: 'POST', body: JSON.stringify({ position: state.position }) })
      lastSavedRef.current = ''
      trainingAdvanceRef.current = false
      trainingVacuousRef.current = false
      setTrainingDone(false)
      setState(INITIAL)
      setShowApp(false)
      setView('inbox')
      setReviewResult(null)
      setUploadedFile(null)
      setExtractedData('')
    } catch { showNotif(view, 'Gagal', 'Belum bisa mengulang. Periksa koneksi lalu coba lagi.') }
  }

  // Rekap personal untuk dibagikan — dibangun dari data run (bukan template generik)
  const buildRecap = () => {
    const grade = GRADE_LABEL[computeGrade(countRevisions(state.chatHistory))]
    const ws = getWorkStyle(state.chatHistory)
    const offered = state.salaryOffered || getOfferSalary(state.chatHistory)
    const salary = offered > 0 ? `nego gaji sampai Rp ${fmtJuta(offered)} juta` : 'nego gaji sendiri'
    return `Hari pertamaku sebagai ${state.bgRole} di simulasi Kantoran: lulus interview HR, ${salary}, task pertama APPROVED dengan penilaian "${grade}"${ws ? ` dan gaya kerja "${ws.label}"` : ''}. ${state.coins} Kantor Coin terkumpul. Rasain juga jadi anak kantoran: kantoran.id`
  }

  const handleNextStep = async (step: number, _data?: Record<string, unknown>) => {
    // Special case: go to day 2 / wishlist
    if (step === 99) {
      if (onWishlist) {
        await saveProgress()
        onWishlist(state.coins, state.tasksDone, buildRecap())
      }
      return
    }

    // Maju ke hari berikutnya (day 2+): naikkan simDay, bersihkan workspace, antar task pipeline.
    if (step === 97) {
      const next = seasonTasks[stateRef.current.tasksDone - 1]
      if (next && !next.locked) {
        setState(prev => ({ ...prev, simDay: next.day }))
        setExtractedData(''); setUploadedFile(null); setReviewResult(null)
        setView('sup_chat')
        setTimeout(() => {
          addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Pagi ${stateRef.current.firstName}. Hari baru, langsung ada yang perlu kita kerjain. Ini brief-nya.` })
          deliverTask(next, stateRef.current.tasksDone + 1)
          saveProgress()
        }, 400)
      }
      return
    }

    // Special case: interview ulang setelah ditolak — percakapan HR direset bersih,
    // progress lain tidak tersentuh. Penolakan = momen belajar, bukan tembok.
    if (step === 98) {
      setState(prev => ({
        ...prev,
        interviewDone: false,
        chatHistory: {
          ...prev.chatHistory,
          hr_office: [{
            id: `sinta-retry-${Date.now()}`,
            role: 'npc' as const,
            npcId: 'sinta',
            text: `Hai lagi. Makasih udah mau balik dan coba lagi, itu poin plus buatku. Kita mulai dari awal ya. Coba ceritain singkat tentang dirimu.`
          }]
        }
      }))
      setView('hr_office')
      return
    }

    // Tombol aksi lama di riwayat chat (kartu "Buka offering letter", tombol tanda
    // tangan di email) masih bisa diklik setelah langkahnya lewat. Tanpa guard ini
    // klik ulang memundurkan step dan memutar ulang adegan: offer baru, Slack dobel.
    if (step <= stateRef.current.step) return

    setState(prev => ({ ...prev, step }))

    if (step === 2) {
      const pos = POSITIONS[state.position]
      const salRange = getSalaryRange(state.level || state.background)
      // Diterima bersyarat → default offer konservatif (batas bawah range)
      const conditional = isConditionalOffer(state.chatHistory)

         // Extract agreed salary, prioritas dari konfirmasi Sinta, bukan request user
      const hrMessages = state.chatHistory['hr_office'] || []
      let agreedSalary = conditional ? salRange.min : salRange.offer

      // Ambil angka gaji TERAKHIR di pesan: "range kami 4 sampai 6 juta, kita sepakat
      // 5,5 juta" harus menghasilkan 5,5 (dulu 6). Mendukung "5,5 juta", "5.5 jt",
      // "Rp 5.500.000" (dulu format rupiah penuh tidak terbaca → angka default).
      const extractJuta = (text: string): number | null => {
        const found: { at: number; val: number }[] = []
        for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/g)) {
          found.push({ at: m.index ?? 0, val: parseFloat(m[1].replace(',', '.')) * 1000000 })
        }
        for (const m of text.matchAll(/rp\s?(\d{1,3}(?:\.\d{3}){2,})/g)) {
          found.push({ at: m.index ?? 0, val: parseInt(m[1].replace(/\./g, ''), 10) })
        }
        const valid = found.filter(f => f.val >= 1000000 && f.val <= 15000000).sort((x, y) => x.at - y.at)
        return valid.length ? Math.round(valid[valid.length - 1].val) : null
      }

      let agreedFound = false

      // Prioritas 1: dari pesan Sinta yang konfirmasi/setuju angka
      const confirmKw = ['masuk', 'bisa diakomodir', 'sesuai budget', 'acceptable',
        'oke', 'deal', 'bisa kami', 'akan kami cantumkan', 'offering letter',
        'bisa diterima', 'kita setuju', 'sepakat', 'tercantum']
      for (const msg of [...hrMessages].reverse()) {
        if (msg.role === 'npc' && msg.npcId === 'sinta' && msg.text) {
          const text = msg.text.toLowerCase()
          if (confirmKw.some(kw => text.includes(kw))) {
            const val = extractJuta(text)
            if (val) { agreedSalary = val; agreedFound = true; break }
          }
        }
      }

      // Prioritas 2: Sinta sebut angka maksimal
      if (!agreedFound) {
        const maxKw = ['maksimal', 'maksimum', 'paling tinggi', 'sampai', 'bisa kami berikan']
        for (const msg of [...hrMessages].reverse()) {
          if (msg.role === 'npc' && msg.npcId === 'sinta' && msg.text) {
            const text = msg.text.toLowerCase()
            if (maxKw.some(kw => text.includes(kw))) {
              const val = extractJuta(text)
              if (val) { agreedSalary = val; agreedFound = true; break }
            }
          }
        }
      }

      // Prioritas 3: dari user HANYA kalau dalam range normal — angka di atas max
      // cuma sah kalau keluar dari mulut Sinta (prioritas 1/2), bukan klaim user
      if (!agreedFound) {
        for (const msg of [...hrMessages].reverse()) {
          if (msg.role === 'user' && msg.text) {
            const val = extractJuta(msg.text.toLowerCase())
            if (val && val >= salRange.min && val <= salRange.max) {
              agreedSalary = val; break
            }
          }
        }
      }

      // Clamp: kesepakatan di atas range SAH sampai batas stretch (+20% dari max) —
      // sesuai wewenang nego Sinta di prompt; offering letter memakai angka sepakat
      const stretchMax = Math.round(salRange.max * 1.2)
      const finalSalary = Math.min(Math.max(agreedSalary, salRange.min), stretchMax)

      // Add offering letter directly to state (avoid addMsg race condition)
      const offeringMsg = {
        id: `offering-${Date.now()}`,
        role: 'email' as const,
        data: {
          from: 'sinta@vantara.co.id',
          subject: `Offering Letter, ${state.bgRole}`,
          preview: 'Penawaran kerja untuk posisi yang kamu lamar.',
          isOffering: true,
          issuedAt: Date.now(),
          conditional,
          salary: finalSalary,
          position: state.bgRole,
          dept: pos?.dept,
          supervisor: pos?.supervisor.name,
          mealAllowance: 600000,
          transportAllowance: 400000,
          probation: '3 bulan dengan evaluasi',
          workSystem: 'Hybrid, WFO 3x/minggu',
        }
      }

      setState(prev => ({
        ...prev,
        step: 2,
        salaryOffered: finalSalary,
        chatHistory: {
          ...prev.chatHistory,
          inbox: [...(prev.chatHistory['inbox'] || []), offeringMsg]
        },
        unreadCounts: {
          ...prev.unreadCounts,
          inbox: (prev.unreadCounts['inbox'] || 0) + 1
        }
      }))

      setView('inbox')
      setTimeout(() => showNotif('inbox', 'Inbox', 'Offering letter dari Sinta sudah masuk'), 300)
    }

    if (step === 3) {
      setState(prev => ({ ...prev, step: 3, phaseUnlocked: 1 }))
      track('offer_signed', { position: state.position, level: state.level, salary: state.salaryOffered })
      const pos = POSITIONS[state.position]
      const channelName = channelOf(pos)

      setTimeout(() => {
        addMsg('slack', { role: 'system', text: `Kamu ditambahkan ke #${channelName}` }, true)
        setTimeout(() => {
          addMsg('slack', { role: 'npc', npcId: 'sinta', text: `Hai tim! Perkenalkan ${state.firstName}, ${state.bgRole} yang mulai hari ini. Disambut ya!` })
          showNotif('slack', 'Slack', `Sinta memperkenalkanmu ke tim di #${channelName}`)
          setTimeout(() => {
            // Diterima bersyarat → supervisor menyambut lebih dingin; kepercayaan harus direbut
            addMsg('slack', {
              role: 'npc', npcId: 'sup',
              text: isConditionalOffer(state.chatHistory)
                ? `Welcome ${state.firstName}. Saya ${pos?.supervisor.name}, supervisor langsungmu. Sinta cerita soal interviewmu, jadi aku to the point aja: di sini yang bicara hasil kerja. Buktikan ya. Nanti kita standup.`
                : `Welcome ${state.firstName}. Saya ${pos?.supervisor.name}, supervisor langsungmu. Santai dulu, kenalan sama tim. Nanti kita standup.`
            })
            setTimeout(() => {
              addMsg('slack', { role: 'npc', npcId: 'jnr', text: `Heyy welcome!! Saya ${pos?.junior.name}, udah di sini beberapa bulan lebih awal. Kalau butuh apa-apa DM aku ya, santai aja!` })
              // After 90 seconds OR after user sends 1 message in slack → supervisor DM
              // Trigger is handled by useEffect watching slackMessageCount
            }, 1500)
          }, 1200)
        }, 1000)
      }, 800)
      setView('slack')

      // Surat referensi mulai terlihat sejak diterima — aset yang dibangun, bukan janji di akhir
      setTimeout(() => {
        showNotif('reference', 'Surat Referensi', 'HR mulai menyusun surat referensimu')
        setState(prev => ({
          ...prev,
          unreadCounts: { ...prev.unreadCounts, reference: (prev.unreadCounts['reference'] || 0) + 1 }
        }))
      }, 9000)
    }

    if (step === 4) {
      setState(prev => ({ ...prev, step: 4 }))
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        // Supervisor explains company + position + SOP
        addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Oke, sebelum mulai kerja aku mau orientasi singkat dulu. PT Vantara Nusantara itu FMCG personal care, ada 3 brand: Lumière (skincare), Roots&Co (haircare), sama Vanta Glow (body care). Jualannya lewat tiga jalur: modern trade (minimarket, supermarket), general trade (toko kelontong, grosir), sama e-commerce.` })
        setTimeout(() => {
          addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Kamu masuk sebagai ${state.bgRole} di tim ${pos?.dept}. Sehari-hari kerjaanmu banyak di ${pos?.itx}. Lapornya langsung ke aku. Kalau ada yang menyangkut keputusan besar, baru kita bawa ke ${pos?.manager.name}.` })
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'learn',
              data: {
                title: 'Cara kerja tim ' + pos?.dept,
                body: 'Standup tiap jam 9 pagi. Task masuk lewat chat ini dan selalu ada tenggatnya. Hasil kerja dikumpulkan di Workspace, feedback-nya dikirim balik ke chat ini.',
              }
            })
            setTimeout(() => {
              addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Oh iya, aku udah assign training module buat kamu di Academy, ada di sidebar. Nggak wajib sekarang, tapi materinya persis bekal buat task pertamamu. Kalau nanti kejedot, balik ke situ. Misinya aku review langsung.` })
              addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Nah itu overview-nya. Sekarang standup dulu, hari ini rencananya gimana ${state.firstName}?` })
              addMsg('sup_chat', {
                role: 'learn',
                data: {
                  title: 'Format daily standup',
                  body: 'Biasanya tiga hal: apa yang dikerjakan kemarin, rencana hari ini, dan ada hambatan atau tidak. Karena ini hari pertama, cukup ceritakan rencanamu hari ini.',
                }
              })
              addMsg('sup_chat', { role: 'action', data: { label: 'Lihat training (opsional)', goTo: 'academy' } })
              showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Orientasi hari pertama')
            }, 1500)
          }, 1200)
        }, 1200)
      }, 800)
      setView('sup_chat')
    }

    if (step === 5) {
      // Task brief
      const pos = POSITIONS[state.position]
      setState(prev => ({ ...prev, step: 5 }))
      setTimeout(() => {
        addMsg('sup_chat', {
          role: 'task',
          data: {
            num: 1, title: pos?.taskTitle,
            deadline: 'Besok jam 09.00',
            dept: `Dept. ${pos?.dept}`,
            body: pos?.taskBody,
            ctx: pos?.taskContext,
          }
        })
        addMsg('sup_chat', { role: 'action', data: { label: 'Buka File Manager', nextStep: 6, goTo: 'file_manager' } })

        // Add file to file manager
        addMsg('file_manager', {
          role: 'system',
          text: `File task sudah tersedia: ${pos?.taskFile}`
        }, true)
        addMsg('file_manager', {
          role: 'task',
          data: {
            title: pos?.taskTitle,
            body: `Download file Excel di bawah ini, kerjakan, lalu upload hasilnya di Workspace.`,
            file: pos?.taskFile,
            isDownload: true,
          }
        }, true)

        showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', `Task baru: ${pos?.taskTitle}`)

        // Data Analyst dapat akses database internal + latihan SQL dari supervisor
        if (state.position === 'data_analyst') {
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'npc', npcId: 'sup',
              text: `Satu lagi. Kamu udah aku kasih akses read-only ke database penjualan internal, ada di sidebar namanya Database. Aku taruh beberapa latihan SQL kecil di situ, kerjain kalau sempat, kepake banget buat investigasi data.`
            })
            addMsg('sup_chat', { role: 'action', data: { label: 'Buka Database', goTo: 'database' } }, true)
          }, 5000)
        }
      }, 800)
    }

    if (step === 6) {
      // Jangan paksa pindah ke workspace, tombol "Buka File Manager" harus benar-benar
      // membawa user ke File Manager untuk download file task (navigasi via goTo)
      setState(prev => ({ ...prev, step: 6 }))
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `Psst ${state.firstName}, dari pengalaman aku, baca dulu semua data sebelum mulai. Kak ${pos?.supervisor.name.split(' ')[0]} lumayan strict soal detail hehe` })
        showNotif('jnr', POSITIONS[state.position]?.junior.name || 'Junior', 'Kirim pesan untukmu')
      }, 3000)

      // Dilema gaya kerja: pilihan user tercatat (chosenTrait) dan dibacakan di
      // penilaian akhir hari + surat referensi (lib/performance.ts)
      setTimeout(() => {
        addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `oh iya satu lagi. kalau nanti lo nemu yang aneh banget di datanya, menurut lo mending gimana: tulis semua apa adanya, atau yang aman-aman aja dulu? aku dulu bingung banget soal ini pas awal masuk wkwk` })
        addMsg('jnr', {
          role: 'choice',
          data: {
            options: [
              { label: 'Tulis semua apa adanya', trait: 'integritas', reaction: `nah, aku suka gaya lo. Kak ${pos?.supervisor.name.split(' ')[0]} emang keliatan strict, tapi dia paling respect sama orang yang jujur soal temuan. catet ya wkwk` },
              { label: 'Yang aman-aman aja dulu', trait: 'aman', reaction: `wkwk relate sih, aku dulu juga gitu. tapi jujur ya, justru pas aku nutup-nutupin sesuatu itu aku kena tegur paling parah. yaudah, good luck!` },
            ],
          },
        }, true)
      }, 8000)
    }
  }

  // Pilihan dilema: catat trait di message-nya, kirim jawaban user, lalu reaksi NPC.
  // Trait dibaca getWorkStyle() untuk penilaian akhir hari + surat referensi.
  const handleChoice = (room: string, msgId: string, idx: number) => {
    const msg = (state.chatHistory[room] || []).find(m => m.id === msgId)
    if (!msg || msg.role !== 'choice' || msg.data?.chosen !== undefined) return
    const options = (msg.data?.options || []) as { label: string; trait: string; reaction: string }[]
    const opt = options[idx]
    if (!opt) return

    setState(prev => ({
      ...prev,
      chatHistory: {
        ...prev.chatHistory,
        [room]: (prev.chatHistory[room] || []).map(m =>
          m.id === msgId ? { ...m, data: { ...m.data, chosen: idx, chosenTrait: opt.trait } } : m
        )
      }
    }))
    addMsg(room, { role: 'user', text: opt.label }, true)
    addCoins(5)
    setTimeout(() => {
      addMsg(room, { role: 'npc', npcId: ROOM_NPC[room] || 'jnr', text: opt.reaction }, viewRef.current === room)
    }, 1200)
  }

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    setWorkspaceError('')
    // File baru = review lama tidak berlaku lagi — tanpa ini tombol submit tertahan
    setReviewResult(null)
    if (!/\.xlsx$/i.test(file.name)) {
      setUploadedFile(null)
      setExtractedData('')
      setWorkspaceError('Format file harus .xlsx. Di Excel: File, Save As, pilih Excel Workbook (.xlsx).')
      return
    }
    try {
      // exceljs menggantikan xlsx (CVE tanpa patch di npm); parsing tetap di browser,
      // terhadap file milik user sendiri. Konsekuensi: hanya .xlsx (bukan .xls lama).
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())

      let extracted = `File: ${file.name}\n`
      extracted += `Sheets: ${wb.worksheets.map(ws => ws.name).join(', ')}\n\n`

      for (const ws of wb.worksheets) {
        extracted += `=== Sheet: ${ws.name} ===\n`
        // 50 baris pertama per sheet cukup untuk review (ringkasan user yang dinilai)
        const maxRows = Math.min(ws.rowCount, 50)
        for (let r = 1; r <= maxRows; r++) {
          const cells: string[] = []
          ws.getRow(r).eachCell({ includeEmpty: true }, cell => {
            cells.push(cell.value === null || cell.value === undefined ? '' : cell.text)
          })
          extracted += cells.join('\t') + '\n'
        }
        extracted += '\n'
      }

      setExtractedData(extracted)
    } catch (e) {
      console.error('Excel read error:', e)
      // Dulu teks error ini ikut dikirim ke supervisor AI dan dihitung revisi
      setUploadedFile(null)
      setExtractedData('')
      setWorkspaceError('File ini tidak bisa dibaca. Coba buka di Excel lalu simpan ulang sebagai .xlsx.')
    }
  }

  const handleSubmitTask = async () => {
    if (!extractedData) {
      setWorkspaceError('Upload file Excel hasil kerjamu dulu.')
      return
    }
    setWorkspaceError('')
    // Task yang sudah APPROVED tidak bisa disubmit ulang (dobel coin/tasksDone) sampai
    // pindah ke task berikutnya — reviewResult di-reset saat handoff/advance hari.
    if (reviewResult?.isApproved) return
    setIsSubmittingTask(true)
    try {
      // Day 1 task-1 = rubrik hardcoded (POSITIONS). Task pipeline (task-2 day-1, day 2+)
      // kirim slug supaya server memakai rubrik tabel tasks per level.
      const active = state.step >= 10 && state.tasksDone >= 1 ? seasonTasks[state.tasksDone - 1] : null
      const taskSlug = active && !active.locked ? active.slug : undefined
      const res = await authFetch('/api/review', {
        method: 'POST',
        body: JSON.stringify({
          positionId: state.position,
          userContext: {
            firstName: state.firstName,
            background: state.background,
            bgRole: state.bgRole,
            level: state.level,
            position: state.position,
          },
          submission: extractedData,
          taskSlug,
        })
      })
      const data = await res.json()
      if (!res.ok || !data?.review) {
        throw new Error(data?.error || 'Review gagal')
      }
      setReviewResult({ review: data.review, isApproved: data.isApproved })
      track('task_submitted', { position: state.position, approved: data.isApproved })

      // Add feedback to supervisor chat
      const pos = POSITIONS[state.position]
      addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: data.review })
      addMsg('sup_chat', {
        role: 'feedback',
        data: {
          type: data.isApproved ? 'good' : 'neutral',
          label: data.isApproved ? 'TASK APPROVED' : 'REVISION NEEDED',
          text: data.isApproved
            ? 'Sudah memenuhi standar tim. Task ini selesai.'
            : 'Perbaiki poin dari supervisor, lalu upload ulang file revisinya di Workspace.'
        }
      })

      showNotif('sup_chat', pos?.supervisor.name || 'Supervisor',
        data.isApproved ? 'Task kamu disetujui' : 'Task-mu perlu direvisi')

      // Stakes: supervisor makin dingin tiap revisi. Kegagalan tidak menghentikan
      // progress, tapi mengubah cerita — dan tercatat di penilaian + surat referensi.
      if (!data.isApproved) {
        const revCount = countRevisions(state.chatHistory) + 1 // + revisi yang baru saja terjadi
        track('task_revision', { position: state.position, revCount })
        if (revCount === 1 && !trainingDone) {
          // Just-in-time learning: Academy ditawarkan sebagai penyelamat, bukan gerbang
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'npc', npcId: 'sup',
              text: `Saranku: buka training module di Academy dulu, 10-15 menit aja. Materinya persis soal bagian yang tadi bolong. Abis itu baru revisi.`
            }, viewRef.current === 'sup_chat')
            addMsg('sup_chat', { role: 'action', data: { label: 'Buka Academy', goTo: 'academy' } }, true)
          }, 3000)
        }
        if (revCount >= 2) {
          const coldText = revCount === 2
            ? `Ini revisi kedua, ${state.firstName}. Standar tim memang segini. Pelan sedikit nggak apa-apa, yang penting teliti.`
            : `Oke, gini aja. Fokus ke poin yang paling penting dulu, satu-satu. Jangan submit sebelum kamu sendiri yakin.`
          setTimeout(() => {
            addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: coldText }, viewRef.current === 'sup_chat')
          }, 2500)
        }
      }

      if (data.isApproved) {
        addCoins(30)
        const newCoins = state.coins + 30
        const newTasksDone = state.tasksDone + 1
        setState(prev => ({ ...prev, tasksDone: newTasksDone, step: 10 }))

        // Update simulation experience in profile
        const pos = POSITIONS[state.position]
        if (pos) {
          const simExp: Experience = {
            id: 'kantoran-sim',
            company: 'PT Vantara Nusantara',
            position: state.bgRole,
            startMonth: new Date().toLocaleString('id-ID', { month: 'long' }),
            startYear: new Date().getFullYear().toString(),
            endMonth: new Date().toLocaleString('id-ID', { month: 'long' }),
            endYear: new Date().getFullYear().toString(),
            isCurrent: true,
            description: `Simulasi kerja ${state.bgRole} di PT Vantara Nusantara (Kantoran). Menyelesaikan ${newTasksDone} task termasuk analisis data, review dari supervisor AI.`,
            isSimulation: true,
          }
          // Save updated profile with sim experience
          if (user.id) {
            authFetch('/api/profile', {
              method: 'POST',
              body: JSON.stringify({
                profile: { ...profile, experience: [...(profile?.experience || []).filter(e => e.id !== 'kantoran-sim'), simExp] }
              })
            }).catch(console.error)
          }
        }

        // Task berikutnya di pipeline (task-2 day-1, lalu day 2+). Cursor = tasks_done.
        const next = seasonTasks[newTasksDone - 1]
        if (next && !next.locked && next.day === state.simDay) {
          // Masih hari yang sama (mis. task-2 day-1) → handoff ringan, langsung antar
          setTimeout(() => {
            addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Mantap ${state.firstName}, satu kelar. Mumpung masih on, ada satu lagi buat hari ini, nggak berat kok.` })
            setExtractedData(''); setUploadedFile(null); setReviewResult(null)
            deliverTask(next, newTasksDone + 1)
          }, 1500)
        } else {
          // Hari ini selesai → beat penutup + gerbang hari berikutnya
          finishDay(newCoins, newTasksDone, next)
        }
      }
    } catch (e) {
      console.error('Review error:', e)
      setWorkspaceError('Supervisor belum menerima filemu karena koneksi terputus. File masih ada, tekan kirim sekali lagi.')
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const pos = POSITIONS[state.position]

  // Loading screen
  if (progLoading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAFAF7' }}>
      <div style={{ textAlign:'center' }}>
        <div className="flex gap-2 justify-center mb-3">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
        </div>
        <p style={{ color:'#6B6A64', fontSize:13 }}>Memuat progress kamu...</p>
      </div>
    </div>
  )

  // If not loaded yet and we have initialPosition, auto-start
  // (user came from job listing, no need for internal onboarding)

  // Guard: if app not ready yet, show loading
  if (!showApp || !state.position) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAFAF7' }}>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        </div>
      </div>
    )
  }

  const channelName = channelOf(pos)
  const interviewRejected = (state.chatHistory['hr_office'] || []).some(m => m.role === 'action' && m.data?.type === 'interview_rejected')
  // Supervisor, manager, dan rekan sudah ada di daftar Tim, jadi tidak diulang di sini.
  // Ruang "Meeting" dihapus: tidak pernah berisi apa pun (temuan QA Okt 2026).
  const rooms: { id: string; Icon: typeof Mail; label: string; locked: boolean }[] = [
    { id: 'inbox', Icon: Mail, label: 'Inbox', locked: false },
    { id: 'hr_office', Icon: Handshake, label: 'HR Office', locked: false },
    { id: 'slack', Icon: MessagesSquare, label: `#${channelName}`, locked: state.phaseUnlocked < 1 },
    { id: 'file_manager', Icon: Folder, label: 'File Manager', locked: state.step < 5 },
    { id: 'workspace', Icon: Monitor, label: 'Workspace', locked: state.phaseUnlocked < 1 },
    // Database Vantara: SQL editor in-story, khusus Data Analyst
    ...(state.position === 'data_analyst'
      ? [{ id: 'database', Icon: Database, label: 'Database', locked: state.step < 5 }]
      : []),
    // Academy juga terbuka saat interview DITOLAK — modul "Cara Menjawab Interview" jalan kembalinya
    { id: 'academy', Icon: GraduationCap, label: 'Academy', locked: state.step < 4 && !interviewRejected },
    { id: 'reference', Icon: ScrollText, label: 'Surat Referensi', locked: state.phaseUnlocked < 1 },
    { id: 'pantry', Icon: Coffee, label: 'Pantry', locked: state.phaseUnlocked < 1 },
  ]

  const canChat = ['hr_office', 'sup_chat', 'mgr_chat', 'pantry', 'slack', 'jnr'].includes(view)
  const offerSalary = getOfferSalary(state.chatHistory)

  // Task yang sedang terbuka. Task-1 hari-1 dari POSITIONS; sesudahnya dari pipeline
  // seasonTasks (cursor = tasksDone). Dulu Workspace menutup upload di step 10, padahal
  // task ke-2 hari yang sama baru diantar di step 10 → tidak bisa dikumpulkan.
  const activeSeasonTask = state.step >= 10 && state.tasksDone >= 1 ? seasonTasks[state.tasksDone - 1] : null
  const taskOpen = state.step >= 5 && (
    state.step < 10 || (!!activeSeasonTask && !activeSeasonTask.locked && activeSeasonTask.day <= state.simDay)
  )
  const activeTaskTitle = state.step >= 10 && activeSeasonTask && !activeSeasonTask.locked
    ? activeSeasonTask.title : (pos?.taskTitle || '')

  const inputPlaceholder =
    view === 'hr_office' ? 'Balas Sinta' :
    view === 'slack' ? 'Sapa tim, misalnya perkenalkan diri singkat' :
    view === 'sup_chat' ? `Tulis ke ${callName(pos?.supervisor.name)}` :
    view === 'mgr_chat' ? `Tulis ke ${callName(pos?.manager.name)}` :
    view === 'jnr' ? `Tulis ke ${callName(pos?.junior.name)}` :
    view === 'pantry' ? 'Ngobrol santai' : 'Tulis pesan'

  return (
    <div
      className="h-dvh flex flex-col bg-white overflow-hidden"
      style={viewportH ? { height: `${viewportH}px` } : undefined}
    >

      {/* Notifikasi: klik = pindah ke ruangan asal pesan */}
      {notification && (
        <button
          type="button"
          className="w-full bg-[#0F6E56] text-white text-sm px-4 py-2.5 flex items-center justify-between gap-3 animate-fadeUp text-left"
          style={{ cursor: 'pointer' }}
          onClick={() => { setView(notification.room); setNotification(null) }}
        >
          <span className="min-w-0 truncate">
            <span className="font-medium">{notification.roomLabel}</span>
            <span className="text-white/85"> · {notification.text}</span>
          </span>
          <span className="text-white/85 text-[13px] flex-shrink-0 underline underline-offset-2">Buka</span>
        </button>
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between px-2 sm:px-4 h-[52px] border-b border-[#E5E3DC] bg-white flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Buka menu"
            style={{ cursor: 'pointer' }}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-md text-[#1A1A18] hover:bg-[#F1EFE8] flex-shrink-0"
          >
            <Menu size={20} aria-hidden />
          </button>
          <span className="text-[15px] font-semibold text-[#0F6E56] flex-shrink-0">Kantoran</span>
          <span className="hidden sm:inline text-[13px] text-[#6B6A64] truncate">
            · {state.bgRole}{state.step >= 3 ? `, hari ke-${state.simDay}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <div data-tour="coins" title="Coin" className="flex items-center gap-1.5 text-[13px] font-medium text-[#854F0B] bg-[#FAEEDA]/70 px-2 py-1 rounded-md mr-1 tabular">
            <Coins size={14} aria-hidden />{state.coins}<span className="sr-only"> coin</span>
          </div>
          {onExit && (
            <button onClick={handleExit} style={{ cursor: 'pointer' }} title="Kembali ke daftar lowongan. Progress tersimpan." aria-label="Lowongan"
              className="flex items-center gap-1.5 text-[13px] text-[#4A4A45] hover:text-[#1A1A18] hover:bg-[#F1EFE8] px-2 py-1.5 rounded-md">
              <Briefcase size={15} aria-hidden /><span className="hidden lg:inline">Lowongan</span>
            </button>
          )}
          <button onClick={handleRestart} style={{ cursor: 'pointer' }} title="Ulangi posisi ini dari awal" aria-label="Ulangi posisi ini"
            className="flex items-center gap-1.5 text-[13px] text-[#4A4A45] hover:text-[#1A1A18] hover:bg-[#F1EFE8] px-2 py-1.5 rounded-md">
            <RotateCcw size={15} aria-hidden /><span className="hidden lg:inline">Ulangi</span>
          </button>
          <button onClick={handleLogout} style={{ cursor: 'pointer' }} title="Keluar akun" aria-label="Keluar akun"
            className="flex items-center gap-1.5 text-[13px] text-[#4A4A45] hover:text-[#1A1A18] hover:bg-[#F1EFE8] px-2 py-1.5 rounded-md">
            <LogOut size={15} aria-hidden /><span className="hidden lg:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Progres hari pertama */}
      <div className="h-[3px] bg-[#EEECE6] flex-shrink-0" role="progressbar" aria-label="Progres hari pertama"
        aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(state.step, 10)}>
        <div className="h-full bg-[#0F6E56] transition-all duration-500" style={{ width: `${Math.max(3, Math.min(state.step, 10) * 10)}%` }} />
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0 relative">

        {/* Backdrop drawer, mobile only */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            aria-hidden
          />
        )}

        {/* Sidebar, drawer di mobile, statis di desktop */}
        <div className={`bg-white border-r border-[#E5E3DC] flex flex-col flex-shrink-0 overflow-hidden
          fixed md:static top-0 bottom-0 left-0 z-40 w-[260px] md:w-[210px]
          transition-transform duration-200 md:!translate-x-0
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
          <div data-tour="team" className="p-3 pb-2 border-b border-[#E5E3DC] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-[#6B6A64] px-2">Tim</p>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-[#6B6A64] hover:bg-[#F1EFE8]" aria-label="Tutup menu" style={{ cursor: 'pointer' }}><X size={16} aria-hidden /></button>
            </div>

            {/* Sinta */}
            <SidebarNPC
              initials="SM" avClass="av-teal" name="Sinta Maharani"
              role="HR Business Partner" statusDot="bg-green-500"
              active={view === 'hr_office'} locked={false}
              unread={state.unreadCounts['hr_office'] || 0}
              onClick={() => setView('hr_office')}
            />

            {pos && (
              <>
                <SidebarNPC
                  initials={NPC_INITIALS[state.position]?.sup || '??'}
                  avClass={pos.supervisor.avClass}
                  name={pos.supervisor.name}
                  role={pos.supervisor.role.split('·')[0].trim()}
                  statusDot={pos.supervisor.statusDot}
                  active={view === 'sup_chat'}
                  locked={state.phaseUnlocked < 1}
                  unread={state.unreadCounts['sup_chat'] || 0}
                  onClick={() => !( state.phaseUnlocked < 1) && setView('sup_chat')}
                />
                <SidebarNPC
                  initials={NPC_INITIALS[state.position]?.mgr || '??'}
                  avClass={pos.manager.avClass}
                  name={pos.manager.name}
                  role={pos.manager.role}
                  statusDot={pos.manager.statusDot}
                  active={view === 'mgr_chat'}
                  locked={state.phaseUnlocked < 1}
                  unread={state.unreadCounts['mgr_chat'] || 0}
                  onClick={() => !(state.phaseUnlocked < 1) && setView('mgr_chat')}
                />
                <SidebarNPC
                  initials={NPC_INITIALS[state.position]?.jnr || '??'}
                  avClass={pos.junior.avClass}
                  name={pos.junior.name}
                  role={pos.junior.role.split('·')[0].trim()}
                  statusDot={pos.junior.statusDot}
                  active={view === 'jnr'}
                  locked={state.phaseUnlocked < 1}
                  unread={state.unreadCounts['jnr'] || 0}
                  onClick={() => !(state.phaseUnlocked < 1) && setView('jnr')}
                />
              </>
            )}
          </div>

          {/* Rooms */}
          <div className="flex-1 overflow-y-auto p-3 pt-2">
            <p className="text-[12px] font-medium text-[#6B6A64] mb-1.5 px-2">Ruangan</p>
            <div data-tour="rooms" className="flex flex-col gap-px">
              {rooms.map(({ id, Icon, label, locked }) => {
                const unread = state.unreadCounts[id] || 0
                const active = view === id
                return (
                  <button
                    key={id}
                    onClick={() => !locked && setView(id)}
                    aria-disabled={locked}
                    aria-current={active ? 'page' : undefined}
                    title={locked ? 'Belum terbuka' : undefined}
                    style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                      locked ? 'text-[#A3A19A]' : active ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium' : 'text-[#3A3A36] hover:bg-[#F4F3EF]'
                    }`}
                  >
                    <Icon size={15} aria-hidden className="flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {locked && <Lock size={12} aria-hidden className="flex-shrink-0" />}
                    {!locked && unread > 0 && (
                      <span className="bg-[#C2410C] text-white text-[11px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-medium tabular">
                        {unread}<span className="sr-only"> pesan belum dibaca</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-[#E5E3DC]">
              <button
                onClick={() => setShowProfile(p => !p)}
                style={{ cursor: 'pointer' }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-md transition-colors text-left ${showProfile ? 'bg-[#E1F5EE]' : 'hover:bg-[#F4F3EF]'}`}
              >
                <div className="w-8 h-8 rounded-full av-teal flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#1A1A18] truncate">{profile?.full_name || 'Profil saya'}</p>
                  <p className="text-[12px] text-[#6B6A64]">Profil dan CV</p>
                </div>
              </button>
            </div>

            <dl className="mt-3 pt-3 border-t border-[#E5E3DC] px-2 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
              <div>
                <dt className="text-[12px] text-[#6B6A64]">Hari ke</dt>
                <dd className="font-medium text-[#1A1A18] tabular">{state.step >= 3 ? state.simDay : '-'}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[#6B6A64]">Task selesai</dt>
                <dd className="font-medium text-[#1A1A18] tabular">{state.tasksDone}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[12px] text-[#6B6A64]">Gaji hasil nego</dt>
                <dd className="font-medium text-[#1A1A18] tabular">{offerSalary ? `Rp ${offerSalary.toLocaleString('id-ID')}` : 'Belum ada'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Profile panel, full screen di mobile, panel samping di desktop */}
        {showProfile && (
          <>
            <div onClick={() => setShowProfile(false)} className="fixed inset-0 bg-black/40 z-40 md:hidden" aria-hidden />
            <div className="bg-white border-r border-[#E5E3DC] flex flex-col overflow-hidden
              fixed md:static inset-0 md:inset-auto z-50 md:z-auto w-full md:w-[280px] flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E3DC] flex-shrink-0">
              <p className="text-sm font-semibold text-[#111111]">Profil Saya</p>
              <button onClick={() => setShowProfile(false)} style={{ cursor: 'pointer' }} className="text-[13px] text-[#4A4A45] hover:text-[#1A1A18]">Tutup</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ProfileTab
                user={user}
                profile={profile || { full_name: '', gender: '', city: '', education: [], experience: [], skills: [] }}
                onUpdate={(p) => setProfile(p)}
                simulationExperience={state.tasksDone > 0 && pos ? {
                  id: 'kantoran-sim',
                  company: 'PT Vantara Nusantara',
                  position: state.bgRole,
                  startMonth: new Date().toLocaleString('id-ID', { month: 'long' }),
                  startYear: new Date().getFullYear().toString(),
                  endMonth: new Date().toLocaleString('id-ID', { month: 'long' }),
                  endYear: new Date().getFullYear().toString(),
                  isCurrent: true,
                  description: `Simulasi kerja di PT Vantara Nusantara via Kantoran. Menyelesaikan ${state.tasksDone} task.`,
                  isSimulation: true,
                } : undefined}
              />
            </div>
            </div>
          </>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <ChatHeader
            view={view}
            state={state}
            pos={pos}
            onOfferingClick={() => {
              // Tombol pintas TIDAK boleh melewati nego gaji — tanpa guard ini,
              // offering letter keluar dengan angka default tanpa pernah dibahas
              const hrMsgs = state.chatHistory['hr_office'] || []
              const salaryDiscussed = hrMsgs.some(m =>
                !m.isError && (m.role === 'user' || m.role === 'npc') &&
                m.text && /gaji|juta|salary/i.test(m.text)
              )
              if (!salaryDiscussed) {
                addMsg('hr_office', {
                  role: 'npc', npcId: 'sinta',
                  text: `Eh sebentar, sebelum kita tutup ada satu hal penting yang belum dibahas: ekspektasi gaji kamu untuk posisi ini berapa?`
                }, true)
                return
              }
              setState(prev => ({ ...prev, interviewDone: true }))
              handleNextStep(2)
            }}
          />

          {/* Inbox view, rendered outside the scroll container so it controls its own layout */}
          {view === 'inbox' && (
            <InboxView
              messages={state.chatHistory['inbox'] || []}
              onNextStep={handleNextStep}
              onViewChange={setView}
              state={state}
              pos={pos}
            />
          )}

          {/* Messages / Content */}
          {view !== 'inbox' && (
            <div ref={msgsRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

              {/* Academy — training module per posisi (story + misi) */}
              {view === 'academy' && pos && (
                <AcademyPanel
                  positionId={state.position}
                  userContext={{
                    firstName: state.firstName,
                    email: state.email || user.email || '',
                    background: state.background,
                    bgRole: state.bgRole,
                    level: state.level,
                    position: state.position,
                    experience: state.experience,
                    motivation: state.motivation,
                    step: state.step,
                  }}
                  supervisorName={pos.supervisor.name}
                  supervisorInitials={NPC_INITIALS[state.position]?.sup || '??'}
                  supervisorAvClass={pos.supervisor.avClass}
                  onXP={addCoins}
                  onProgress={evalTraining}
                />
              )}

              {/* Database Vantara: SQL editor in-browser, khusus Data Analyst */}
              {view === 'database' && state.position === 'data_analyst' && (
                <SqlEditor userId={user.id} onCoins={addCoins} />
              )}

              {/* Surat referensi: aset yang terlihat sejak hari pertama, terisi mengikuti progress */}
              {view === 'reference' && (
                <ReferenceLetter
                  firstName={state.firstName}
                  bgRole={state.bgRole}
                  step={state.step}
                  tasksDone={state.tasksDone}
                  trainingDone={trainingDone}
                  history={state.chatHistory}
                  pos={pos}
                />
              )}

              {/* Workspace special view */}
              {view === 'workspace' && (
                <WorkspaceView
                  state={state}
                  pos={pos}
                  taskOpen={taskOpen}
                  taskTitle={activeTaskTitle}
                  uploadedFile={uploadedFile}
                  extractedData={extractedData}
                  reviewResult={reviewResult}
                  isSubmitting={isSubmittingTask}
                  error={workspaceError}
                  onFileUpload={handleFileUpload}
                  onSubmit={handleSubmitTask}
                  onClearUpload={() => {
                    // WAJIB ikut membersihkan reviewResult — tombol submit hanya muncul
                    // saat !reviewResult; tanpa ini upload ulang setelah revisi tidak
                    // pernah bisa disubmit (bug temuan founder 14 Juli 2026)
                    setUploadedFile(null)
                    setExtractedData('')
                    setReviewResult(null)
                    setWorkspaceError('')
                  }}
                />
              )}

              {/* Regular messages */}
              {view !== 'workspace' && view !== 'academy' && view !== 'reference' && view !== 'database' && (state.chatHistory[view] || []).map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  state={state}
                  pos={pos}
                  onNextStep={handleNextStep}
                  onViewChange={setView}
                  onRetry={() => handleRetry(view)}
                  retryDisabled={loading}
                  onChoice={(i) => handleChoice(view, msg.id, i)}
                />
              ))}

              {/* File Manager: file task mendatang, terlihat tapi terkunci */}
              {view === 'file_manager' && state.step >= 5 && state.simDay === 1 && (pos?.upcomingTasks.length || 0) > 0 && (
                <div className="max-w-[560px] border border-dashed border-[#D8D6CE] rounded-lg p-3.5 select-none">
                  <p className="text-[13px] font-medium text-[#4A4A45] mb-1.5">Masuk minggu ini</p>
                  {pos!.upcomingTasks.map(t => (
                    <div key={t.day} className="flex items-center gap-2 py-1.5 text-[#6B6A64]">
                      <Lock size={13} aria-hidden className="flex-shrink-0" />
                      <p className="text-[13px] truncate"><span className="font-mono text-[12px]">task_hari{t.day}.xlsx</span> · {t.title}</p>
                    </div>
                  ))}
                  <p className="text-[12px] text-[#6B6A64] mt-1.5">Terbuka setelah hari kedua dirilis.</p>
                </div>
              )}

              {/* Empty state */}
              {view !== 'workspace' && view !== 'academy' && view !== 'reference' && view !== 'database' && (state.chatHistory[view] || []).length === 0 && (
                <EmptyRoom view={view} state={state} />
              )}

              {/* Typing indicator */}
              {loading && canChat && (
                <div className="flex gap-2 animate-messageIn">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${view === 'hr_office' ? 'av-teal' : view === 'sup_chat' ? 'av-blue' : view === 'mgr_chat' ? 'av-purple' : 'av-amber'}`}>
                    {view === 'hr_office' ? 'SM' : NPC_INITIALS[state.position]?.[view === 'sup_chat' ? 'sup' : view === 'mgr_chat' ? 'mgr' : 'jnr'] || '?'}
                  </div>
                  <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          {canChat && (
            <div className="border-t border-[#E5E3DC] bg-white px-3 pt-3 pb-3 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder={inputPlaceholder}
                  aria-label={inputPlaceholder}
                  rows={1}
                  style={{ cursor: 'text' }}
                  autoComplete="off"
                  autoFocus
                  className="flex-1 resize-none px-3 py-2.5 border border-[#D8D6CE] rounded-lg text-sm text-[#1A1A18] bg-white outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 disabled:bg-[#F7F6F2] transition-colors min-h-[42px] max-h-[140px]"
                />
                <button
                  onClick={() => { handleSend(); focusInput() }}
                  disabled={loading || !input.trim()}
                  aria-label="Kirim"
                  style={{ cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}
                  className="w-[42px] h-[42px] rounded-lg bg-[#0F6E56] text-white flex items-center justify-center hover:bg-[#085041] disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  <SendHorizontal size={18} aria-hidden />
                </button>
              </div>
              <p className="hidden md:block text-[12px] text-[#6B6A64] mt-1.5 ml-1">
                {loading ? 'Sedang mengetik balasan...' : 'Enter untuk kirim, Shift + Enter untuk baris baru'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tur pengenalan UI, sekali saja saat pertama masuk */}
      {showTour && (
        <GuidedTour steps={TOUR_STEPS} onDone={finishTour} onStepChange={handleTourStep} />
      )}
    </div>
  )
}

// ── SUB COMPONENTS ────────────────────────────────

function SidebarNPC({ initials, avClass, name, role, statusDot, active, locked, unread, onClick }: {
  initials: string; avClass: string; name: string; role: string;
  statusDot: string; active: boolean; locked: boolean; unread: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-disabled={locked}
      title={locked ? 'Terbuka setelah kamu tanda tangan kontrak' : undefined}
      style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
        locked ? 'opacity-50' : active ? 'bg-[#E1F5EE]' : 'hover:bg-[#F4F3EF]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold ${avClass}`}>
          {initials}
        </div>
        {!locked && <div className={`absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full ${statusDot} border-2 border-white`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#1A1A18] truncate">{name}</p>
        <p className="text-[12px] text-[#6B6A64] truncate">{role}</p>
      </div>
      {locked && <Lock size={12} aria-hidden className="text-[#A3A19A] flex-shrink-0" />}
      {!locked && unread > 0 && (
        <span className="bg-[#C2410C] text-white text-[11px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-medium flex-shrink-0 tabular">
          {unread}<span className="sr-only"> pesan belum dibaca</span>
        </span>
      )}
    </button>
  )
}

function ChatHeader({ view, state, pos, onOfferingClick }: { view: string; state: SimState; pos?: typeof POSITIONS[string]; onOfferingClick?: () => void }) {
  const npc: Record<string, { initials: string; avClass: string; name: string; status: string }> = {
    hr_office: {
      initials: 'SM', avClass: 'av-teal', name: 'Sinta Maharani',
      status: state.step < 2 && !state.interviewDone ? `Interview ${pos?.title || ''} · sekitar 15 menit` : 'HR Business Partner',
    },
    sup_chat: { initials: NPC_INITIALS[state.position]?.sup || '??', avClass: pos?.supervisor.avClass || 'av-blue', name: pos?.supervisor.name || 'Supervisor', status: `${pos?.supervisor.status || ''} · Supervisormu` },
    mgr_chat: { initials: NPC_INITIALS[state.position]?.mgr || '??', avClass: pos?.manager.avClass || 'av-purple', name: pos?.manager.name || 'Manager', status: `${pos?.manager.status || ''} · ${pos?.manager.role || ''}` },
    jnr: { initials: NPC_INITIALS[state.position]?.jnr || '??', avClass: pos?.junior.avClass || 'av-amber', name: pos?.junior.name || 'Junior', status: `${pos?.junior.status || ''} · Rekan satu tim` },
  }
  const rooms: Record<string, { Icon: typeof Mail; name: string; status: string }> = {
    inbox: { Icon: Mail, name: 'Inbox', status: 'Email dari HR dan kantor' },
    slack: { Icon: MessagesSquare, name: `#${channelOf(pos)}`, status: 'Channel tim' },
    workspace: { Icon: Monitor, name: 'Workspace', status: 'Kumpulkan hasil kerja untuk direview supervisor' },
    academy: { Icon: GraduationCap, name: 'Vantara Academy', status: 'Training dari supervisormu, tidak wajib' },
    file_manager: { Icon: Folder, name: 'File Manager', status: 'File task dan dokumen kerja' },
    reference: { Icon: ScrollText, name: 'Surat Referensi', status: 'Terisi seiring kerjamu di Vantara' },
    database: { Icon: Database, name: 'Database Vantara', status: 'Akses baca saja · SQL editor' },
    pantry: { Icon: Coffee, name: 'Pantry', status: `Ngobrol santai dengan ${callName(pos?.junior.name)}` },
  }

  // Jalan pintas ke offering HANYA kalau interview sudah panjang tapi Sinta belum
  // menutup (model kadang lupa token). Dulu tombol ini tampil sejak pesan pertama dan
  // bisa dipakai melompati interview cukup dengan menyebut kata "gaji".
  const hrMsgs = state.chatHistory['hr_office'] || []
  const answered = hrMsgs.filter(m => m.role === 'user').length
  const rejected = hrMsgs.some(m => m.role === 'action' && m.data?.type === 'interview_rejected')
  const showSkip = view === 'hr_office' && !state.interviewDone && state.step < 2 && !rejected && answered >= 10 && !!onOfferingClick

  const h = npc[view]
  const r = rooms[view] || rooms.inbox
  return (
    <div className="flex items-center gap-3 px-4 h-[56px] border-b border-[#E5E3DC] bg-white flex-shrink-0">
      {h ? (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${h.avClass}`}>{h.initials}</div>
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#F1EFE8] text-[#4A4A45] flex items-center justify-center flex-shrink-0"><r.Icon size={17} aria-hidden /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1A18] truncate">{h ? h.name : r.name}</p>
        <p className="text-[12px] text-[#6B6A64] truncate">{h ? h.status : r.status}</p>
      </div>
      {showSkip && (
        <button
          onClick={onOfferingClick}
          style={{ cursor: 'pointer' }}
          title="Pakai kalau gaji sudah dibahas tapi Sinta belum menutup interview"
          className="text-[13px] font-medium text-[#0F6E56] border border-[#0F6E56]/40 hover:bg-[#E1F5EE] px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
        >
          Lanjut ke offering
        </button>
      )}
    </div>
  )
}

function EmptyRoom({ view, state }: { view: string; state: SimState }) {
  const hints: Record<string, string> = {
    inbox: 'Belum ada email.',
    hr_office: 'Sinta akan menyapamu di sini.',
    pantry: 'Belum ada obrolan. Mampir dan sapa rekan timmu.',
    slack: 'Channel tim aktif setelah kamu tanda tangan kontrak.',
    sup_chat: state.step >= 3 ? 'Supervisormu akan mengirim pesan sebentar lagi.' : 'Terbuka setelah kamu tanda tangan kontrak.',
    mgr_chat: 'Manager jarang chat duluan. Tidak apa-apa, itu normal.',
    jnr: 'Belum ada obrolan.',
    file_manager: 'File task muncul di sini setelah supervisor memberi task.',
  }
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <p className="text-sm text-[#6B6A64] max-w-xs text-center">{hints[view] || 'Belum ada percakapan.'}</p>
    </div>
  )
}

function MessageBubble({ msg, state, pos, onNextStep, onViewChange, onRetry, retryDisabled, onChoice }: {
  msg: Message; state: SimState; pos?: typeof POSITIONS[string];
  onNextStep: (step: number, data?: Record<string, unknown>) => void;
  onViewChange: (view: string) => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
  onChoice?: (idx: number) => void;
}) {
  const getNPCInitials = (npcId?: string) => {
    if (npcId === 'sinta') return 'SM'
    return NPC_INITIALS[state.position]?.[npcId || ''] || '?'
  }
  const getNPCAvClass = (npcId?: string) => {
    if (npcId === 'sinta') return 'av-teal'
    if (!pos) return 'av-teal'
    if (npcId === 'sup') return pos.supervisor.avClass
    if (npcId === 'mgr') return pos.manager.avClass
    if (npcId === 'jnr') return pos.junior.avClass
    return 'av-teal'
  }
  const getNPCName = (npcId?: string) => {
    if (npcId === 'sinta') return 'Sinta Maharani'
    if (!pos) return 'NPC'
    if (npcId === 'sup') return pos.supervisor.name
    if (npcId === 'mgr') return pos.manager.name
    if (npcId === 'jnr') return pos.junior.name
    return 'NPC'
  }

  // Banner gangguan koneksi + retry — dicek sebelum role supaya tidak
  // pernah dirender sebagai bubble NPC/pill system biasa
  if (msg.isError) return (
    <div className="flex justify-center animate-messageIn">
      <div className="bg-[#FDF2F0] border border-[#C2410C]/20 rounded-xl px-4 py-2.5 text-center max-w-[85%]">
        <p className="text-xs text-[#9A3412] leading-relaxed mb-2">{msg.text}</p>
        <button
          onClick={onRetry}
          disabled={retryDisabled}
          style={{ cursor: retryDisabled ? 'default' : 'pointer' }}
          className="text-xs font-semibold text-[#0F6E56] border border-[#0F6E56]/30 rounded-full px-3 py-1 hover:bg-[#E1F5EE] disabled:opacity-50"
        >
          Kirim ulang
        </button>
      </div>
    </div>
  )

  if (msg.role === 'user') return (
    <div className="flex justify-end animate-messageIn">
      <div className="max-w-[80%] bg-[#0F6E56] text-white rounded-[8px_0_8px_8px] px-3 py-2.5 text-sm leading-relaxed">
        {msg.text}
      </div>
    </div>
  )

  if (msg.role === 'npc') return (
    <div className="flex gap-2 animate-messageIn">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 mt-0.5 ${getNPCAvClass(msg.npcId)}`}>
        {getNPCInitials(msg.npcId)}
      </div>
      <div className="max-w-[80%]">
        <p className="text-[11px] font-semibold text-[#6B6A64] mb-1">{getNPCName(msg.npcId)}</p>
        <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm leading-relaxed text-[#111111]">
          {msg.text}
        </div>
      </div>
    </div>
  )

  if (msg.role === 'system') return (
    <div className="flex justify-center animate-messageIn">
      <span className="bg-[#F1EFE8] rounded-full px-3 py-1 text-xs text-[#6B6A64]">{msg.text}</span>
    </div>
  )

  // Dilema pilihan: sekali dijawab jadi inert, pilihan yang diambil tetap tersorot
  if (msg.role === 'choice') {
    const d = msg.data || {}
    const options = (d.options || []) as { label: string }[]
    const chosen = d.chosen as number | undefined
    return (
      <div className="ml-10 flex flex-col gap-1.5 animate-messageIn max-w-[80%]">
        {options.map((o, i) => (
          <button
            key={i}
            disabled={chosen !== undefined}
            onClick={() => onChoice?.(i)}
            style={{ cursor: chosen === undefined ? 'pointer' : 'default' }}
            className={`text-left text-sm px-3.5 py-2.5 rounded-xl border transition-all ${
              chosen === i
                ? 'border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56] font-medium'
                : chosen !== undefined
                  ? 'border-[#E5E3DC] text-[#6B6A64] opacity-50'
                  : 'border-[#0F6E56]/30 bg-white text-[#111111] hover:bg-[#E1F5EE]'
            }`}
          >
            {o.label}
          </button>
        ))}
        {chosen === undefined && (
          <p className="text-[11px] text-[#6B6A64]">Pilihanmu ikut membentuk penilaian gaya kerjamu.</p>
        )}
      </div>
    )
  }

  if (msg.role === 'learn') {
    const d = msg.data || {}
    return (
      <div className="max-w-[560px] border-l-2 border-[#0F6E56] bg-[#F4F8F6] rounded-r-lg px-3.5 py-2.5 animate-messageIn">
        <p className="text-[13px] font-semibold text-[#0F6E56] mb-0.5">{String(d.title ?? '')}</p>
        <p className="text-[13px] leading-relaxed text-[#2E3B36]">{String(d.body ?? '')}</p>
      </div>
    )
  }

  if (msg.role === 'feedback') {
    const d = msg.data || {}
    const good = d.type === 'good'
    return (
      <div className={`max-w-[560px] rounded-lg px-3.5 py-2.5 border animate-messageIn ${good ? 'bg-[#EEF8F1] border-[#166534]/20 text-[#166534]' : 'bg-[#FDF6EA] border-[#854F0B]/20 text-[#7A4708]'}`}>
        {/* data.label tetap "TASK APPROVED"/"REVISION NEEDED" — dibaca countRevisions() */}
        <p className="text-[13px] font-semibold">{good ? 'Task disetujui' : 'Perlu revisi'}</p>
        <p className="text-[13px] leading-relaxed mt-0.5">{String(d.text ?? '')}</p>
      </div>
    )
  }

  if (msg.role === 'action') {
    const d = msg.data || {}
    const isInterviewDone = d.type === 'interview_done'
    const isDayDone = d.type === 'day_done'
    const ns = d.nextStep !== undefined ? Number(d.nextStep) : undefined
    // Langkah yang sudah lewat: tombol tetap ada untuk navigasi, tapi tidak memicu
    // adegan ulang (guard juga ada di handleNextStep)
    const stale = ns !== undefined && ns < 90 && ns <= state.step

    if (isDayDone) {
      // Penilaian hari ini: grade dari jumlah revisi + gaya kerja dari pilihan dilema
      const grade = computeGrade(countRevisions(state.chatHistory))
      const workStyle = getWorkStyle(state.chatHistory)
      const canAdvance = ns === 97
      const upcoming = canAdvance ? [] : (pos?.upcomingTasks || [])
      return (
        <div className="max-w-[560px] animate-messageIn border border-[#E5E3DC] bg-white rounded-xl p-4 sm:p-5">
          <p className="text-[15px] font-semibold text-[#1A1A18]">Hari ke-{state.simDay} selesai</p>
          <p className="text-[13px] text-[#4A4A45] mt-1 leading-relaxed">
            {state.simDay === 1
              ? 'Interview, nego gaji, kontrak, sampai task pertama disetujui. Semuanya tercatat di surat referensimu.'
              : 'Task hari ini disetujui dan tercatat di surat referensimu.'}
          </p>
          <div className="mt-4 rounded-lg bg-[#F7F6F2] px-3.5 py-3">
            <p className="text-[13px] font-semibold text-[#1A1A18]">Penilaian supervisor: {GRADE_LABEL[grade]}</p>
            <p className="text-[13px] text-[#4A4A45] leading-relaxed mt-1">
              {GRADE_REVIEW[grade]}
              {workStyle ? ` Gaya kerjamu: ${workStyle.label.toLowerCase()}. ${workStyle.review}` : ''}
            </p>
          </div>
          {upcoming.length > 0 && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold text-[#1A1A18] mb-1">Berikutnya di minggu ini</p>
              <ul>
                {upcoming.map(t => (
                  <li key={t.day} className="flex gap-2.5 py-2 border-b border-[#F1EFE8] last:border-0">
                    <Lock size={13} aria-hidden className="mt-1 text-[#A3A19A] flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-[#4A4A45]">Hari {t.day}: {t.title}</p>
                      <p className="text-[12px] text-[#6B6A64] leading-relaxed">{t.teaser}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => { if (ns !== undefined) onNextStep(ns, d) }}
            style={{ cursor: 'pointer' }}
            className="btn-teal text-sm w-full py-2.5 mt-4"
          >
            {String(d.label || 'Lanjut')}
          </button>
          {!canAdvance && (
            <p className="text-center text-[12px] text-[#6B6A64] mt-2 leading-relaxed">
              Hari kedua sedang disiapkan. Setelah ini ada dua pertanyaan singkat, lalu kamu bisa mencoba posisi lain.
            </p>
          )}
        </div>
      )
    }

    if (isInterviewDone) {
      return (
        <div className="max-w-[560px] animate-messageIn border border-[#0F6E56]/25 bg-[#F4F8F6] rounded-xl p-4">
          <p className="text-sm text-[#1A1A18] leading-relaxed">{String(d.label ?? '')}</p>
          <button
            onClick={() => { if (stale) onViewChange('inbox'); else if (ns !== undefined) onNextStep(ns, d) }}
            style={{ cursor: 'pointer' }}
            className="btn-teal text-sm mt-3"
          >
            {stale ? 'Lihat di Inbox' : String(d.subLabel ?? 'Buka offering letter')}
          </button>
        </div>
      )
    }

    return (
      <div className="ml-10 animate-messageIn">
        <button
          onClick={() => {
            if (d.goTo) onViewChange(String(d.goTo))
            if (ns !== undefined && !stale) onNextStep(ns, d)
          }}
          style={{ cursor: 'pointer' }}
          className="text-[13px] font-medium text-[#0F6E56] border border-[#0F6E56]/40 hover:bg-[#E1F5EE] px-3 py-2 rounded-md transition-colors"
        >
          {String(d.label ?? 'Lanjut')}
        </button>
      </div>
    )
  }

  if (msg.role === 'email') {
    // Email selalu dibaca di Inbox (offering letter + tanda tangan hanya di sana)
    const d = msg.data || {}
    return (
      <div className="max-w-[560px] bg-white border border-[#E5E3DC] rounded-lg px-3.5 py-3 animate-messageIn">
        <p className="text-[12px] text-[#6B6A64]">Email dari {String(d.from ?? 'HR')}</p>
        <p className="text-[13px] font-medium text-[#1A1A18] mt-0.5">{String(d.subject ?? '')}</p>
        <button onClick={() => onViewChange('inbox')} style={{ cursor: 'pointer' }} className="mt-2 text-[13px] font-medium text-[#0F6E56] hover:underline">
          Buka di Inbox
        </button>
      </div>
    )
  }

  if (msg.role === 'task') {
    const d = msg.data || {}
    const meta = [
      d.num ? `Task ${String(Number(d.num)).padStart(2, '0')}` : '',
      d.deadline ? `Tenggat ${String(d.deadline).toLowerCase()}` : '',
      d.dept ? String(d.dept) : '',
    ].filter(Boolean)
    return (
      <div className="max-w-[560px] bg-white border border-[#E5E3DC] rounded-lg p-3.5 animate-messageIn">
        {meta.length > 0 && <p className="text-[12px] text-[#6B6A64] mb-1.5 tabular">{meta.join(' · ')}</p>}
        <p className="text-sm font-semibold text-[#1A1A18] mb-1">{String(d.title ?? '')}</p>
        <p className="text-[13px] leading-relaxed text-[#2B2B28]" dangerouslySetInnerHTML={{ __html: String(d.body ?? '') }} />
        {!!d.ctx && <p className="mt-2 text-[13px] text-[#4A4A45] border-l-2 border-[#E5E3DC] pl-2.5 leading-relaxed">{String(d.ctx)}</p>}
        {!!d.isDownload && !!d.file && (
          <a
            href={String(d.href || `/tasks/${String(d.file)}`)}
            download={String(d.file)}
            style={{ cursor: 'pointer' }}
            className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-md px-3 py-2"
          >
            <Download size={14} aria-hidden />
            Unduh <span className="font-mono text-[12px]">{String(d.file)}</span>
          </a>
        )}
      </div>
    )
  }

  return null
}

// ── INBOX ───────────────────────────────────────
function InboxView({ messages, onNextStep, onViewChange, state }: {
  messages: Message[]
  onNextStep: (step: number, data?: Record<string, unknown>) => void
  onViewChange: (view: string) => void
  state: SimState
  pos?: typeof POSITIONS[string]
}) {
  const emails = messages.filter(m => m.role === 'email')
  const offering = emails.find(e => e.data?.isOffering)
  // Offering baru masuk (step 2) → langsung terbuka; tidak perlu mencari di daftar
  const [selectedId, setSelectedId] = useState<string | null>(() => (state.step === 2 && offering ? offering.id : null))
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(state.step === 2 && offering ? [offering.id] : []))
  const [agree, setAgree] = useState(false)
  const [signName, setSignName] = useState('')
  const signed = state.step >= 3
  const selected = emails.find(e => e.id === selectedId)

  const open = (id: string) => {
    setSelectedId(id)
    setReadIds(prev => new Set(prev).add(id))
  }
  const isUnread = (e: Message) => {
    if (readIds.has(e.id)) return false
    if (e.data?.isOffering) return !signed
    if (e.data?.isInvite) return state.step === 0 && !hasStartedInterview(state.chatHistory)
    return false
  }
  const getTime = (e: Message, idx: number) => {
    const t = Number(e.data?.issuedAt)
    if (t) return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return ['08.00', '09.30', '10.15'][idx] || '08.00'
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <p className="text-sm text-[#6B6A64]">Inbox kosong.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Daftar email; di mobile disembunyikan saat satu email dibuka */}
      <div data-tour="inbox-list" className={`flex-col border-r border-[#E5E3DC] flex-shrink-0 overflow-y-auto ${selectedId ? 'hidden md:flex md:w-72' : 'flex flex-1 md:flex-none md:w-72'}`}>
        {[...emails].reverse().map((email, ridx) => {
          const idx = emails.length - 1 - ridx
          const d = email.data || {}
          const active = selectedId === email.id
          const unread = isUnread(email)
          return (
            <button
              key={email.id}
              onClick={() => open(email.id)}
              style={{ cursor: 'pointer' }}
              className={`w-full text-left px-4 py-3 border-b border-[#F1EFE8] transition-colors ${active ? 'bg-[#E1F5EE]/70' : 'hover:bg-[#F7F6F2]'}`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[13px] truncate ${unread ? 'font-semibold text-[#1A1A18]' : 'text-[#4A4A45]'}`}>
                  {unread && <span className="inline-block w-2 h-2 rounded-full bg-[#0F6E56] mr-2 align-middle" aria-label="Belum dibaca" />}
                  Sinta Maharani
                </span>
                <span className="text-[12px] text-[#6B6A64] flex-shrink-0 tabular">{getTime(email, idx)}</span>
              </div>
              <p className={`text-[13px] truncate ${unread ? 'font-medium text-[#1A1A18]' : 'text-[#4A4A45]'}`}>{String(d.subject || '')}</p>
              <p className="text-[12px] text-[#6B6A64] truncate">
                {d.isOffering ? (signed ? 'Sudah ditandatangani' : 'Menunggu tanda tanganmu') : d.isInvite ? 'Undangan interview dengan HR' : String(d.preview || '')}
              </p>
            </button>
          )
        })}
      </div>

      {!selected && (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <p className="text-sm text-[#6B6A64]">Pilih email untuk dibaca.</p>
        </div>
      )}

      {selected && (() => {
        const d = selected.data || {}
        // Offering lama (sebelum issuedAt ada) memakai timestamp yang tertanam di id-nya
        const issued = new Date(Number(d.issuedAt) || Number(selected.id.replace(/\D/g, '').slice(0, 13)) || 0)
        const salary = Number(d.salary || 0)
        const meal = Number(d.mealAllowance || 600000)
        const transport = Number(d.transportAllowance || 400000)
        const letterNo = `VN/HR/${issued.getFullYear()}/${selected.id.replace(/\D/g, '').slice(-4) || '0001'}`
        const canSign = agree && signName.trim().length >= 3
        return (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="px-4 sm:px-5 py-3 border-b border-[#E5E3DC] flex items-start gap-3 flex-shrink-0">
              <button onClick={() => setSelectedId(null)} style={{ cursor: 'pointer' }} aria-label="Kembali ke daftar email"
                className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-md text-[#4A4A45] hover:bg-[#F1EFE8] flex-shrink-0">
                <X size={16} aria-hidden />
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#1A1A18]">{String(d.subject || '')}</p>
                <p className="text-[12px] text-[#6B6A64] mt-0.5 truncate">Sinta Maharani &lt;{String(d.from || 'sinta@vantara.co.id')}&gt;</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-[#FAFAF7]">
              {d.isOffering ? (
                <article className="max-w-[600px] mx-auto bg-white border border-[#E5E3DC] rounded-md px-5 sm:px-9 py-7 text-[14px] leading-relaxed text-[#2B2B28]">
                  <header className="border-b-2 border-[#1A1A18] pb-3 mb-5">
                    <p className="text-[15px] font-semibold tracking-[0.04em] text-[#1A1A18]">PT VANTARA NUSANTARA</p>
                    <p className="text-[12px] text-[#6B6A64]">Personal care · Jakarta Selatan</p>
                  </header>
                  <p className="text-[13px] text-[#4A4A45] tabular">
                    Jakarta, {issued.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
                    Nomor: {letterNo}<br />
                    Perihal: Penawaran kerja
                  </p>
                  <p className="mt-5">Yth. {state.firstName},</p>
                  <p className="mt-2">
                    Terima kasih sudah mengikuti proses interview dengan kami. Dengan surat ini, PT Vantara Nusantara menawarkan posisi berikut kepadamu.
                  </p>
                  <table className="w-full mt-4 text-[13px]">
                    <tbody>
                      {([
                        ['Posisi', String(d.position ?? '')],
                        ['Departemen', String(d.dept ?? '')],
                        ['Atasan langsung', String(d.supervisor ?? '')],
                        ['Gaji pokok', `Rp ${salary.toLocaleString('id-ID')} per bulan`],
                        ['Tunjangan makan', `Rp ${meal.toLocaleString('id-ID')} per bulan`],
                        ['Tunjangan transport', `Rp ${transport.toLocaleString('id-ID')} per bulan`],
                        ['Masa percobaan', String(d.probation ?? '3 bulan')],
                        ['Sistem kerja', String(d.workSystem ?? '')],
                      ] as [string, string][]).map(([k, v]) => (
                        <tr key={k} className="border-b border-[#F1EFE8] last:border-0 align-top">
                          <td className="py-1.5 pr-4 text-[#6B6A64] whitespace-nowrap">{k}</td>
                          <td className={`py-1.5 tabular ${k === 'Gaji pokok' ? 'font-semibold text-[#1A1A18]' : ''}`}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-[13px] text-[#4A4A45] tabular">
                    Total diterima per bulan, sebelum pajak dan BPJS: <strong className="font-semibold text-[#1A1A18]">Rp {(salary + meal + transport).toLocaleString('id-ID')}</strong>
                  </p>
                  {!!d.conditional && (
                    <p className="mt-3 text-[13px] text-[#4A4A45]">
                      Sesuai catatan interview, evaluasi pertama dilakukan di akhir minggu pertama.
                    </p>
                  )}
                  <p className="mt-4">Gaji dibayarkan setiap tanggal 25. Penawaran ini berlaku tiga hari kerja sejak tanggal surat.</p>
                  <p className="mt-6">Salam,</p>
                  <p className="mt-5 font-medium text-[#1A1A18]">Sinta Maharani</p>
                  <p className="text-[13px] text-[#6B6A64]">HR Business Partner</p>
                </article>
              ) : (
                <div className="max-w-[600px] mx-auto bg-white border border-[#E5E3DC] rounded-md px-5 sm:px-7 py-6">
                  <p className="text-[14px] leading-relaxed text-[#2B2B28] whitespace-pre-line">{String(d.body || d.preview || '')}</p>
                </div>
              )}
            </div>

            <div className="border-t border-[#E5E3DC] px-4 sm:px-5 py-3.5 bg-white flex-shrink-0">
              {d.isOffering ? (
                signed ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-[#166534]">Kontrak ini sudah kamu tanda tangani.</p>
                    <button onClick={() => onViewChange('slack')} style={{ cursor: 'pointer' }} className="btn-teal-outline text-[13px] py-2 px-3">
                      Buka channel tim
                    </button>
                  </div>
                ) : (
                  <div className="max-w-[600px] mx-auto flex flex-col gap-2.5">
                    <label className="flex items-start gap-2.5 text-[13px] text-[#2B2B28]" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0F6E56]" />
                      Saya sudah membaca penawaran ini dan menerimanya.
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={signName}
                        onChange={e => setSignName(e.target.value)}
                        placeholder="Ketik nama lengkapmu sebagai tanda tangan"
                        aria-label="Tanda tangan, ketik nama lengkap"
                        autoComplete="name"
                        className="flex-1 px-3 py-2.5 border border-[#D8D6CE] rounded-lg text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10"
                      />
                      <button
                        onClick={() => onNextStep(3)}
                        disabled={!canSign}
                        style={{ cursor: canSign ? 'pointer' : 'not-allowed' }}
                        className="btn-teal text-sm px-5 py-2.5"
                        type="button"
                      >
                        Tanda tangani
                      </button>
                    </div>
                    <p className="text-[12px] text-[#6B6A64]">Ragu soal isinya? Tutup dulu dan baca lagi, offering ini menunggumu.</p>
                  </div>
                )
              ) : d.isInvite ? (
                state.step === 0 && !state.interviewDone ? (
                  <button onClick={() => onViewChange('hr_office')} style={{ cursor: 'pointer' }} className="btn-teal w-full sm:w-auto py-2.5 px-5 text-sm" type="button">
                    Mulai interview dengan Sinta
                  </button>
                ) : (
                  <p className="text-[13px] text-[#6B6A64]">Interview untuk undangan ini sudah berjalan.</p>
                )
              ) : null}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function WorkspaceView({ state, pos, taskOpen, taskTitle, uploadedFile, extractedData, reviewResult, isSubmitting, error, onFileUpload, onSubmit, onClearUpload }: {
  state: SimState; pos?: typeof POSITIONS[string];
  taskOpen: boolean; taskTitle: string;
  uploadedFile: File | null; extractedData: string;
  reviewResult: { review: string; isApproved: boolean } | null;
  isSubmitting: boolean;
  error: string;
  onFileUpload: (f: File) => void;
  onSubmit: () => void;
  onClearUpload: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Belum ada task: dulu Workspace sudah menampilkan "Task aktif" sebelum supervisor
  // memberi task, bikin user baru bingung harus mengerjakan apa
  if (state.step < 5) {
    return (
      <div className="max-w-[560px] border border-[#E5E3DC] rounded-lg p-4 bg-white">
        <p className="text-sm font-semibold text-[#1A1A18]">Belum ada task</p>
        <p className="text-[13px] text-[#4A4A45] mt-1 leading-relaxed">
          {callName(pos?.supervisor.name) || 'Supervisormu'} akan memberi task setelah standup. Hasil kerjanya nanti dikumpulkan di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-4 max-w-[640px]">
      {taskOpen ? (
        <div className="border border-[#E5E3DC] rounded-lg p-4 bg-white">
          <p className="text-[12px] text-[#6B6A64]">Task aktif · tenggat besok jam 09.00</p>
          <p className="text-sm font-semibold text-[#1A1A18] mt-0.5">{taskTitle}</p>
          <p className="text-[13px] text-[#4A4A45] mt-1.5 leading-relaxed">
            Unduh filenya di File Manager, kerjakan di Excel, simpan sebagai .xlsx, lalu upload di bawah. Supervisor akan membaca dan membalas di chat.
          </p>
        </div>
      ) : (
        <div className="border border-[#166534]/20 bg-[#EEF8F1] rounded-lg p-4">
          <p className="text-sm font-semibold text-[#166534]">Semua task hari ini sudah disetujui.</p>
          <p className="text-[13px] text-[#166534]/90 mt-1">Cek chat supervisor untuk menutup harimu.</p>
        </div>
      )}

      {taskOpen && (
        <div className="border border-[#E5E3DC] rounded-lg p-4 bg-white">
          <p className="text-sm font-semibold text-[#1A1A18] mb-3">Upload hasil kerja</p>
          {!uploadedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFileUpload(f) }}
              style={{ cursor: 'pointer' }}
              className={`w-full border border-dashed rounded-lg px-4 py-8 text-center transition-colors ${dragOver ? 'border-[#0F6E56] bg-[#E1F5EE]/50' : 'border-[#C8C6BE] hover:border-[#0F6E56] hover:bg-[#FAFAF7]'}`}
            >
              <FileSpreadsheet size={26} aria-hidden className="mx-auto text-[#6B6A64] mb-2" />
              <p className="text-sm font-medium text-[#1A1A18]">Pilih file Excel atau tarik ke sini</p>
              <p className="text-[12px] text-[#6B6A64] mt-1">Hanya .xlsx</p>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 bg-[#F7F6F2] rounded-lg px-3.5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet size={20} aria-hidden className="text-[#166534] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#1A1A18] truncate">{uploadedFile.name}</p>
                  <p className="text-[12px] text-[#6B6A64] tabular">{(uploadedFile.size / 1024).toFixed(1)} KB{extractedData ? ' · terbaca, siap dikirim' : ' · membaca...'}</p>
                </div>
              </div>
              {!isSubmitting && (
                <button onClick={onClearUpload} style={{ cursor: 'pointer' }} className="text-[13px] text-[#4A4A45] hover:text-[#B42318] flex-shrink-0">
                  Ganti file
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); e.target.value = '' }}
          />

          {uploadedFile && extractedData && !reviewResult && (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? 'wait' : 'pointer' }}
              className="btn-teal text-sm w-full mt-3 py-2.5"
            >
              {isSubmitting ? `${callName(pos?.supervisor.name) || 'Supervisor'} sedang membaca filemu...` : 'Kirim ke supervisor'}
            </button>
          )}
          {error && <p className="text-[13px] text-[#B42318] mt-3" role="alert">{error}</p>}
        </div>
      )}

      {reviewResult && (
        <div className={`border rounded-lg p-4 ${reviewResult.isApproved ? 'bg-[#EEF8F1] border-[#166534]/20' : 'bg-[#FDF6EA] border-[#854F0B]/20'}`}>
          <p className={`text-[13px] font-semibold mb-1.5 ${reviewResult.isApproved ? 'text-[#166534]' : 'text-[#7A4708]'}`}>
            {reviewResult.isApproved ? 'Disetujui' : 'Perlu revisi'}
          </p>
          <p className="text-sm leading-relaxed text-[#1A1A18]">{reviewResult.review}</p>
          {!reviewResult.isApproved && (
            <button onClick={onClearUpload} style={{ cursor: 'pointer' }} className="mt-3 text-[13px] font-medium text-[#7A4708] underline underline-offset-2">
              Upload file revisi
            </button>
          )}
        </div>
      )}

      {extractedData && (
        <details className="border border-[#E5E3DC] rounded-lg bg-white group">
          <summary className="px-4 py-3 text-[13px] font-medium text-[#4A4A45]" style={{ cursor: 'pointer' }}>
            Lihat isi file yang terbaca
          </summary>
          <pre className="mx-4 mb-4 text-[12px] font-mono text-[#4A4A45] bg-[#FAFAF7] rounded-md p-3 overflow-x-auto max-h-[220px] whitespace-pre-wrap">
            {extractedData.substring(0, 1500)}{extractedData.length > 1500 ? '\n...(dipotong)' : ''}
          </pre>
        </details>
      )}

      {taskOpen && state.simDay === 1 && pos && pos.upcomingTasks.length > 0 && (
        <div className="border border-[#E5E3DC] rounded-lg p-4 bg-white">
          <p className="text-[13px] font-semibold text-[#1A1A18] mb-1">Minggu pertamamu</p>
          <ul>
            <li className="flex gap-2.5 py-2 border-b border-[#F1EFE8]">
              <span className="w-[13px] h-[13px] mt-1 rounded-full border-2 border-[#0F6E56] flex-shrink-0" aria-hidden />
              <div>
                <p className="text-[13px] font-medium text-[#0F6E56]">Hari 1: {pos.taskTitle}</p>
                <p className="text-[12px] text-[#6B6A64]">Sedang kamu kerjakan</p>
              </div>
            </li>
            {pos.upcomingTasks.map(t => (
              <li key={t.day} className="flex gap-2.5 py-2 border-b border-[#F1EFE8] last:border-0">
                <Lock size={13} aria-hidden className="mt-1 text-[#A3A19A] flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-[#4A4A45]">Hari {t.day}: {t.title}</p>
                  <p className="text-[12px] text-[#6B6A64] leading-relaxed">{t.teaser}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
