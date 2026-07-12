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

import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import ReferenceLetter from '@/components/ReferenceLetter'
import { countRevisions, computeGrade, GRADE_LABEL, GRADE_REVIEW, getWorkStyle } from '@/lib/performance'

// Tur pengenalan UI untuk user yang baru pertama kali masuk simulasi.
// Selector menunjuk atribut data-tour di elemen bersangkutan.
const TOUR_STEPS: TourStep[] = [
  { title: 'Selamat datang di kantor barumu', body: 'Semua yang terjadi di sini berjalan seperti kantor sungguhan: ada email, chat tim, interview, sampai nego gaji. Sebelum mulai, kenalan dulu sama ruangannya sebentar.' },
  { target: '[data-tour="inbox-list"]', title: 'Inbox', body: 'Email undangan interview dari HR sudah masuk di sini. Dokumen penting lain seperti offering letter juga akan datang lewat inbox ini.' },
  { target: '[data-tour="team"]', title: 'Tim kamu', body: 'Orang-orang yang bisa kamu ajak bicara. Klik nama untuk buka chat. Untuk sekarang baru Sinta dari HR yang aktif, sisanya terbuka setelah kamu diterima kerja.', needsSidebar: true },
  { target: '[data-tour="rooms"]', title: 'Ruangan kantor', body: 'Pindah ruangan lewat menu ini. Ruangan yang terkunci akan terbuka seiring perjalananmu. Langkah pertamamu nanti: HR Office untuk interview.', needsSidebar: true },
  { target: '[data-tour="coins"]', title: 'Kantor Coin', body: 'Poin yang kamu kumpulkan dari setiap aktivitas dan task yang selesai.' },
  { title: 'Mulai dari email Sinta', body: 'Buka email undangan di Inbox, lalu masuk ke HR Office dan sapa Sinta. Sisanya akan mengalir seperti hari pertama kerja beneran. Semoga lancar!' },
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
}

const INITIAL: SimState = {
  firstName: '', email: '', background: '', bgRole: '', level: '', position: '',
  experience: '', motivation: '', step: 0, coins: 0, tasksDone: 0,
  streak: 0, phaseUnlocked: 0, salaryExpected: 0, salaryOffered: 0,
  chatHistory: {}, unreadCounts: {}, interviewDone: false,
}

// ── NPC CONFIG ────────────────────────────────────
const NPC_INITIALS: Record<string, Record<string, string>> = {
  data_analyst:       { sup: 'RP', mgr: 'DK', jnr: 'GA' },
  marketing_analyst:  { sup: 'DP', mgr: 'BK', jnr: 'AL' },
  finance_analyst:    { sup: 'AW', mgr: 'PH', jnr: 'NS' },
  hr_generalist:      { sup: 'BR', mgr: 'TS', jnr: 'LL' },
  bizdev:             { sup: 'RF', mgr: 'PA', jnr: 'MR' },
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
  onWishlist?: (coins: number, tasksDone: number) => void
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
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
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

  // Auto-save every 30s — interval dibuat SEKALI; dirty-check di saveProgress
  // memastikan user idle tidak menghasilkan write ke database sama sekali
  useEffect(() => {
    const iv = setInterval(() => {
      if (stateRef.current.step > 0) saveProgress()
    }, 30000)
    return () => clearInterval(iv)
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
        showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Ada DM dari supervisormu')
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
      showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Ada DM dari supervisormu')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, 2000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDone, state.step])

  const loadProgress = async () => {
    try {
      // Multi-role: muat progress khusus posisi yang dibuka dari hub karir
      const qs = initialPosition ? `?position=${encodeURIComponent(initialPosition)}` : ''
      const res = await authFetch(`/api/progress${qs}`)
      const { progress } = await res.json()
      if (progress && progress.step > 0) {
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
          chatHistory: (progress.chat_history as Record<string, Message[]>) || {},
          interviewDone: progress.step >= 2,
        }))
        setView(progress.step >= 3 ? 'slack' : 'inbox')
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
        text: `Halo ${firstName}! Saya Sinta, HR Business Partner Vantara. Santai aja ya, ini lebih ke ngobrol dan kenalan dulu. Cerita dong, siapa kamu dan kenapa tertarik sama posisi ${pos.title} di sini?`
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
      setView('inbox')
      // Show notification after mount
      setTimeout(() => {
        showNotif('inbox', 'Inbox', 'Ada email undangan seleksi dari Sinta Maharani')
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
          chatHistory: s.chatHistory,
        }
      })
      // Dirty-check: jangan tulis ulang blob yang sama ke database
      if (payload === lastSavedRef.current) return
      await authFetch('/api/progress', { method: 'POST', body: payload })
      lastSavedRef.current = payload
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

  const callChat = async (npcId: string, userMsg: string, room: string): Promise<{ reply: string; interviewDone: boolean; failed: boolean }> => {
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
            experience: state.experience,
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
    const { reply, interviewDone: serverSaysDone, failed } = await callChat(npcId, userMsg, room)

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
      showNotif(room, roomLabels[room] || room, 'Ada balasan baru, klik untuk buka')
      setState(prev => ({
        ...prev,
        unreadCounts: { ...prev.unreadCounts, [room]: (prev.unreadCounts[room] || 0) + 1 }
      }))
    }

    // Check if interview is done, use functional setState to get latest state
    if (npcId === 'sinta') {
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
            setTimeout(() => {
              addMsg('hr_office', {
                role: 'action',
                data: {
                  label: 'Interview selesai! Kamu diterima di PT Vantara Nusantara.',
                  subLabel: 'Lanjut ke Offering Letter',
                  nextStep: 2,
                  type: 'interview_done'
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
    if (!confirm('Yakin mau mengulang posisi ini dari awal?\n\nProgress dan chat di posisi INI akan hilang. Progress posisi lain tetap tersimpan.')) return
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
    } catch { alert('Gagal reset, coba lagi.') }
  }

  const handleNextStep = async (step: number, data?: Record<string, unknown>) => {
    // Special case: go to day 2 / wishlist
    if (step === 99) {
      if (onWishlist) {
        await saveProgress()
        onWishlist(state.coins, state.tasksDone)
      }
      return
    }

    setState(prev => ({ ...prev, step }))

    if (step === 2) {
      const pos = POSITIONS[state.position]
      const salRange = getSalaryRange(state.level || state.background)

         // Extract agreed salary, prioritas dari konfirmasi Sinta, bukan request user
      const hrMessages = state.chatHistory['hr_office'] || []
      let agreedSalary = salRange.offer

      const extractJuta = (text: string): number | null => {
        const m = text.match(/(\d+[.,]?\d*)\s*juta/)
        if (m) {
          const val = parseFloat(m[1].replace(',', '.')) * 1000000
          if (val >= 1000000 && val <= 15000000) return Math.round(val)
        }
        return null
      }

      // Prioritas 1: dari pesan Sinta yang konfirmasi/setuju angka
      const confirmKw = ['masuk', 'bisa diakomodir', 'sesuai budget', 'acceptable',
        'oke', 'deal', 'bisa kami', 'akan kami cantumkan', 'offering letter',
        'bisa diterima', 'kita setuju', 'sepakat']
      for (const msg of [...hrMessages].reverse()) {
        if (msg.role === 'npc' && msg.npcId === 'sinta' && msg.text) {
          const text = msg.text.toLowerCase()
          if (confirmKw.some(kw => text.includes(kw))) {
            const val = extractJuta(text)
            if (val) { agreedSalary = val; break }
          }
        }
      }

      // Prioritas 2: Sinta sebut angka maksimal
      if (agreedSalary === salRange.offer) {
        const maxKw = ['maksimal', 'maksimum', 'paling tinggi', 'sampai', 'bisa kami berikan']
        for (const msg of [...hrMessages].reverse()) {
          if (msg.role === 'npc' && msg.npcId === 'sinta' && msg.text) {
            const text = msg.text.toLowerCase()
            if (maxKw.some(kw => text.includes(kw))) {
              const val = extractJuta(text)
              if (val) { agreedSalary = val; break }
            }
          }
        }
      }

      // Prioritas 3: dari user HANYA kalau dalam range valid
      if (agreedSalary === salRange.offer) {
        for (const msg of [...hrMessages].reverse()) {
          if (msg.role === 'user' && msg.text) {
            const val = extractJuta(msg.text.toLowerCase())
            if (val && val >= salRange.min && val <= salRange.max) {
              agreedSalary = val; break
            }
          }
        }
      }

      // Hard clamp: tidak boleh keluar dari range min-max
      const finalSalary = Math.min(Math.max(agreedSalary, salRange.min), salRange.max)

      // Add offering letter directly to state (avoid addMsg race condition)
      const offeringMsg = {
        id: `offering-${Date.now()}`,
        role: 'email' as const,
        data: {
          from: 'sinta@vantara.co.id',
          subject: `Offering Letter, ${state.bgRole}`,
          preview: 'Selamat! Kami dengan senang hati menawarkan posisi ini kepada kamu.',
          isOffering: true,
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
      setTimeout(() => showNotif('inbox', 'Inbox', 'Offering Letter dari Sinta Maharani masuk!'), 300)
    }

    if (step === 3) {
      setState(prev => ({ ...prev, step: 3, phaseUnlocked: 1 }))
      const pos = POSITIONS[state.position]
      const channelName = pos?.dept.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/-$/g, '') || 'general'

      setTimeout(() => {
        addMsg('slack', { role: 'system', text: `Kamu ditambahkan ke #${channelName}` }, true)
        setTimeout(() => {
          addMsg('slack', { role: 'npc', npcId: 'sinta', text: `Hai tim! Perkenalkan ${state.firstName}, ${state.bgRole} yang mulai hari ini. Disambut ya!` })
          showNotif('slack', 'Slack', `Sinta Maharani menyebut nama kamu di #${channelName}`)
          setTimeout(() => {
            addMsg('slack', { role: 'npc', npcId: 'sup', text: `Welcome ${state.firstName}. Saya ${pos?.supervisor.name}, supervisor langsungmu. Santai dulu, kenalan sama tim. Nanti kita standup.` })
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
        showNotif('reference', 'Surat Referensi', 'HR mulai menyusun surat referensimu. Lihat di sidebar.')
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
        addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Oke, sebelum mulai kerja aku mau orientasi singkat dulu. PT Vantara Nusantara itu FMCG personal care, ada 3 brand: Lumière (skincare), Roots&Co (haircare), sama Vanta Glow (body care). Kita distribute ke modern trade, GT, sama e-commerce.` })
        setTimeout(() => {
          addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Posisi kamu sebagai ${state.bgRole} di tim ${pos?.dept}. Tanggung jawab utamamu adalah ${pos?.itx}. Kamu lapor langsung ke aku, dan kalau ada hal strategis baru eskalasi ke ${pos?.manager.name}.` })
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'learn',
              data: {
                icon: '📋', title: 'SOP Tim ' + pos?.dept,
                body: 'Daily standup jam 9 pagi. Task masuk via chat supervisor. Deadline selalu dicantumkan. Submit hasil kerja di Workspace. Feedback langsung dari supervisor.',
              }
            })
            setTimeout(() => {
              addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Oh iya, aku udah assign training module buat kamu di Academy, ada di sidebar. Nggak wajib sekarang, tapi materinya persis bekal buat task pertamamu. Kalau nanti kejedot, balik ke situ. Misinya aku review langsung.` })
              addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Nah itu overview-nya. Sekarang standup dulu, hari ini rencananya gimana ${state.firstName}?` })
              addMsg('sup_chat', {
                role: 'learn',
                data: {
                  icon: '📢', title: 'Format Daily Standup',
                  body: '(1) Dikerjakan kemarin, (2) Rencana hari ini, (3) Ada hambatan? Untuk hari pertama, cukup bilang rencana hari ini saja.',
                }
              })
              addMsg('sup_chat', { role: 'action', data: { label: 'Buka Academy, Mulai Training →', goTo: 'academy' } })
              showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', 'Orientasi hari pertama dari supervisor')
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
        addMsg('sup_chat', { role: 'action', data: { label: 'Buka File Manager →', nextStep: 6, goTo: 'file_manager' } })

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
      }, 800)
    }

    if (step === 6) {
      // Jangan paksa pindah ke workspace, tombol "Buka File Manager" harus benar-benar
      // membawa user ke File Manager untuk download file task (navigasi via goTo)
      setState(prev => ({ ...prev, step: 6 }))
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `Psst ${state.firstName}, dari pengalaman aku, baca dulu semua data sebelum mulai. Kak ${pos?.supervisor.name.split(' ')[0]} lumayan strict soal detail hehe` })
        showNotif('jnr', POSITIONS[state.position]?.junior.name || 'Junior', 'Ada pesan dari rekan tim')
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
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      let extracted = `File: ${file.name}\n`
      extracted += `Sheets: ${wb.SheetNames.join(', ')}\n\n`

      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
        extracted += `=== Sheet: ${sheetName} ===\n`
        // Take first 50 rows for analysis
        const rows = data.slice(0, 50)
        rows.forEach((row: unknown[]) => {
          extracted += row.join('\t') + '\n'
        })
        extracted += '\n'
      })

      setExtractedData(extracted)
    } catch (e) {
      console.error('Excel read error:', e)
      setExtractedData(`File: ${file.name}\n[Tidak bisa membaca file, pastikan format .xlsx atau .xls]`)
    }
  }

  const handleSubmitTask = async () => {
    if (!extractedData) {
      alert('Upload file Excel hasil kerjamu dulu ya.')
      return
    }
    setIsSubmittingTask(true)
    try {
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
          submission: extractedData
        })
      })
      const data = await res.json()
      if (!res.ok || !data?.review) {
        throw new Error(data?.error || 'Review gagal')
      }
      setReviewResult({ review: data.review, isApproved: data.isApproved })

      // Add feedback to supervisor chat
      const pos = POSITIONS[state.position]
      addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: data.review })
      addMsg('sup_chat', {
        role: 'feedback',
        data: {
          type: data.isApproved ? 'good' : 'neutral',
          label: data.isApproved ? 'TASK APPROVED' : 'REVISION NEEDED',
          text: data.isApproved
            ? 'Hasil kerja kamu sudah memenuhi standar. Task ini selesai!'
            : 'Ada hal yang perlu diperbaiki. Upload ulang file yang sudah direvisi.'
        }
      })

      showNotif('sup_chat', pos?.supervisor.name || 'Supervisor',
        data.isApproved ? 'Task kamu APPROVED!' : 'Task perlu direvisi')

      // Stakes: supervisor makin dingin tiap revisi. Kegagalan tidak menghentikan
      // progress, tapi mengubah cerita — dan tercatat di penilaian + surat referensi.
      if (!data.isApproved) {
        const revCount = countRevisions(state.chatHistory) + 1 // + revisi yang baru saja terjadi
        if (revCount === 1 && !trainingDone) {
          // Just-in-time learning: Academy ditawarkan sebagai penyelamat, bukan gerbang
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'npc', npcId: 'sup',
              text: `Saranku: buka training module di Academy dulu, 10-15 menit aja. Materinya persis soal bagian yang tadi bolong. Abis itu baru revisi.`
            }, viewRef.current === 'sup_chat')
            addMsg('sup_chat', { role: 'action', data: { label: 'Buka Academy →', goTo: 'academy' } }, true)
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

        setTimeout(() => {
          addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `${state.firstName}! Denger-denger task pertamamu approved ya, selamat! Aku dulu sampe minggu kedua baru approved wkwk` })
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'npc', npcId: 'sup',
              text: `Good work hari ini ${state.firstName}. Sudah jam 5, bisa pulang dulu. Besok standup jam 9, ada task lanjutan yang perlu kita bahas.`
            })
            addMsg('sup_chat', {
              role: 'action',
              data: {
                label: 'Selesai untuk hari ini, Lanjut ke Hari Kedua',
                nextStep: 99,
                type: 'day_done',
                coins: newCoins,
                tasksDone: newTasksDone,
              }
            })
            showNotif('sup_chat', POSITIONS[state.position]?.supervisor.name || 'Supervisor', 'Hari pertama selesai! Ada pesan dari supervisor.')
            // Cliffhanger: DM dari manager, bikin penasaran tepat sebelum gate waitlist
            setTimeout(() => {
              addMsg('mgr_chat', {
                role: 'npc', npcId: 'mgr',
                text: `${state.firstName}, ${pos?.supervisor.name.split(' ')[0]} cerita task pertamamu langsung approved. Jarang-jarang itu terjadi di hari pertama. Besok pagi mampir ke ruanganku ya, ada hal yang mau aku diskusikan soal kamu.`
              })
              showNotif('mgr_chat', pos?.manager.name || 'Manager', 'Manager mengirim DM untukmu')
            }, 3500)
          }, 2000)
        }, 1500)
      }
    } catch (e) {
      console.error('Review error:', e)
      alert('Gagal submit, coba lagi ya.')
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
        <p style={{ color:'#888780', fontSize:13 }}>Memuat progress kamu...</p>
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

  const rooms = [
    { id: 'inbox',        icon: '📧', label: 'Inbox',        locked: false },
    { id: 'hr_office',   icon: '🤝', label: 'HR Office',    locked: false },
    { id: 'slack',       icon: '💬', label: 'Slack',        locked: state.phaseUnlocked < 1 },
    { id: 'meeting',     icon: '🪑', label: 'Meeting',      locked: state.phaseUnlocked < 1 },
    { id: 'sup_chat',    icon: '👤', label: 'Supervisor',   locked: state.phaseUnlocked < 1 },
    { id: 'workspace',   icon: '🖥️', label: 'Workspace',   locked: state.phaseUnlocked < 1 },
    { id: 'academy',     icon: '🎓', label: 'Academy',      locked: state.step < 4 },
    { id: 'file_manager',icon: '📁', label: 'File Manager', locked: state.step < 5 },
    { id: 'reference',   icon: '📜', label: 'Surat Referensi', locked: state.phaseUnlocked < 1 },
    { id: 'pantry',      icon: '☕', label: 'Pantry',       locked: state.phaseUnlocked < 1 },
  ]

  const canChat = ['hr_office', 'sup_chat', 'mgr_chat', 'pantry', 'slack', 'jnr'].includes(view)

  return (
    <div
      className="h-dvh flex flex-col bg-white overflow-hidden"
      style={viewportH ? { height: `${viewportH}px` } : undefined}
    >

      {/* Notification Banner */}
      {notification && (
        <div
          className="bg-[#0F6E56] text-white text-sm px-4 py-2.5 flex items-center justify-between animate-fadeUp"
          style={{ cursor: 'pointer' }}
          onClick={() => { setView(notification.room); setNotification(null) }}
        >
          <span>{notification.text}</span>
          <span className="text-white/70 text-xs ml-4">Klik untuk buka →</span>
        </div>
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 h-[52px] border-b border-[#E5E3DC] bg-white flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger, mobile only */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menu"
            style={{ cursor: 'pointer' }}
            className="md:hidden flex flex-col justify-center gap-[3px] w-7 h-7 flex-shrink-0"
          >
            <span className="block h-[2px] w-5 bg-[#0F6E56] rounded" />
            <span className="block h-[2px] w-5 bg-[#0F6E56] rounded" />
            <span className="block h-[2px] w-5 bg-[#0F6E56] rounded" />
          </button>
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] flex-shrink-0"></div>
          <span className="font-serif font-bold text-[#0F6E56] truncate">Kantoran</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-3 py-1 text-xs font-medium text-[#0F6E56]">
          <span>📍</span>
          <span>{rooms.find(r => r.id === view)?.label || 'Kantoran'}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div data-tour="coins" className="flex items-center gap-1.5 bg-[#FAEEDA] border border-[#854F0B]/15 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold text-[#854F0B]">
            🪙 {state.coins}
          </div>
          {onExit && (
            <button onClick={handleExit} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] transition-colors" title="Kembali ke daftar lowongan, progress tersimpan">
              🏢<span className="hidden sm:inline"> Lowongan</span>
            </button>
          )}
          <button onClick={handleRestart} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] transition-colors" title="Ulangi posisi ini dari awal">
            🔄<span className="hidden sm:inline"> Restart</span>
          </button>
          <button onClick={handleLogout} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#111111] transition-colors">
            Keluar
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 h-1 bg-[#E5E3DC] flex-shrink-0">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={`flex-1 transition-all duration-300 ${i < state.step ? 'bg-[#1D9E75]' : i === state.step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'}`} />
        ))}
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780]">Tim Kamu</p>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[#888780] text-sm" aria-label="Tutup menu" style={{ cursor: 'pointer' }}>✕</button>
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">Ruangan</p>
            <div data-tour="rooms" className="flex flex-col gap-0.5">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => !room.locked && setView(room.id)}
                  style={{ cursor: room.locked ? 'not-allowed' : 'pointer' }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                    room.locked ? 'opacity-40 text-[#888780]' :
                    view === room.id ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium' :
                    'text-[#888780] hover:bg-[#FAFAF7] hover:text-[#111111]'
                  }`}
                >
                  <span className="text-sm">{room.icon}</span>
                  <span className="flex-1 truncate">{room.label}</span>
                  {room.locked && <span className="text-[10px]">🔒</span>}
                  {!room.locked && (state.unreadCounts[room.id] || 0) > 0 && (
                    <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {state.unreadCounts[room.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Stats */}
            {/* Profile tab button */}
            <div className="mt-3 pt-3 border-t border-[#E5E3DC]">
              <button
                onClick={() => setShowProfile(p => !p)}
                style={{ cursor: 'pointer' }}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left mb-2 ${
                  showProfile ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'hover:bg-[#FAFAF7]'
                }`}
              >
                <div className="w-8 h-8 rounded-full av-teal flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#111111] truncate">{profile?.full_name || 'Profil saya'}</p>
                  <p className="text-[10px] text-[#888780]">Lihat CV saya</p>
                </div>
              </button>
            </div>

            <div className="border-t border-[#E5E3DC]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2 mt-3">Statistik</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { n: state.tasksDone, l: 'Task done' },
                  { n: state.step >= 4 ? state.step - 3 : '-', l: 'Hari kerja' },
                  { n: state.bgRole || '-', l: 'Posisi', small: true },
                  { n: state.coins, l: 'Coin' },
                ].map((s, i) => (
                  <div key={i} className="bg-[#FAFAF7] rounded-lg p-2 text-center">
                    <div className={`font-serif font-bold text-[#0F6E56] ${s.small ? 'text-xs' : 'text-lg'} leading-tight`}>{s.n}</div>
                    <div className="text-[9px] text-[#888780] mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
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
              <button onClick={() => setShowProfile(false)} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#111111]">✕ Tutup</button>
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
                  uploadedFile={uploadedFile}
                  extractedData={extractedData}
                  reviewResult={reviewResult}
                  isSubmitting={isSubmittingTask}
                  onFileUpload={handleFileUpload}
                  onSubmit={handleSubmitTask}
                  onClearUpload={() => { setUploadedFile(null); setExtractedData('') }}
                />
              )}

              {/* Regular messages */}
              {view !== 'workspace' && view !== 'academy' && view !== 'reference' && (state.chatHistory[view] || []).map(msg => (
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
              {view === 'file_manager' && state.step >= 5 && (pos?.upcomingTasks.length || 0) > 0 && (
                <div className="bg-white border border-[#E5E3DC] rounded-xl p-3 opacity-60 select-none" style={{ cursor: 'not-allowed' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Masuk minggu ini</p>
                  {pos!.upcomingTasks.map(t => (
                    <div key={t.day} className="flex items-center gap-2 py-1.5 border-b border-[#F1EFE8] last:border-0">
                      <span className="text-sm">🔒</span>
                      <p className="text-xs font-medium text-[#444441] truncate">task_hari{t.day}.xlsx, {t.title}</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-[#888780] mt-2">File terkunci, terbuka di Kantoran versi penuh.</p>
                </div>
              )}

              {/* Empty state */}
              {view !== 'workspace' && view !== 'academy' && view !== 'reference' && (state.chatHistory[view] || []).length === 0 && (
                <EmptyRoom view={view} state={state} />
              )}

              {/* Typing indicator */}
              {loading && canChat && (
                <div className="flex gap-2 animate-messageIn">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${view === 'hr_office' ? 'av-teal' : view === 'sup_chat' ? 'av-blue' : view === 'mgr_chat' ? 'av-purple' : 'av-amber'}`}>
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
            <div className="border-t border-[#E5E3DC] bg-white p-3 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ketik pesan..."
                  rows={1}
                  style={{ cursor: 'text' }}
                  autoComplete="off"
                  autoFocus
                  className="flex-1 resize-none px-3 py-2.5 border border-[#E5E3DC] rounded-lg text-sm text-[#111111] bg-[#FAFAF7] outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 disabled:opacity-40 transition-all min-h-[42px] max-h-[120px]"
                />
                <button
                  onClick={() => { handleSend(); focusInput() }}
                  disabled={loading || !input.trim()}
                  style={{ cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}
                  className="w-10 h-10 rounded-lg bg-[#0F6E56] text-white flex items-center justify-center hover:bg-[#085041] disabled:opacity-40 transition-all flex-shrink-0"
                >
                  ➤
                </button>
              </div>
              <p className="text-xs text-[#888780] mt-1.5 ml-1">
                {view === 'pantry' ? 'Pantry, tempat gosip dan ngobrol santai' : 'Ketik bebas, rekan kerjamu akan merespons'}
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
      style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left mb-1 ${
        locked ? 'opacity-40' : active ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'hover:bg-[#FAFAF7]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${avClass}`}>
          {initials}
        </div>
        {!locked && <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${statusDot} border-2 border-white`}></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#111111] truncate">{name}</p>
        <p className="text-[10px] text-[#888780] truncate">{role}</p>
      </div>
      {locked && <span className="text-[10px] text-[#888780]">🔒</span>}
      {!locked && unread > 0 && (
        <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0">
          {unread}
        </span>
      )}
    </button>
  )
}

function ChatHeader({ view, state, pos, onOfferingClick }: { view: string; state: SimState; pos?: typeof POSITIONS[string]; onOfferingClick?: () => void }) {
  const headers: Record<string, { initials: string; avClass: string; name: string; status: string; tag: string; tagBg: string }> = {
    inbox:       { initials: '📧', avClass: 'av-teal', name: 'Inbox', status: 'Email masuk', tag: '', tagBg: '' },
    hr_office:   { initials: 'SM', avClass: 'av-teal', name: 'Sinta Maharani', status: '🟢 Online · HR Business Partner', tag: 'HR', tagBg: 'bg-[#E1F5EE] text-[#0F6E56]' },
    slack:       { initials: '💬', avClass: 'av-teal', name: `#${pos?.dept.toLowerCase().replace(/[^a-z]/g, '-') || 'general'}`, status: 'Group channel tim', tag: 'Slack', tagBg: 'bg-[#E1F5EE] text-[#0F6E56]' },
    meeting:     { initials: '🪑', avClass: 'av-teal', name: 'Meeting Room', status: 'Daily standup & rapat tim', tag: '', tagBg: '' },
    workspace:   { initials: '🖥️', avClass: 'av-teal', name: 'Workspace', status: 'Task & submit hasil kerja', tag: '', tagBg: '' },
    academy:     { initials: '🎓', avClass: 'av-teal', name: 'Vantara Academy', status: 'Training module dari supervisormu', tag: '', tagBg: '' },
    file_manager:{ initials: '📁', avClass: 'av-amber', name: 'File Manager', status: 'File task & dokumen kerja', tag: '', tagBg: '' },
    reference:   { initials: '📜', avClass: 'av-teal', name: 'Surat Referensi Kerja', status: 'Aset yang sedang kamu bangun di Vantara', tag: '', tagBg: '' },
    pantry:      { initials: '☕', avClass: 'av-amber', name: 'Pantry', status: 'Tempat gosip & ngobrol santai', tag: 'Pantry', tagBg: 'bg-[#FAEEDA] text-[#854F0B]' },
    sup_chat:    { initials: NPC_INITIALS[state.position]?.sup || '??', avClass: pos?.supervisor.avClass || 'av-blue', name: pos?.supervisor.name || 'Supervisor', status: `${pos?.supervisor.status || ''} · Supervisormu`, tag: 'Supervisor', tagBg: 'bg-[#E8F0FC] text-[#1A4A8A]' },
    mgr_chat:    { initials: NPC_INITIALS[state.position]?.mgr || '??', avClass: pos?.manager.avClass || 'av-purple', name: pos?.manager.name || 'Manager', status: pos?.manager.status || '', tag: 'Manager', tagBg: 'bg-[#F0EAF9] text-[#5B2D8E]' },
    jnr:         { initials: NPC_INITIALS[state.position]?.jnr || '??', avClass: pos?.junior.avClass || 'av-amber', name: pos?.junior.name || 'Junior', status: `${pos?.junior.status || ''} · Teman tim`, tag: 'Junior', tagBg: 'bg-[#FAEEDA] text-[#854F0B]' },
  }
  const h = headers[view] || headers['inbox']
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E5E3DC] bg-white flex-shrink-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${h.avClass}`}>
        {h.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111111] truncate">{h.name}</p>
        {h.status && <p className="text-xs text-[#888780] truncate">{h.status}</p>}
      </div>
      {view === 'hr_office' && !state.interviewDone && onOfferingClick && (
        <button
          onClick={onOfferingClick}
          style={{ cursor: 'pointer' }}
          className="text-xs font-medium text-[#0F6E56] border border-[#0F6E56]/30 bg-[#E1F5EE] hover:bg-[#0F6E56] hover:text-white px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
        >
          Interview selesai
        </button>
      )}
      {h.tag && view !== 'hr_office' && <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${h.tagBg}`}>{h.tag}</span>}
    </div>
  )
}

function EmptyRoom({ view, state }: { view: string; state: SimState }) {
  const hints: Record<string, string> = {
    inbox: 'Email dari Sinta akan masuk di sini setelah kamu mendaftar.',
    hr_office: 'Mulai percakapan dengan Sinta untuk sesi interview.',
    pantry: 'Datang ke pantry dan mulai ngobrol, bisa gosip soal kantor juga!',
    slack: 'Group channel tim akan aktif setelah kamu diterima.',
    meeting: 'Meeting room akan digunakan untuk standup harian.',
    sup_chat: 'Chat dengan supervisormu akan dimulai setelah onboarding.',
    file_manager: 'File task Excel akan tersedia di sini setelah dapat task.',
    workspace: 'Upload hasil kerja Excel kamu di sini.',
  }
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="text-center">
        <div className="text-3xl mb-3">
          {view === 'inbox' ? '📧' : view === 'pantry' ? '☕' : view === 'file_manager' ? '📁' : '💬'}
        </div>
        <p className="text-sm text-[#888780] max-w-xs">{hints[view] || 'Belum ada percakapan.'}</p>
        {view === 'hr_office' && state.chatHistory['hr_office']?.length === 0 && (
          <p className="text-xs text-[#0F6E56] mt-2 font-medium">Ketik pesan untuk memulai interview →</p>
        )}
      </div>
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
          ↻ Kirim ulang
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
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5 ${getNPCAvClass(msg.npcId)}`}>
        {getNPCInitials(msg.npcId)}
      </div>
      <div className="max-w-[80%]">
        <p className="text-[10px] font-semibold text-[#888780] mb-1">{getNPCName(msg.npcId)}</p>
        <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm leading-relaxed text-[#111111]">
          {msg.text}
        </div>
      </div>
    </div>
  )

  if (msg.role === 'system') return (
    <div className="flex justify-center animate-messageIn">
      <span className="bg-[#F1EFE8] rounded-full px-3 py-1 text-xs text-[#888780]">{msg.text}</span>
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
                  ? 'border-[#E5E3DC] text-[#888780] opacity-50'
                  : 'border-[#0F6E56]/30 bg-white text-[#111111] hover:bg-[#E1F5EE]'
            }`}
          >
            {o.label}
          </button>
        ))}
        {chosen === undefined && (
          <p className="text-[10px] text-[#888780]">Pilihanmu ikut membentuk penilaian gaya kerjamu.</p>
        )}
      </div>
    )
  }

  if (msg.role === 'learn') {
    const d = msg.data || {}
    return (
      <div className="bg-gradient-to-br from-[#E1F5EE] to-[#d4f5e9] border border-[#0F6E56]/20 rounded-xl p-3 animate-messageIn">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">{String(d.icon ?? '')}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E56]">{String(d.title ?? '')}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#085041]">{String(d.body ?? '')}</p>
      </div>
    )
  }

  if (msg.role === 'feedback') {
    const d = msg.data || {}
    const colors: Record<string, string> = {
      good: 'bg-[#DCFCE7] border-[#166534]/20 text-[#166534]',
      neutral: 'bg-[#FAEEDA] border-[#854F0B]/20 text-[#854F0B]',
    }
    return (
      <div className={`border rounded-xl p-3 animate-messageIn ${colors[String(d.type)] || colors.neutral}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1">{String(d.label ?? '')}</p>
        <p className="text-xs leading-relaxed">{String(d.text ?? '')}</p>
      </div>
    )
  }

  if (msg.role === 'action') {
    const d = msg.data || {}
    const isInterviewDone = d.type === 'interview_done'
    const isDayDone = d.type === 'day_done'

    if (isDayDone) {
      // Penilaian hari pertama: grade dari jumlah revisi + gaya kerja dari pilihan dilema
      const revs = countRevisions(state.chatHistory)
      const grade = computeGrade(revs)
      const workStyle = getWorkStyle(state.chatHistory)
      return (
        <div className="animate-messageIn bg-gradient-to-br from-[#E1F5EE] to-[#d4f5e9] border border-[#0F6E56]/20 rounded-xl p-4">
          <p className="text-sm font-bold text-[#0F6E56] mb-1">Hari pertamamu selesai, dan kamu membuktikan kamu bisa.</p>
          <p className="text-xs text-[#444441] mb-3 leading-relaxed">
            Interview dilalui. Gaji dinegosiasikan. Task pertama: APPROVED.
            Banyak orang menunggu berbulan-bulan untuk merasakan semua ini, kamu menjalaninya dalam satu hari.
            Tapi ceritamu di Vantara baru saja dimulai.
          </p>
          <div className="bg-white/70 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-[#0F6E56] mb-1">Penilaian hari pertama: {GRADE_LABEL[grade]}</p>
            <p className="text-[10px] text-[#444441] leading-relaxed">
              {GRADE_REVIEW[grade]}
              {workStyle ? ` Gaya kerjamu: ${workStyle.label.toLowerCase()}. ${workStyle.review}` : ''}
            </p>
            <p className="text-[10px] text-[#888780] mt-1.5">Semua ini sudah tercatat di surat referensimu (lihat sidebar).</p>
          </div>
          <div className="bg-white/70 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-[#0F6E56] mb-2">Yang sudah menunggumu minggu ini:</p>
            <div className="flex flex-col">
              {(pos?.upcomingTasks || []).map(t => (
                <div
                  key={t.day}
                  className="flex items-start gap-2 py-1.5 border-b border-[#E5E3DC]/60 last:border-0 opacity-55 select-none"
                  style={{ cursor: 'not-allowed' }}
                  title="Terbuka di Kantoran versi penuh"
                >
                  <span className="text-xs mt-0.5">🔒</span>
                  <div>
                    <p className="text-xs font-semibold text-[#444441]">Hari {t.day}, {t.title}</p>
                    <p className="text-[10px] text-[#888780] leading-relaxed">{t.teaser}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (d.nextStep !== undefined) onNextStep(Number(d.nextStep), d)
            }}
            style={{ cursor: 'pointer' }}
            className="btn-teal text-sm w-full py-2.5"
          >
            Daftar Waitlist, Lanjutkan ke Hari Kedua →
          </button>
          <p className="text-center text-[10px] text-[#888780] mt-2">
            Gratis. Kamu jadi yang pertama tahu saat hari kedua dibuka, beserta harga early-bird.
          </p>
        </div>
      )
    }

    return (
      <div className={`animate-messageIn rounded-xl p-3 ${isInterviewDone ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'ml-10'}`}>
        {isInterviewDone && (
          <p className="text-sm font-semibold text-[#0F6E56] mb-2">{String(d.label ?? '')}</p>
        )}
        <button
          onClick={() => {
            if (d.goTo) onViewChange(String(d.goTo))
            if (d.nextStep !== undefined) onNextStep(Number(d.nextStep), d)
          }}
          style={{ cursor: 'pointer' }}
          className="btn-teal text-sm inline-flex items-center gap-2"
        >
          {String(isInterviewDone ? d.subLabel : d.label) ?? 'Lanjut'} →
        </button>
      </div>
    )
  }

  if (msg.role === 'email') {
    const d = msg.data || {}
    if (d.isOffering) {
      return (
        <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden animate-messageIn" style={{ maxWidth: '100%' }}>
          <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] px-4 py-3">
            <p className="text-white font-semibold text-sm">PT Vantara Nusantara</p>
            <p className="text-white/80 text-xs">FMCG Personal Care · Jakarta Selatan</p>
          </div>
          <div className="px-4 pt-3 pb-2">
            <p className="font-semibold text-xs uppercase tracking-wider text-[#888780] mb-2">Surat Penawaran Kerja</p>
            <div className="flex flex-col">
              {([
                ['Posisi', String(d.position ?? '')],
                ['Departemen', String(d.dept ?? '')],
                ['Supervisor', String(d.supervisor ?? '')],
                ['Gaji Pokok', `Rp ${Number(d.salary || 0).toLocaleString('id-ID')} / bln`],
                ['Tunjangan', 'Makan Rp 600rb + Transport Rp 400rb'],
                ['Probasi', String(d.probation ?? '')],
                ['Sistem Kerja', String(d.workSystem ?? '')],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-[#F1EFE8] last:border-0 text-xs gap-2">
                  <span className="text-[#888780] flex-shrink-0">{k}</span>
                  <span className={`font-medium text-right ${k === 'Gaji Pokok' ? 'text-[#0F6E56] font-bold' : 'text-[#111111]'}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 border-t border-[#E5E3DC] bg-[#FAFAF7]">
            <button
              onClick={() => onNextStep(3)}
              style={{ cursor: 'pointer' }}
              className="btn-teal w-full py-3 text-sm font-semibold"
              type="button"
            >
              Tanda Tangan & Terima Offer →
            </button>
            <p className="text-center text-[10px] text-[#888780] mt-2">
              Dengan menandatangani, kamu menyetujui semua ketentuan di atas.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden animate-messageIn">
        <div className="bg-[#F1EFE8] px-3 py-2 border-b border-[#E5E3DC]">
          <p className="text-xs text-[#888780]"><strong className="text-[#111111]">Dari:</strong> {String(d.from ?? '')}</p>
          <p className="text-xs font-medium text-[#111111] mt-0.5">{String(d.subject ?? '')}</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#111111]">{String(d.body ?? d.preview ?? '')}</p>
          {!!d.body && (
            <button
              onClick={() => onViewChange('hr_office')}
              style={{ cursor: 'pointer' }}
              className="mt-2 text-xs text-[#0F6E56] font-medium hover:underline"
            >
              Buka HR Office untuk interview →
            </button>
          )}
        </div>
      </div>
    )
  }

  if (msg.role === 'task') {
    const d = msg.data || {}
    return (
      <div className="bg-white border-l-[3px] border-[#0F6E56] border border-[#E5E3DC] rounded-[0_8px_8px_0] p-3 animate-messageIn">
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2 flex-wrap">
          {!!d.num && <span>📋 Task #{String(Number(d.num)).padStart(2, '0')}</span>}
          {!!d.deadline && <span>⏰ {String(d.deadline)}</span>}
          {!!d.dept && <span>🔗 {String(d.dept)}</span>}
        </div>
        <p className="text-sm font-medium text-[#0F6E56] mb-1.5">{String(d.title ?? '')}</p>
        <p className="text-xs leading-relaxed text-[#111111]" dangerouslySetInnerHTML={{ __html: String(d.body ?? '') }} />
        {!!d.ctx && <p className="mt-2 text-xs text-[#888780] italic">{String(d.ctx)}</p>}
        {!!d.isDownload && !!d.file && (
          <a
            href={`/tasks/${String(d.file)}`}
            download={String(d.file)}
            style={{ cursor: 'pointer' }}
            className="mt-3 inline-flex items-center gap-2 btn-teal text-sm"
          >
            Download {String(d.file)}
          </a>
        )}
      </div>
    )
  }

  if (msg.role === 'cliff') {
    const coins = Number(msg.data?.coins || state.coins)
    return (
      <div className="text-center py-8 animate-messageIn">
        <div className="text-4xl mb-3">⏸️</div>
        <h3 className="font-serif text-xl font-bold text-[#111111] mb-2">Hari pertama selesai, {state.firstName}.</h3>
        <p className="text-sm text-[#888780] leading-relaxed max-w-xs mx-auto mb-5">
          Di Kantoran penuh, kamu jalani 3 bulan simulasi, task makin kompleks, situasi tak terduga, promosi, dan surat referensi kerja nyata.
          <br /><br />Kamu sudah kumpulkan <strong>{coins} Kantor Coin</strong> hari ini 🪙
        </p>
        <button
          onClick={() => window.open('/', '_blank')}
          style={{ cursor: 'pointer' }}
          className="btn-teal text-sm"
        >
          Daftar Waitlist, Lanjutkan Karir →
        </button>
      </div>
    )
  }

  return null
}

// ── INBOX GMAIL STYLE ────────────────────────────
function InboxView({ messages, onNextStep, onViewChange, state, pos }: {
  messages: Message[]
  onNextStep: (step: number, data?: Record<string, unknown>) => void
  onViewChange: (view: string) => void
  state: SimState
  pos?: typeof POSITIONS[string]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signingState, setSigningState] = useState<'none' | 'signing' | 'signed'>('none')
  const emails = messages.filter(m => m.role === 'email')
  const selected = emails.find(e => e.id === selectedId)

  const getTimeLabel = (idx: number) => {
    const now = new Date()
    const times = ['08.00', '09.30', '10.15', '14.00', '15.30', '16.00']
    return times[idx] || `${8 + idx}.00`
  }

  const getPreview = (d: Record<string, unknown>) => {
    if (d.isOffering) return 'Selamat! Kami dengan senang hati menawarkan posisi ini kepada kamu.'
    if (d.isInvite) return 'Kami mengundang kamu ke tahap seleksi awal berupa sesi interview singkat.'
    return String(d.preview || d.body || '').slice(0, 80) + '...'
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm text-[#888780]">Inbox kosong. Email dari Sinta akan masuk setelah kamu melamar.</p>
        </div>
      </div>
    )
  }

  // Split view: list kiri + detail kanan
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Email list, di mobile disembunyikan saat satu email dibuka */}
      <div data-tour="inbox-list" className={`flex flex-col border-r border-[#E5E3DC] flex-shrink-0 overflow-y-auto ${selectedId ? 'hidden md:flex md:w-72' : 'flex-1'}`}>
        <div className="px-4 py-3 border-b border-[#E5E3DC] flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888780]">
            {emails.length} pesan
          </p>
        </div>
        {emails.map((email, idx) => {
          const d = email.data || {}
          const isSelected = selectedId === email.id
          const isUnread = idx === emails.length - 1 // latest always unread initially
          return (
            <button
              key={email.id}
              onClick={() => setSelectedId(email.id)}
              style={{ cursor: 'pointer' }}
              className={`w-full text-left px-4 py-3 border-b border-[#F1EFE8] transition-all ${
                isSelected ? 'bg-[#E1F5EE] border-l-2 border-l-[#0F6E56]' : 'hover:bg-[#FAFAF7]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isUnread && !isSelected && <div className="w-2 h-2 rounded-full bg-[#0F6E56] flex-shrink-0" />}
                  <span className={`text-xs ${isUnread && !isSelected ? 'font-bold text-[#111111]' : 'font-medium text-[#888780]'}`}>
                    Sinta Maharani
                  </span>
                </div>
                <span className="text-[10px] text-[#888780] flex-shrink-0">
                  Hari ini, {getTimeLabel(idx)}
                </span>
              </div>
              <p className={`text-xs mb-1 truncate ${isUnread && !isSelected ? 'font-semibold text-[#111111]' : 'text-[#444441]'}`}>
                {String(d.subject || '')}
              </p>
              <p className="text-[10px] text-[#888780] truncate leading-relaxed">
                {getPreview(d)}
              </p>
            </button>
          )
        })}
      </div>

      {/* Email detail */}
      {selectedId && selected && (() => {
        const d = selected.data || {}
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className="px-5 py-4 border-b border-[#E5E3DC] flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-[#111111]">{String(d.subject || '')}</p>
                <button onClick={() => setSelectedId(null)} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#111111]">✕</button>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#888780]">
                <div className="w-6 h-6 rounded-full av-teal flex items-center justify-center text-[9px] font-bold">SM</div>
                <span>Sinta Maharani</span>
                <span className="text-[#E5E3DC]">·</span>
                <span>{String(d.from || 'sinta@vantara.co.id')}</span>
              </div>
            </div>

            {/* Detail body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {d.isOffering ? (
                <div>
                  <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] rounded-xl px-4 py-3 mb-4">
                    <p className="text-white font-semibold text-sm">PT Vantara Nusantara</p>
                    <p className="text-white/80 text-xs">FMCG Personal Care · Jakarta Selatan</p>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-3">Surat Penawaran Kerja</p>
                  {([
                    ['Posisi', String(d.position ?? '')],
                    ['Departemen', String(d.dept ?? '')],
                    ['Supervisor', String(d.supervisor ?? '')],
                    ['Gaji Pokok', `Rp ${Number(d.salary || 0).toLocaleString('id-ID')} / bulan`],
                    ['Tunjangan Makan', `Rp 600.000 / bulan`],
                    ['Tunjangan Transport', `Rp 400.000 / bulan`],
                    ['Masa Probasi', String(d.probation ?? '')],
                    ['Sistem Kerja', String(d.workSystem ?? '')],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2 border-b border-[#F1EFE8] last:border-0 text-sm">
                      <span className="text-[#888780]">{k}</span>
                      <span className={`font-medium ${k === 'Gaji Pokok' ? 'text-[#0F6E56] font-bold' : 'text-[#111111]'}`}>{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-[#444441] whitespace-pre-line">
                  {String(d.body || d.preview || '')}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="border-t border-[#E5E3DC] px-5 py-4 bg-[#FAFAF7] flex-shrink-0">
              {d.isOffering ? (
                signingState === 'none' ? (
                  <button
                    onClick={() => {
                      setSigningState('signing')
                      setTimeout(() => setSigningState('signed'), 1800)
                    }}
                    style={{ cursor: 'pointer' }}
                    className="btn-teal w-full py-3 text-sm font-semibold"
                    type="button"
                  >
                    Tanda Tangan & Terima Offer →
                  </button>
                ) : signingState === 'signing' ? (
                  <div className="text-center py-3">
                    <div className="flex gap-2 justify-center mb-2">
                      <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
                    </div>
                    <p className="text-xs text-[#888780]">Memproses tanda tangan digital...</p>
                  </div>
                ) : (
                  <div>
                    <div className="bg-[#DCFCE7] border border-[#166534]/20 rounded-xl p-3 mb-3 text-center">
                      <p className="text-sm font-bold text-[#166534] mb-1">Kontrak Berhasil Ditandatangani</p>
                      <p className="text-xs text-[#166534]/80">Selamat bergabung di PT Vantara Nusantara!</p>
                    </div>
                    <p className="text-xs text-[#888780] mb-3 leading-relaxed">
                      Salinan kontrak fisik akan dikirim via kurir dalam 3 hari kerja. Dokumen digital ini sudah berlaku resmi. Sampai jumpa di hari pertama, {state.firstName}!
                    </p>
                    <button
                      onClick={() => onNextStep(3)}
                      style={{ cursor: 'pointer' }}
                      className="btn-teal w-full py-3 text-sm font-semibold"
                      type="button"
                    >
                      Mulai Hari Pertama di PT Vantara →
                    </button>
                  </div>
                )
              ) : d.isInvite ? (
                <button
                  onClick={() => onViewChange('hr_office')}
                  style={{ cursor: 'pointer' }}
                  className="btn-teal w-full py-3 text-sm font-semibold"
                  type="button"
                >
                  Mulai Interview dengan Sinta →
                </button>
              ) : null}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function WorkspaceView({ state, pos, uploadedFile, extractedData, reviewResult, isSubmitting, onFileUpload, onSubmit, onClearUpload }: {
  state: SimState; pos?: typeof POSITIONS[string];
  uploadedFile: File | null; extractedData: string;
  reviewResult: { review: string; isApproved: boolean } | null;
  isSubmitting: boolean;
  onFileUpload: (f: File) => void;
  onSubmit: () => void;
  onClearUpload: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Task info */}
      {pos && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E56] mb-1">Task Aktif</p>
          <p className="text-sm font-semibold text-[#111111]">{pos.taskTitle}</p>
          <p className="text-xs text-[#888780] mt-1">⏰ Deadline: Besok jam 09.00</p>
        </div>
      )}

      {/* Roadmap minggu pertama, task mendatang terkunci (teaser premium) */}
      {pos && pos.upcomingTasks.length > 0 && (
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2">Minggu pertamamu di Vantara</p>
          <div className="flex flex-col">
            <div className="flex items-start gap-2.5 py-2 border-b border-[#F1EFE8]">
              <span className="text-sm mt-0.5">✅</span>
              <div>
                <p className="text-xs font-semibold text-[#0F6E56]">Hari 1, {pos.taskTitle}</p>
                <p className="text-[10px] text-[#888780]">Sedang kamu kerjakan sekarang</p>
              </div>
            </div>
            {pos.upcomingTasks.map(t => (
              <div
                key={t.day}
                className="flex items-start gap-2.5 py-2 border-b border-[#F1EFE8] last:border-0 opacity-50 select-none"
                style={{ cursor: 'not-allowed' }}
                title="Terbuka di Kantoran versi penuh"
              >
                <span className="text-sm mt-0.5">🔒</span>
                <div>
                  <p className="text-xs font-semibold text-[#444441]">Hari {t.day}, {t.title}</p>
                  <p className="text-[10px] text-[#888780] leading-relaxed">{t.teaser}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#888780] mt-2">🔒 Terbuka di Kantoran versi penuh, selesaikan hari pertamamu dulu.</p>
        </div>
      )}

      {/* Upload area */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#111111] mb-3">Upload Hasil Kerja</p>

        {!uploadedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
            className="border-2 border-dashed border-[#E5E3DC] rounded-xl p-8 text-center hover:border-[#0F6E56] hover:bg-[#FAFAF7] transition-all"
          >
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm font-medium text-[#111111]">Klik untuk upload file Excel</p>
            <p className="text-xs text-[#888780] mt-1">Format: .xlsx atau .xls</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]) }}
            />
          </div>
        ) : (
          <div className="bg-[#F1EFE8] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-sm font-medium text-[#111111]">{uploadedFile.name}</p>
                  <p className="text-xs text-[#888780]">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={onClearUpload}
                style={{ cursor: 'pointer' }}
                className="text-xs text-[#888780] hover:text-red-500"
              >
                ✕ Hapus
              </button>
            </div>
            {extractedData && (
              <p className="text-xs text-[#0F6E56] font-medium">File berhasil dibaca, siap dikirim ke supervisor</p>
            )}
          </div>
        )}
      </div>

      {/* Submit button */}
      {uploadedFile && extractedData && !reviewResult && (
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          className="btn-teal text-sm disabled:opacity-40"
        >
          {isSubmitting ? 'Supervisor sedang mereview...' : 'Submit ke Supervisor untuk Review →'}
        </button>
      )}

      {/* Review result in workspace */}
      {reviewResult && (
        <div className={`border rounded-xl p-4 ${reviewResult.isApproved ? 'bg-[#DCFCE7] border-[#166534]/20' : 'bg-[#FAEEDA] border-[#854F0B]/20'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${reviewResult.isApproved ? 'text-[#166534]' : 'text-[#854F0B]'}`}>
            {reviewResult.isApproved ? 'TASK APPROVED' : 'REVISION NEEDED'}
          </p>
          <p className="text-sm leading-relaxed text-[#111111]">{reviewResult.review}</p>
          {!reviewResult.isApproved && (
            <button
              onClick={onClearUpload}
              style={{ cursor: 'pointer' }}
              className="mt-3 text-xs font-medium text-[#854F0B] hover:underline"
            >
              Upload ulang file yang sudah direvisi →
            </button>
          )}
          <p className="text-xs text-[#888780] mt-2">Feedback lengkap juga sudah dikirim ke chat Supervisor.</p>
        </div>
      )}

      {/* Data preview */}
      {extractedData && (
        <div className="bg-white border border-[#E5E3DC] rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888780] mb-2">Preview Data yang Dibaca</p>
          <pre className="text-[10px] text-[#888780] bg-[#FAFAF7] rounded-lg p-3 overflow-x-auto max-h-[200px] whitespace-pre-wrap">
            {extractedData.substring(0, 1000)}{extractedData.length > 1000 ? '\n...(truncated)' : ''}
          </pre>
        </div>
      )}
    </div>
  )
}

