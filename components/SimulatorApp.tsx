'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { POSITIONS, SALARY_RANGE, type BackgroundType } from '@/lib/positions'
import * as XLSX from 'xlsx'

// ── TYPES ─────────────────────────────────────────
interface Message {
  id: string
  role: 'npc' | 'user' | 'system' | 'email' | 'task' | 'feedback' | 'action' | 'learn' | 'cliff' | 'offering'
  npcId?: string
  text?: string
  data?: Record<string, unknown>
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
  aiHistory: Record<string, { role: string; content: string }[]>
  unreadCounts: Record<string, number>
  interviewDone: boolean
}

const INITIAL: SimState = {
  firstName: '', email: '', background: '', bgRole: '', position: '',
  experience: '', motivation: '', step: 0, coins: 0, tasksDone: 0,
  streak: 0, phaseUnlocked: 0, salaryExpected: 0, salaryOffered: 0,
  chatHistory: {}, aiHistory: {}, unreadCounts: {}, interviewDone: false,
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

// Pantry gossip topics per NPC
const PANTRY_GOSSIP = {
  data_analyst: {
    jnrName: 'Galih',
    topics: [
      'eh tau nggak, kemarin Pak Rizky sampe jam 9 malem di kantor gara-gara dashboard-nya error pas mau dipresentasiin ke client',
      'btw aku denger-denger sih, bulan depan katanya ada restrukturisasi tim Analytics... tapi belum resmi ya, jangan disebarin dulu',
      'si Diana tuh perfectionist banget, proposal aku direvisi 6 kali bro. 6 KALI. aku udah hampir nangis di toilet',
      'warteg sebelah enak banget, ayam gorengnya. kemarin aku makan siang sama Sinta, doi cerita soal kandidat yang aneh-aneh waktu interview wkwk',
    ]
  }
}

// ── MAIN COMPONENT ────────────────────────────────
import ProfileTab from '@/components/ProfileTab'
import type { UserProfile } from '@/lib/profile'
import type { Experience } from '@/lib/profile'

export default function SimulatorApp({ user, userProfile, initialPosition, initialBackground, onWishlist }: {
  user: User
  userProfile?: UserProfile | null
  initialPosition?: string
  initialBackground?: string
  onWishlist?: (coins: number, tasksDone: number) => void
}) {
  const [state, setState] = useState<SimState>(INITIAL)
  const [view, setView]   = useState('inbox')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [progLoading, setProgLoading] = useState(true)
  const [showApp, setShowApp] = useState(false)
  const [onboardStep, setOnboardStep] = useState(1)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<string>('')
  const [reviewResult, setReviewResult] = useState<{ review: string; isApproved: boolean } | null>(null)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(userProfile || null)
  const [showProfile, setShowProfile] = useState(false)
  const [canGoDay2, setCanGoDay2] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const supDmSentRef = useRef(false)
  const viewRef = useRef(view)

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

  // Watch loading state — refocus when loading finishes
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
  }, [state.chatHistory, view])

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [user.id])

  // Auto-save every 30s
  useEffect(() => {
    const iv = setInterval(() => { if (state.step > 0) saveProgress() }, 30000)
    return () => clearInterval(iv)
  }, [state])

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

  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/progress?userId=${user.id}`)
      const { progress } = await res.json()
      if (progress && progress.step > 0) {
        setState(prev => ({
          ...prev,
          firstName: progress.first_name || '',
          email: progress.email || '',
          background: (progress.background || initialBackground || '') as import('@/lib/positions').BackgroundType | '',
          bgRole: progress.bg_role || '',
          position: progress.position || initialPosition || '',
          step: progress.step || 0,
          coins: progress.coins || 0,
          tasksDone: progress.tasks_done || 0,
          streak: progress.streak || 0,
          phaseUnlocked: progress.step >= 4 ? 1 : 0,
          chatHistory: (progress.chat_history as Record<string, Message[]>) || {},
          interviewDone: progress.step >= 2,
        }))
        setView(progress.step >= 4 ? 'slack' : 'inbox')
        setShowApp(true)
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
      const role = pos.getRole(bg)
      const firstName = userProfile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Kamu'

      // Build inbox email and HR Office message directly into initial state
      const inviteEmailId = `invite-${Date.now()}`
      const sintaMsgId = `sinta-${Date.now() + 1}`

      const inviteEmail = {
        id: inviteEmailId,
        role: 'email' as const,
        data: {
          from: 'sinta@vantara.co.id',
          subject: `Undangan Seleksi — ${role}`,
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
        text: `Halo ${firstName}! Saya Sinta, HR Business Partner Vantara. Santai aja ya, ini lebih ke ngobrol dan kenalan dulu. Cerita dong — siapa kamu dan kenapa tertarik sama posisi ${pos.title} di sini?`
      }

      const initState: SimState = {
        ...INITIAL,
        firstName,
        email: user.email || '',
        background: bg,
        bgRole: role,
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

  const saveProgress = useCallback(async () => {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          progress: {
            firstName: state.firstName,
            email: state.email || user.email,
            background: state.background,
            bgRole: state.bgRole,
            position: state.position,
            step: state.step,
            coins: state.coins,
            tasksDone: state.tasksDone,
            streak: state.streak,
            chatHistory: state.chatHistory,
            taskSubmissions: {},
          }
        })
      })
    } catch (e) { console.error('Save progress error:', e) }
  }, [state, user])

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

  const updateAiHistory = useCallback((npcId: string, role: 'user' | 'assistant', content: string) => {
    setState(prev => {
      const hist = prev.aiHistory[npcId] || []
      const updated = [...hist, { role, content }]
      const trimmed = updated.length > 20 ? updated.slice(-16) : updated
      return { ...prev, aiHistory: { ...prev.aiHistory, [npcId]: trimmed } }
    })
  }, [])

  // Build full conversation history from chat messages for AI memory
  const buildHistory = useCallback((room: string, npcId: string) => {
    const messages = state.chatHistory[room] || []
    const history: { role: 'user' | 'assistant'; content: string }[] = []
    for (const msg of messages) {
      if (msg.role === 'user' && msg.text) {
        history.push({ role: 'user', content: msg.text })
      } else if (msg.role === 'npc' && msg.text && msg.npcId === npcId) {
        history.push({ role: 'assistant', content: msg.text })
      }
    }
    return history.slice(-30)
  }, [state.chatHistory])

  const callChat = async (npcId: string, userMsg: string, room: string) => {
    setLoading(true)
    try {
      const history = buildHistory(room, npcId)
      const messages = [...history, { role: 'user' as const, content: userMsg }]
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId,
          messages,
          userContext: {
            firstName: state.firstName,
            email: state.email || user.email,
            background: state.background,
            bgRole: state.bgRole,
            position: state.position,
            experience: state.experience,
            motivation: state.motivation,
            step: state.step,
          },
          positionId: state.position,
        })
      })
      const data = await res.json()
      return (data.reply as string) || 'Maaf, ada gangguan sebentar. Coba lagi ya!'
    } catch {
      return 'Maaf ada gangguan koneksi. Coba lagi ya!'
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    focusInput()

    // Determine NPC based on current view
    const npcMap: Record<string, string> = {
      hr_office: 'sinta',
      sup_chat: 'sup',
      mgr_chat: 'mgr',
      pantry: 'jnr',
      slack: 'jnr',
    }
    const npcId = npcMap[view] || 'sinta'
    const room = view

    addMsg(room, { role: 'user', text: msg }, true)

    // callChat now builds full history from chatHistory for AI memory
    const reply = await callChat(npcId, msg, room)

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
      showNotif(room, roomLabels[room] || room, 'Ada balasan baru — klik untuk buka')
      setState(prev => ({
        ...prev,
        unreadCounts: { ...prev.unreadCounts, [room]: (prev.unreadCounts[room] || 0) + 1 }
      }))
    }

    // Check if interview is done — use functional setState to get latest state
    if (npcId === 'sinta') {
      setState(prev => {
        if (!prev.interviewDone) {
          const doneSignals = [
            // Penutup interview
            'sampai jumpa', 'sampai bertemu', 'sampai ketemu lagi',
            'terima kasih sudah', 'senang berbicara', 'nice talking',
            'tutup dulu', 'akhiri', 'semoga sukses', 'selamat ya',
            // Proses selanjutnya
            'langkah selanjutnya', 'proses selanjutnya', 'next step',
            'akan kami hubungi', 'akan menghubungi', 'kami hubungi',
            'kabar dari kami', 'keputusan dalam', 'beberapa hari',
            'tim kami akan', '1-2 hari', '2-3 hari',
            // Keputusan diterima
            'kamu diterima', 'selamat bergabung', 'welcome to the team',
            'offering', 'penawaran', 'kami terima', 'bergabung dengan kami',
            'keputusan akhir', 'hasil wawancara', 'proses rekrutmen',
            // Penutup natural
            'kami tutup', 'bye', 'sampai nanti', 'selamat siang',
            'selamat sore', 'hati-hati', 'sukses ya'
          ]
          const isDone = doneSignals.some(s => reply.toLowerCase().includes(s))
          if (isDone) {
            setTimeout(() => {
              addMsg('hr_office', {
                role: 'action',
                data: {
                  label: '🎉 Interview selesai! Kamu diterima di PT Vantara Nusantara.',
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

  const handleRestart = async () => {
    if (!confirm('Yakin mau mulai dari awal?\n\nSemua progress dan chat akan hilang. Kamu bisa pilih posisi baru.')) return
    try {
      await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      setState(INITIAL)
      setShowApp(false)
      setOnboardStep(1)
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
      const salRange = SALARY_RANGE[state.background as string] || SALARY_RANGE['fresh_grad']

         // Extract agreed salary — prioritas dari konfirmasi Sinta, bukan request user
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
          subject: `Offering Letter — ${state.bgRole}`,
          preview: 'Selamat! Kami dengan senang hati menawarkan posisi ini kepada kamu.',
          isOffering: true,
          salary: finalSalary,
          position: state.bgRole,
          dept: pos?.dept,
          supervisor: pos?.supervisor.name,
          mealAllowance: 600000,
          transportAllowance: 400000,
          probation: '3 bulan dengan evaluasi',
          workSystem: 'Hybrid — WFO 3x/minggu',
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
    }

    if (step === 4) {
      setState(prev => ({ ...prev, step: 4 }))
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        // Supervisor explains company + position + SOP
        addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Oke, sebelum mulai kerja aku mau orientasi singkat dulu. PT Vantara Nusantara itu FMCG personal care — ada 3 brand: Lumière (skincare), Roots&Co (haircare), sama Vanta Glow (body care). Kita distribute ke modern trade, GT, sama e-commerce.` })
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
              addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: `Nah itu overview-nya. Sekarang standup dulu — hari ini rencananya gimana ${state.firstName}?` })
              addMsg('sup_chat', {
                role: 'learn',
                data: {
                  icon: '📢', title: 'Format Daily Standup',
                  body: '(1) Dikerjakan kemarin, (2) Rencana hari ini, (3) Ada hambatan? Untuk hari pertama, cukup bilang rencana hari ini saja.',
                }
              })
              addMsg('sup_chat', { role: 'action', data: { label: 'Lanjut ke Task Brief →', nextStep: 5 } })
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

        showNotif('sup_chat', pos?.supervisor.name || 'Supervisor', `📋 Task baru: ${pos?.taskTitle}`)
      }, 800)
    }

    if (step === 6) {
      setState(prev => ({ ...prev, step: 6 }))
      setView('workspace')
      const pos = POSITIONS[state.position]
      setTimeout(() => {
        addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `Psst ${state.firstName} — dari pengalaman aku, baca dulu semua data sebelum mulai. Kak ${pos?.supervisor.name.split(' ')[0]} lumayan strict soal detail hehe` })
        showNotif('jnr', POSITIONS[state.position]?.junior.name || 'Junior', '💬 Ada pesan dari rekan tim')
      }, 3000)
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    try {
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
      setExtractedData(`File: ${file.name}\n[Tidak bisa membaca file — pastikan format .xlsx atau .xls]`)
    }
  }

  const handleSubmitTask = async () => {
    if (!extractedData) {
      alert('Upload file Excel hasil kerjamu dulu ya.')
      return
    }
    setIsSubmittingTask(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: state.position,
          userContext: {
            firstName: state.firstName,
            background: state.background,
            bgRole: state.bgRole,
            position: state.position,
          },
          submission: extractedData
        })
      })
      const data = await res.json()
      setReviewResult({ review: data.review, isApproved: data.isApproved })

      // Add feedback to supervisor chat
      const pos = POSITIONS[state.position]
      addMsg('sup_chat', { role: 'npc', npcId: 'sup', text: data.review })
      addMsg('sup_chat', {
        role: 'feedback',
        data: {
          type: data.isApproved ? 'good' : 'neutral',
          label: data.isApproved ? '✅ TASK APPROVED' : '🔄 REVISION NEEDED',
          text: data.isApproved
            ? 'Hasil kerja kamu sudah memenuhi standar. Task ini selesai!'
            : 'Ada hal yang perlu diperbaiki. Upload ulang file yang sudah direvisi.'
        }
      })

      showNotif('sup_chat', pos?.supervisor.name || 'Supervisor',
        data.isApproved ? '✅ Task kamu APPROVED!' : '🔄 Task perlu direvisi')

      if (data.isApproved) {
        addCoins(30)
        const newCoins = state.coins + 30
        const newTasksDone = state.tasksDone + 1
        setState(prev => ({ ...prev, tasksDone: newTasksDone, step: 10 }))
        setCanGoDay2(true)

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
            fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                profile: { ...profile, experience: [...(profile?.experience || []).filter(e => e.id !== 'kantoran-sim'), simExp] }
              })
            }).catch(console.error)
          }
        }

        setTimeout(() => {
          addMsg('jnr', { role: 'npc', npcId: 'jnr', text: `${state.firstName}! Denger-denger task pertamamu approved ya — selamat! Aku dulu sampe minggu kedua baru approved wkwk` })
          setTimeout(() => {
            addMsg('sup_chat', {
              role: 'npc', npcId: 'sup',
              text: `Good work hari ini ${state.firstName}. Sudah jam 5, bisa pulang dulu. Besok standup jam 9 — ada task lanjutan yang perlu kita bahas.`
            })
            addMsg('sup_chat', {
              role: 'action',
              data: {
                label: 'Selesai untuk hari ini — Lanjut ke Hari Kedua',
                nextStep: 99,
                type: 'day_done',
                coins: newCoins,
                tasksDone: newTasksDone,
              }
            })
            showNotif('sup_chat', POSITIONS[state.position]?.supervisor.name || 'Supervisor', 'Hari pertama selesai! Ada pesan dari supervisor.')
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
    { id: 'hr_office',   icon: '🔥', label: 'HR Office',    locked: false },
    { id: 'slack',       icon: '💬', label: 'Slack',        locked: state.phaseUnlocked < 1 },
    { id: 'meeting',     icon: '🪑', label: 'Meeting',      locked: state.phaseUnlocked < 1 },
    { id: 'sup_chat',    icon: '👤', label: 'Supervisor',   locked: state.phaseUnlocked < 1 },
    { id: 'workspace',   icon: '🖥️', label: 'Workspace',   locked: state.phaseUnlocked < 1 },
    { id: 'file_manager',icon: '📁', label: 'File Manager', locked: state.step < 5 },
    { id: 'pantry',      icon: '☕', label: 'Pantry',       locked: state.phaseUnlocked < 1 },
  ]

  const canChat = ['hr_office', 'sup_chat', 'mgr_chat', 'pantry', 'slack'].includes(view)

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

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
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-[#E5E3DC] bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]"></div>
          <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
        </div>

        <div className="flex items-center gap-2 bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-3 py-1 text-xs font-medium text-[#0F6E56]">
          <span>📍</span>
          <span>{rooms.find(r => r.id === view)?.label || 'Kantoran'}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#FAEEDA] border border-[#854F0B]/15 rounded-full px-3 py-1 text-xs font-semibold text-[#854F0B]">
            🪙 {state.coins}
          </div>
          <button onClick={handleRestart} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] transition-colors">
            🔄 Restart
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

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Sidebar */}
        <div className="w-[210px] bg-white border-r border-[#E5E3DC] flex flex-col flex-shrink-0 overflow-hidden">
          <div className="p-3 pb-2 border-b border-[#E5E3DC] flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">Tim Kamu</p>

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
            <div className="flex flex-col gap-0.5">
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
                  { n: state.step >= 4 ? state.step - 3 : '—', l: 'Hari kerja' },
                  { n: state.bgRole || '—', l: 'Posisi', small: true },
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

        {/* Profile panel overlay */}
        {showProfile && (
          <div className="w-[280px] bg-white border-r border-[#E5E3DC] flex flex-col flex-shrink-0 overflow-hidden">
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

          {/* Inbox view — rendered outside the scroll container so it controls its own layout */}
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
              {view !== 'workspace' && (state.chatHistory[view] || []).map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  state={state}
                  pos={pos}
                  onNextStep={handleNextStep}
                  onViewChange={setView}
                />
              ))}

              {/* Empty state */}
              {view !== 'workspace' && (state.chatHistory[view] || []).length === 0 && (
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
                {view === 'pantry' ? '☕ Pantry — tempat gosip dan ngobrol santai' : '💬 Ketik bebas — NPC merespons dengan AI'}
              </p>
            </div>
          )}
        </div>
      </div>
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
    file_manager:{ initials: '📁', avClass: 'av-amber', name: 'File Manager', status: 'File task & dokumen kerja', tag: '', tagBg: '' },
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
    pantry: 'Datang ke pantry dan mulai ngobrol — bisa gosip soal kantor juga!',
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

function MessageBubble({ msg, state, pos, onNextStep, onViewChange }: {
  msg: Message; state: SimState; pos?: typeof POSITIONS[string];
  onNextStep: (step: number, data?: Record<string, unknown>) => void;
  onViewChange: (view: string) => void;
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
      return (
        <div className="animate-messageIn bg-gradient-to-br from-[#E1F5EE] to-[#d4f5e9] border border-[#0F6E56]/20 rounded-xl p-4">
          <p className="text-sm font-bold text-[#0F6E56] mb-1">Hari pertama selesai!</p>
          <p className="text-xs text-[#444441] mb-3 leading-relaxed">
            Kamu sudah merasakan bagaimana kerja nyata di Kantoran — interview, nego gaji, onboarding, dan task pertama yang direview supervisor AI.
          </p>
          <div className="bg-white/70 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-[#0F6E56] mb-1">Di Kantoran versi lengkap, kamu bisa:</p>
            <div className="flex flex-col gap-1">
              {['Lanjut ke hari ke-2, 3, hingga 90 hari', 'Task makin kompleks dan lintas departemen', 'Performance review dan kenaikan jabatan', 'Surat referensi kerja dari PT Vantara Nusantara'].map(item => (
                <div key={item} className="flex gap-1.5 text-xs text-[#444441]">
                  <span className="text-[#0F6E56]">→</span>
                  <span>{item}</span>
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
            Daftar Waitlist & Lanjutkan Karir →
          </button>
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
            ⬇️ Download {String(d.file)}
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
          Di Kantoran penuh, kamu jalani 3 bulan simulasi — task makin kompleks, situasi tak terduga, promosi, dan surat referensi kerja nyata.
          <br /><br />Kamu sudah kumpulkan <strong>{coins} Kantor Coin</strong> hari ini 🪙
        </p>
        <button
          onClick={() => window.open('https://kantoran.vercel.app', '_blank')}
          style={{ cursor: 'pointer' }}
          className="btn-teal text-sm"
        >
          Daftar Waitlist — Lanjutkan Karir →
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
      {/* Email list */}
      <div className={`flex flex-col border-r border-[#E5E3DC] flex-shrink-0 overflow-y-auto ${selectedId ? 'w-72' : 'flex-1'}`}>
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
                    ✍️ Tanda Tangan & Terima Offer →
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
                      <p className="text-sm font-bold text-[#166534] mb-1">✅ Kontrak Berhasil Ditandatangani</p>
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

      {/* Upload area */}
      <div className="bg-white border border-[#E5E3DC] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#111111] mb-3">📤 Upload Hasil Kerja</p>

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
              <p className="text-xs text-[#0F6E56] font-medium">✅ File berhasil dibaca — siap direview AI</p>
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
          {isSubmitting ? 'Sedang direview oleh AI...' : 'Submit ke Supervisor untuk Review →'}
        </button>
      )}

      {/* Review result in workspace */}
      {reviewResult && (
        <div className={`border rounded-xl p-4 ${reviewResult.isApproved ? 'bg-[#DCFCE7] border-[#166534]/20' : 'bg-[#FAEEDA] border-[#854F0B]/20'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${reviewResult.isApproved ? 'text-[#166534]' : 'text-[#854F0B]'}`}>
            {reviewResult.isApproved ? '✅ TASK APPROVED' : '🔄 REVISION NEEDED'}
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

// ── ONBOARDING ────────────────────────────────────
function OnboardingFlow({ user, step, setStep, state, setState, onComplete }: {
  user: User; step: number; setStep: (n: number) => void;
  state: SimState; setState: (s: SimState) => void;
  onComplete: (s: SimState) => void;
}) {
  const [name, setName] = useState(user.user_metadata?.full_name?.split(' ')[0] || '')
  const [bg, setBg] = useState<BackgroundType | ''>('')
  const [pos, setPos] = useState('')
  const [exp, setExp] = useState('')
  const [mot, setMot] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const BACKGROUNDS_LIST = [
    { key: 'fresh_grad' as BackgroundType, label: 'Fresh Graduate', icon: '🎓', desc: 'Baru lulus, belum punya pengalaman kerja kantoran', role: 'Intern' },
    { key: 'jobseeker' as BackgroundType, label: 'Job Seeker', icon: '🔍', desc: 'Aktif mencari kerja, sudah punya sedikit pengalaman', role: 'Junior' },
    { key: 'career_switch' as BackgroundType, label: 'Career Switcher', icon: '🔄', desc: 'Sudah kerja di bidang lain, ingin pindah karir', role: 'Mid-Level' },
    { key: 'student' as BackgroundType, label: 'Mahasiswa Tingkat Akhir', icon: '📚', desc: 'Masih kuliah, butuh pengalaman kerja lebih awal', role: 'Intern Magang' },
  ]

  const handleSubmit = async () => {
    setSubmitting(true)
    const position = POSITIONS[pos]
    const bgRole = position?.getRole(bg) || ''
    const finalState: SimState = {
      ...INITIAL,
      firstName: name,
      email: user.email || '',
      background: bg,
      bgRole,
      position: pos,
      experience: exp,
      motivation: mot,
      step: 0,
    }
    setState(finalState)
    setStep(5)
    setTimeout(() => {
      setSubmitting(false)
      onComplete(finalState)
    }, 2000)
  }

  if (step === 5) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-6">
      <div className="text-center animate-fadeUp">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="font-serif text-xl font-bold text-[#111111] mb-2">Lamaran terkirim!</h2>
        <p className="text-sm text-[#888780] mb-4">Sinta sedang mereview lamaranmu...</p>
        <div className="flex gap-2 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56] dot-bounce"></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#0F6E56]"></div>
      <div className="w-full max-w-md animate-fadeUp">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F6E56]"></div>
          <span className="font-serif text-2xl font-bold text-[#111111]">Kantoran</span>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < step ? 'bg-[#1D9E75]' : i === step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E3DC]">

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Selamat datang 👋</h2>
              <p className="text-sm text-[#888780] mb-6">Kamu akan melamar kerja di perusahaan fiktif dan merasakan prosesnya dari awal.</p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Nama lengkap</label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-4 py-3 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] mb-4"
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
              />
              <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()} style={{ cursor: name.trim() ? 'pointer' : 'not-allowed' }} className="btn-teal w-full">Lanjut →</button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Kamu saat ini...</h2>
              <p className="text-sm text-[#888780] mb-4">Ini menentukan posisi yang kamu lamar dan cara NPC berinteraksi.</p>
              <div className="flex flex-col gap-2 mb-4">
                {BACKGROUNDS_LIST.map(b => (
                  <button key={b.key} onClick={() => setBg(b.key)} style={{ cursor: 'pointer' }}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${bg === b.key ? 'border-[#0F6E56] bg-[#E1F5EE]' : 'border-[#E5E3DC] hover:border-[#0F6E56]'}`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{b.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[#111111]">{b.label}</p>
                      <p className="text-xs text-[#888780] mt-0.5">{b.desc}</p>
                      <p className="text-xs font-medium text-[#0F6E56] mt-1">→ Melamar sebagai {b.role}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => bg && setStep(3)} disabled={!bg} style={{ cursor: bg ? 'pointer' : 'not-allowed' }} className="btn-teal w-full">Lanjut →</button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <button onClick={() => setStep(2)} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Mau lamar posisi apa?</h2>
              <p className="text-sm text-[#888780] mb-4">Setiap posisi punya tim NPC, interview, dan task yang berbeda.</p>
              <div className="flex flex-col gap-2 mb-4">
                {Object.entries(POSITIONS).map(([key, p]) => (
                  <button key={key} onClick={() => setPos(key)} style={{ cursor: 'pointer' }}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${pos === key ? 'border-[#0F6E56] bg-[#E1F5EE]' : 'border-[#E5E3DC] hover:border-[#0F6E56]'}`}
                  >
                    <span className="text-xl flex-shrink-0">{p.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[#111111]">{p.title}</p>
                      <p className="text-xs text-[#888780] mt-0.5">{p.dept}</p>
                      <p className="text-xs font-medium text-[#0F6E56] mt-1">→ {p.getRole(bg)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => pos && setStep(4)} disabled={!pos} style={{ cursor: pos ? 'pointer' : 'not-allowed' }} className="btn-teal w-full">Lanjut →</button>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div>
              <button onClick={() => setStep(3)} style={{ cursor: 'pointer' }} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-xl font-bold text-[#111111] mb-1">
                Apply: {POSITIONS[pos]?.getRole(bg)} {POSITIONS[pos]?.title}
              </h2>
              <p className="text-sm text-[#888780] mb-4">PT Vantara Nusantara membuka lowongan. Lengkapi lamaranmu.</p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Pengalaman terkait (opsional)</label>
              <textarea value={exp} onChange={e => setExp(e.target.value)}
                placeholder="Pernah buat laporan di kampus, project, kursus online, magang..."
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] resize-none min-h-[70px] mb-3"
              />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Kenapa melamar posisi ini?</label>
              <textarea value={mot} onChange={e => setMot(e.target.value)}
                placeholder="Ceritakan motivasimu secara singkat..."
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] resize-none min-h-[70px] mb-4"
              />
              <button onClick={handleSubmit} disabled={submitting} style={{ cursor: submitting ? 'not-allowed' : 'pointer' }} className="btn-teal w-full">
                {submitting ? 'Mengirim...' : 'Kirim Lamaran →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
