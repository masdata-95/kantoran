'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { POSITIONS, BACKGROUNDS, SALARY_RANGE, type BackgroundType } from '@/lib/positions'

interface Message {
  id: string
  type: 'npc' | 'user' | 'system' | 'learn' | 'feedback' | 'action' | 'email' | 'task' | 'workspace' | 'cliff'
  npcId?: string
  text?: string
  data?: Record<string, unknown>
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
  chatHistory: Record<string, Message[]>
  aiHistory: Record<string, { role: string; content: string }[]>
  taskSubmissions: Record<string, unknown>
  salaryOffered: number
  salaryExpectation: number
  interviewPhase: 'greeting' | 'background' | 'technical' | 'done'
}

const INITIAL_STATE: SimState = {
  firstName: '', email: '', background: '', bgRole: '', position: '',
  experience: '', motivation: '', step: 0, coins: 0, tasksDone: 0,
  streak: 0, phaseUnlocked: 0,
  chatHistory: {}, aiHistory: {}, taskSubmissions: {},
  salaryOffered: 0, salaryExpectation: 0,
  interviewPhase: 'greeting'
}

const NPC_COLORS: Record<string, string> = {
  sinta: 'av-teal', sup: 'av-blue', mgr: 'av-purple', jnr: 'av-amber'
}

const NPC_INITIALS: Record<string, Record<string, string>> = {
  data_analyst: { sup: 'RP', mgr: 'DK', jnr: 'GA' },
  marketing_analyst: { sup: 'DP', mgr: 'BK', jnr: 'AL' },
  finance_analyst: { sup: 'AW', mgr: 'PH', jnr: 'NS' },
  hr_generalist: { sup: 'BR', mgr: 'TS', jnr: 'LL' },
  bizdev: { sup: 'RF', mgr: 'PA', jnr: 'MR' },
}

export default function SimulatorApp({ user }: { user: User }) {
  const [state, setState] = useState<SimState>(INITIAL_STATE)
  const [currentView, setCurrentView] = useState<string>('sinta')
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProgress, setIsLoadingProgress] = useState(true)
  const [onboardStep, setOnboardStep] = useState(1)
  const [showApp, setShowApp] = useState(false)
  const [taskSubmitText, setTaskSubmitText] = useState({ issues: '', impact: '', recommendation: '' })
  const [reviewResult, setReviewResult] = useState<{ review: string; isApproved: boolean } | null>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load progress on mount
  useEffect(() => {
    loadProgress()
  }, [user.id])

  // Auto-save progress every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.step > 0) saveProgress()
    }, 30000)
    return () => clearInterval(interval)
  }, [state])

  // Auto-scroll messages
  useEffect(() => {
    if (msgsRef.current) {
      setTimeout(() => {
        msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [state.chatHistory, currentView])

  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/progress?userId=${user.id}`)
      const { progress } = await res.json()
      if (progress && progress.step > 0) {
        setState(prev => ({
          ...prev,
          firstName: progress.first_name || '',
          email: progress.email || '',
          background: progress.background || '',
          bgRole: progress.bg_role || '',
          position: progress.position || '',
          step: progress.step || 0,
          coins: progress.coins || 0,
          tasksDone: progress.tasks_done || 0,
          streak: progress.streak || 0,
          phaseUnlocked: progress.step >= 4 ? 1 : 0,
          chatHistory: (progress.chat_history as Record<string, Message[]>) || {},
          taskSubmissions: (progress.task_submissions as Record<string, unknown>) || {},
        }))
        setShowApp(true)
      }
    } catch (e) {
      console.error('Load progress error:', e)
    } finally {
      setIsLoadingProgress(false)
    }
  }

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
            taskSubmissions: state.taskSubmissions,
          }
        })
      })
    } catch (e) {
      console.error('Save progress error:', e)
    }
  }, [state, user])

  const addMessage = useCallback((viewId: string, msg: Omit<Message, 'id'>) => {
    const newMsg: Message = { ...msg, id: Date.now() + Math.random().toString() }
    setState(prev => ({
      ...prev,
      chatHistory: {
        ...prev.chatHistory,
        [viewId]: [...(prev.chatHistory[viewId] || []), newMsg]
      }
    }))
    return newMsg
  }, [])

  const addCoins = useCallback((amount: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + amount }))
  }, [])

  const callChat = async (npcId: string, userMessage: string, currentHistory?: { role: string; content: string }[]) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId,
          messages: currentHistory || state.aiHistory[npcId] || [],
          userContext: {
            firstName: state.firstName,
            email: state.email || user.email,
            background: state.background,
            bgRole: state.bgRole,
            position: state.position,
            experience: state.experience,
            motivation: state.motivation,
          },
          positionId: state.position,
        })
      })
      const data = await res.json()
      return data.reply as string
    } catch {
      return `Maaf ${state.firstName}, ada gangguan koneksi. Coba lagi ya!`
    } finally {
      setIsLoading(false)
    }
  }

  const updateAiHistory = useCallback((npcId: string, role: 'user' | 'assistant', content: string) => {
    setState(prev => {
      const history = prev.aiHistory[npcId] || []
      const updated = [...history, { role, content }]
      const trimmed = updated.length > 20 ? updated.slice(-16) : updated
      return { ...prev, aiHistory: { ...prev.aiHistory, [npcId]: trimmed } }
    })
  }, [])

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return
    const msg = inputText.trim()
    setInputText('')

    addMessage(currentView, { type: 'user', text: msg })
    updateAiHistory(currentView, 'user', msg)

    const npcMap: Record<string, string> = {
      sinta: 'sinta', sup: 'sup', mgr: 'mgr', jnr: 'jnr', group: 'jnr'
    }
    const npcId = npcMap[currentView] || 'sinta'
    const history = [...(state.aiHistory[npcId] || []), { role: 'user' as const, content: msg }]

    const reply = await callChat(npcId, msg, history)
    addMessage(currentView, { type: 'npc', npcId, text: reply })
    updateAiHistory(npcId, 'assistant', reply)
    addCoins(2)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleLogout = async () => {
    await saveProgress()
    await supabase.auth.signOut()
  }

  const pos = POSITIONS[state.position]
  const currentMessages = state.chatHistory[currentView] || []

  // Show loading
  if (isLoadingProgress) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAFAF7]">
        <div className="text-center">
          <div className="flex gap-2 justify-center mb-3">
            <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
          </div>
          <p className="text-sm text-[#888780]">Memuat progress kamu...</p>
        </div>
      </div>
    )
  }

  // Show onboarding if not started
  if (!showApp) {
    return (
      <OnboardingFlow
        user={user}
        onboardStep={onboardStep}
        setOnboardStep={setOnboardStep}
        state={state}
        setState={setState}
        onComplete={(finalState) => {
          setState(finalState)
          setShowApp(true)
          // Start step 0
          setTimeout(() => {
            runStep0(finalState, addMessage, addCoins)
          }, 500)
        }}
      />
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-[#E5E3DC] bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56]"></div>
          <span className="font-serif font-bold text-[#0F6E56]">Kantoran</span>
        </div>

        <div className="flex items-center gap-2 bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-full px-3 py-1 text-xs font-medium text-[#0F6E56]">
          <span>📍</span>
          <span className="max-w-[200px] truncate">
            {['Inbox','HR Office','HR Office','HR Office','Slack','Workspace','Meeting','Workspace','Notion','Workspace','Workspace','Lobby'][state.step] || 'Kantoran'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#FAEEDA] border border-[#854F0B]/15 rounded-full px-3 py-1 text-xs font-semibold text-[#854F0B]">
            🪙 {state.coins} Coin
          </div>
          <span className="text-xs text-[#888780]">Hari ke-{state.step >= 4 ? state.step - 3 : '-'}</span>
          <button onClick={handleLogout} className="text-xs text-[#888780] hover:text-[#111111] transition-colors">
            Keluar
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 h-1 bg-[#E5E3DC] flex-shrink-0">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 transition-all duration-300 ${
              i < state.step ? 'bg-[#1D9E75]' : i === state.step ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <Sidebar
          state={state}
          currentView={currentView}
          setCurrentView={setCurrentView}
          pos={pos}
        />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatHeader currentView={currentView} state={state} pos={pos} />

          {/* Messages */}
          <div ref={msgsRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {currentMessages.length === 0 && state.phaseUnlocked >= 1 && currentView !== 'sinta' && (
              <div className="text-center py-8 text-[#888780] text-sm">
                <div className="text-2xl mb-2">💬</div>
                Belum ada percakapan. Kirim pesan pertama!
              </div>
            )}
            {currentMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                state={state}
                pos={pos}
                taskSubmitText={taskSubmitText}
                setTaskSubmitText={setTaskSubmitText}
                reviewResult={reviewResult}
                onSubmitTask={async () => {
                  const submission = `Issue yang ditemukan: ${taskSubmitText.issues}\n\nDampak bisnis: ${taskSubmitText.impact}\n\nRekomendasi: ${taskSubmitText.recommendation}`
                  if (!taskSubmitText.issues || taskSubmitText.issues.length < 20) {
                    alert('Isi bagian "Issue yang ditemukan" dulu ya.')
                    return
                  }
                  setIsLoading(true)
                  try {
                    const res = await fetch('/api/review', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        positionId: state.position,
                        userContext: { firstName: state.firstName, background: state.background, bgRole: state.bgRole, position: state.position },
                        submission
                      })
                    })
                    const data = await res.json()
                    setReviewResult({ review: data.review, isApproved: data.isApproved })
                    setCurrentView('sup')
                    addMessage('sup', { type: 'npc', npcId: 'sup', text: data.review })
                    if (data.isApproved) {
                      addCoins(30)
                      setState(prev => ({ ...prev, tasksDone: prev.tasksDone + 1, step: 11 }))
                      setTimeout(() => {
                        addMessage('sup', {
                          type: 'feedback',
                          data: { type: 'good', label: '✅ TASK APPROVED', text: 'Hasil kerja kamu sudah memenuhi standar. Task ini selesai!' }
                        })
                        setTimeout(() => runStep11(state, addMessage), 1000)
                      }, 500)
                    } else {
                      addMessage('sup', {
                        type: 'feedback',
                        data: { type: 'neutral', label: '🔄 REVISION NEEDED', text: 'Ada hal yang perlu diperbaiki. Kembali ke tab Submit dan update jawabanmu.' }
                      })
                    }
                  } catch {
                    addMessage('sup', { type: 'npc', npcId: 'sup', text: 'Ada gangguan koneksi saat review. Coba submit lagi ya.' })
                  } finally {
                    setIsLoading(false)
                  }
                }}
                onNextStep={(nextStep) => {
                  setState(prev => ({ ...prev, step: nextStep }))
                  if (nextStep === 1) runStep1(state, setState, addMessage, addCoins, callChat, updateAiHistory)
                  if (nextStep === 2) runStep2(state, setState, addMessage, addCoins)
                  if (nextStep === 3) runStep3(state, setState, addMessage, addCoins, callChat, updateAiHistory)
                  if (nextStep === 4) runStep4(state, setState, addMessage, addCoins)
                  if (nextStep === 5) runStep5(state, setState, addMessage, addCoins)
                  if (nextStep === 6) runStep6(state, setState, addMessage, addCoins)
                  if (nextStep === 7) runStep7(state, setState, addMessage, addCoins)
                  if (nextStep === 8) runStep8(state, setState, addMessage, addCoins)
                }}
              />
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 animate-messageIn">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${NPC_COLORS[currentView] || 'av-teal'}`}>
                  {currentView === 'sinta' ? 'SM' : pos ? (NPC_INITIALS[state.position]?.[currentView] || '?') : '?'}
                </div>
                <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E5E3DC] dot-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E5E3DC] dot-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E5E3DC] dot-bounce"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          {(currentView === 'sinta' || state.phaseUnlocked >= 1) && (
            <div className="border-t border-[#E5E3DC] bg-white p-3 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={`Ketik pesan...`}
                  rows={1}
                  className="flex-1 resize-none px-3 py-2.5 border border-[#E5E3DC] rounded-lg text-sm text-[#111111] bg-[#FAFAF7] outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 disabled:opacity-40 disabled:bg-[#F1EFE8] transition-all duration-150 min-h-[42px] max-h-[120px]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputText.trim()}
                  className="w-10 h-10 rounded-lg bg-[#0F6E56] text-white flex items-center justify-center hover:bg-[#085041] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex-shrink-0"
                >
                  ➤
                </button>
              </div>
              <p className="text-xs text-[#888780] mt-1.5 ml-1">
                💬 Ketik bebas atau pilih opsi — NPC merespons dengan AI
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── STEP RUNNERS ──────────────────────────────────

function runStep0(
  state: SimState,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return

  setTimeout(() => {
    addMessage('sinta', {
      type: 'email',
      data: {
        subject: `Undangan Seleksi — ${state.bgRole} ${pos.title}`,
        from: 'sinta@vantara.co.id',
        to: state.email,
        body: `Halo ${state.firstName}, terima kasih sudah melamar posisi ${state.bgRole} ${pos.title}. Kami mengundang kamu ke tahap seleksi. Format: interview + tes teknikal, estimasi 15-20 menit.`
      }
    })

    setTimeout(() => {
      addMessage('sinta', {
        type: 'npc',
        npcId: 'sinta',
        text: `Halo ${state.firstName}! 👋 Saya Sinta, HR Business Partner Vantara. Senang bisa kenalan — santai aja ya, ini lebih ke ngobrol dan kenalan, bukan ujian formal.`
      })
      addMessage('sinta', {
        type: 'learn',
        data: {
          icon: '💡',
          title: 'Tips Sebelum Interview',
          body: 'Yang paling dicari bukan jawaban "sempurna" — tapi kejujuran, cara berpikir, dan kemauan belajar. Kalau tidak tahu sesuatu, bilang tidak tahu lalu tunjukkan mau cari tahu.',
          tip: 'Bersikap natural jauh lebih baik dari bersikap perfect.'
        }
      })
      addMessage('sinta', {
        type: 'action',
        data: { label: 'Mulai Seleksi', nextStep: 1 }
      })
    }, 1500)
  }, 600)
}

function runStep1(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void,
  callChat: (npcId: string, msg: string, history?: { role: string; content: string }[]) => Promise<string>,
  updateAiHistory: (npcId: string, role: 'user' | 'assistant', content: string) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return

  setState(prev => ({ ...prev, step: 1, interviewPhase: 'greeting' }))

  setTimeout(() => {
    addMessage('sinta', {
      type: 'npc',
      npcId: 'sinta',
      text: `Oke ${state.firstName}, kita mulai ya! Sebelum masuk ke pertanyaan, boleh cerita dulu — siapa kamu, latar belakangnya apa, dan kenapa tertarik sama posisi ${pos.title} di Vantara?`
    })
    setState(prev => ({ ...prev, interviewPhase: 'background' }))
  }, 800)
}

function runStep2(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return
  const salaryRange = SALARY_RANGE[state.background]

  setState(prev => ({ ...prev, step: 2, salaryOffered: salaryRange.offer }))

  setTimeout(() => {
    addMessage('sinta', {
      type: 'npc',
      npcId: 'sinta',
      text: `${state.firstName}, selamat — kamu lolos seleksi! 🎉 Kamu akan bergabung sebagai ${state.bgRole} di departemen ${pos.dept}. Supervisor langsungmu adalah ${pos.supervisor.name}.`
    })

    setTimeout(() => {
      addMessage('sinta', {
        type: 'learn',
        data: {
          icon: '💡',
          title: 'Fakta tentang Negosiasi Gaji',
          body: '76% fresh grad tidak pernah negosiasi gaji pertama. Padahal 85% perusahaan menyiapkan ruang untuk diskusi.',
          tip: 'Negosiasi yang baik justru menunjukkan self-worth yang sehat.'
        }
      })

      setTimeout(() => {
        addMessage('sinta', {
          type: 'npc',
          npcId: 'sinta',
          text: `Sebelum saya tunjukkan Offering Letter-nya, boleh saya tanya dulu — ekspektasi gaji kamu untuk posisi ini berapa? Ini tidak mempengaruhi penerimaan kamu, saya hanya ingin tahu range yang kamu harapkan.`
        })
      }, 1000)
    }, 800)
  }, 800)
}

function runStep3(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void,
  callChat: (npcId: string, msg: string, history?: { role: string; content: string }[]) => Promise<string>,
  updateAiHistory: (npcId: string, role: 'user' | 'assistant', content: string) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return
  const salaryRange = SALARY_RANGE[state.background]

  setState(prev => ({ ...prev, step: 3 }))

  // Show offering letter
  setTimeout(() => {
    addMessage('sinta', {
      type: 'email',
      data: {
        subject: `Offering Letter — ${state.bgRole} ${pos.title}`,
        isOffering: true,
        salary: salaryRange.offer,
        position: `${state.bgRole} ${pos.title}`,
        dept: pos.dept,
        supervisor: `${pos.supervisor.name} — ${pos.supervisor.role}`,
        mealAllowance: 600000,
        transportAllowance: 400000,
        probation: '3 bulan dengan evaluasi',
        workSystem: 'Hybrid — WFO 3x/minggu',
      }
    })

    setTimeout(() => {
      addMessage('sinta', {
        type: 'npc',
        npcId: 'sinta',
        text: `Ini Offering Letter-nya. Dibaca dulu ya — ada semua detailnya di sana. Kalau ada yang mau didiskusikan sebelum tanda tangan, feel free!`
      })
    }, 600)
  }, 800)
}

function runStep4(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return

  setState(prev => ({ ...prev, step: 4, phaseUnlocked: 1 }))

  // Group channel welcome
  setTimeout(() => {
    addMessage('group', { type: 'system', text: `Kamu ditambahkan ke #${pos.dept.toLowerCase().replace(/[^a-z]/g, '-')}` })
    addMessage('group', { type: 'npc', npcId: 'sinta', text: `Hai tim! 👋 Perkenalkan anggota baru kita — ${state.firstName}, ${state.bgRole} ${pos.title} yang mulai hari ini. Disambut ya!` })

    setTimeout(() => {
      addMessage('group', { type: 'npc', npcId: 'sup', text: `Welcome ${state.firstName}. Saya ${pos.supervisor.name}, supervisor langsungmu. Brief task pertama sudah saya siapkan. Standup besok jam 9.` })

      setTimeout(() => {
        addMessage('group', { type: 'npc', npcId: 'jnr', text: `Heyy welcome welcome!! 🙌 Saya ${pos.junior.name} — masuk beberapa bulan lebih awal tapi masih sering bingung juga haha. Kalau mau tanya-tanya soal kehidupan di sini, DM aku aja ya!` })

        addMessage('group', {
          type: 'action',
          data: { label: 'Lanjut ke Hari ke-2', nextStep: 5 }
        })
      }, 1500)
    }, 1200)
  }, 800)
}

function runStep5(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  setState(prev => ({ ...prev, step: 5 }))
  setTimeout(() => {
    addMessage('sup', { type: 'npc', npcId: 'sup', text: `Morning. Standup sebentar, 2 menit per orang. ${state.firstName}, hari ini rencananya apa?` })
    addMessage('sup', {
      type: 'learn',
      data: {
        icon: '📢', title: 'Format Daily Standup',
        body: 'Format standar: (1) Dikerjakan kemarin, (2) Akan dikerjakan hari ini, (3) Ada hambatan? Jawab konkret dan singkat.',
        tip: 'Di Vantara, standup yang molor dianggap tidak respek waktu orang lain.'
      }
    })
    addMessage('sup', { type: 'action', data: { label: 'Lanjut ke Task Brief', nextStep: 6 } })
  }, 800)
}

function runStep6(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return
  setState(prev => ({ ...prev, step: 6 }))

  setTimeout(() => {
    addMessage('sup', {
      type: 'task',
      data: {
        num: 1, title: pos.taskTitle, deadline: 'Besok jam 09.00',
        dept: `Dept. ${pos.dept}`, body: pos.taskBody, ctx: pos.taskContext
      }
    })
    addMessage('sup', { type: 'action', data: { label: 'Buka Task di Workspace', nextStep: 7 } })
  }, 800)
}

function runStep7(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  const pos = POSITIONS[state.position]
  if (!pos) return
  setState(prev => ({ ...prev, step: 7 }))

  setTimeout(() => {
    addMessage('sup', { type: 'npc', npcId: 'sup', text: `File ada di sana. Preview data tersedia langsung, bisa juga download file Excel-nya kalau mau kerja di luar. Submit di tab Submit kalau sudah selesai.` })
    addMessage('sup', { type: 'workspace', data: { positionId: state.position } })

    setTimeout(() => {
      addMessage('jnr', {
        type: 'npc', npcId: 'jnr',
        text: `Psst ${state.firstName} — dari pengalaman aku, baca dulu semua data sebelum mulai isi form. Kak ${pos.supervisor.name?.split(' ')[0]} lumayan strict soal kualitas 😅`
      })
    }, 3000)
  }, 800)
}

function runStep8(
  state: SimState,
  setState: React.Dispatch<React.SetStateAction<SimState>>,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
  addCoins: (n: number) => void
) {
  setState(prev => ({ ...prev, step: 8 }))
}

function runStep11(
  state: SimState,
  addMessage: (viewId: string, msg: Omit<Message, 'id'>) => Message,
) {
  const pos = POSITIONS[state.position]
  if (!pos) return

  setTimeout(() => {
    addMessage('jnr', {
      type: 'npc', npcId: 'jnr',
      text: `${state.firstName}! Task pertama kamu approved — selamat! Itu achievement yang bagus buat hari pertama. Aku dulu sampai minggu kedua baru approved hahaha 😅`
    })
    setTimeout(() => {
      addMessage('jnr', {
        type: 'cliff',
        data: { coins: state.coins + 30 }
      })
    }, 1000)
  }, 500)
}

// ── SUB-COMPONENTS ────────────────────────────────

function Sidebar({ state, currentView, setCurrentView, pos }: {
  state: SimState
  currentView: string
  setCurrentView: (v: string) => void
  pos?: typeof POSITIONS[string]
}) {
  const isLocked = state.phaseUnlocked < 1

  const rooms = [
    { id: 'inbox', icon: '📧', label: 'Inbox', locked: false },
    { id: 'hr', icon: '✍️', label: 'HR Office', locked: false },
    { id: 'slack', icon: '💬', label: 'Slack', locked: isLocked },
    { id: 'meeting', icon: '🪑', label: 'Meeting Room', locked: isLocked },
    { id: 'workspace', icon: '🖥️', label: 'Workspace', locked: isLocked },
    { id: 'pantry', icon: '☕', label: 'Pantry', locked: isLocked },
    { id: 'notion', icon: '📁', label: 'File Manager', locked: isLocked },
  ]

  return (
    <div className="w-[210px] bg-white border-r border-[#E5E3DC] flex flex-col flex-shrink-0 overflow-hidden">
      <div className="p-3 pb-2 border-b border-[#E5E3DC] flex-shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">Tim Kamu</p>

        {/* Sinta */}
        <button
          onClick={() => setCurrentView('sinta')}
          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left mb-1 ${
            currentView === 'sinta' ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'hover:bg-[#FAFAF7]'
          }`}
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full av-teal flex items-center justify-center text-[10px] font-semibold">SM</div>
            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border-2 border-white"></div>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#111111] truncate">Sinta Maharani</p>
            <p className="text-[10px] text-[#888780] truncate">HR Business Partner</p>
          </div>
        </button>

        {/* Team NPCs */}
        {pos && ['sup', 'mgr', 'jnr'].map((npcId) => {
          const npc = npcId === 'sup' ? pos.supervisor : npcId === 'mgr' ? pos.manager : pos.junior
          const locked = isLocked
          const initials = NPC_INITIALS[state.position]?.[npcId] || '??'

          return (
            <button
              key={npcId}
              onClick={() => !locked && setCurrentView(npcId)}
              className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left mb-1 ${
                locked ? 'opacity-40 cursor-not-allowed' :
                currentView === npcId ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'hover:bg-[#FAFAF7]'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${npc.avClass}`}>
                  {initials}
                </div>
                {!locked && <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${npc.statusDot} border-2 border-white`}></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#111111] truncate">{npc.name}</p>
                <p className="text-[10px] text-[#888780] truncate">{npc.role.split('·')[0].trim()}</p>
              </div>
              {locked && <span className="text-[10px] text-[#888780] flex-shrink-0">🔒</span>}
            </button>
          )
        })}

        {/* Group channel */}
        {!isLocked && pos && (
          <button
            onClick={() => setCurrentView('group')}
            className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
              currentView === 'group' ? 'bg-[#E1F5EE] border border-[#0F6E56]/20' : 'hover:bg-[#FAFAF7]'
            }`}
          >
            <div className="w-8 h-8 rounded-full av-teal flex items-center justify-center text-sm">🏢</div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#111111] truncate">#{pos.dept.toLowerCase().replace(/[^a-z]/g, '-').substring(0, 14)}</p>
              <p className="text-[10px] text-[#888780]">Group channel</p>
            </div>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">Ruangan</p>
        <div className="flex flex-col gap-0.5">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => !room.locked && setCurrentView(room.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                room.locked ? 'opacity-40 cursor-not-allowed text-[#888780]' :
                currentView === room.id ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium' :
                'text-[#888780] hover:bg-[#FAFAF7] hover:text-[#111111]'
              }`}
            >
              <span className="text-sm">{room.icon}</span>
              <span className="truncate">{room.label}</span>
              {room.locked && <span className="ml-auto text-[10px]">🔒</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[#E5E3DC]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#888780] mb-2">Statistik</p>
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
  )
}

function ChatHeader({ currentView, state, pos }: {
  currentView: string
  state: SimState
  pos?: typeof POSITIONS[string]
}) {
  const getHeaderInfo = () => {
    if (currentView === 'sinta') return { initials: 'SM', avClass: 'av-teal', name: 'Sinta Maharani', status: '🟢 Online · HR Business Partner', tag: 'HR', tagBg: 'bg-[#E1F5EE] text-[#0F6E56]' }
    if (!pos) return { initials: '?', avClass: 'av-teal', name: 'NPC', status: '', tag: '', tagBg: '' }
    if (currentView === 'sup') return { initials: NPC_INITIALS[state.position]?.sup || '??', avClass: pos.supervisor.avClass, name: pos.supervisor.name, status: `${pos.supervisor.status} · ${pos.supervisor.role.split('·')[0].trim()}`, tag: 'Supervisor', tagBg: 'bg-[#E8F0FC] text-[#1A4A8A]' }
    if (currentView === 'mgr') return { initials: NPC_INITIALS[state.position]?.mgr || '??', avClass: pos.manager.avClass, name: pos.manager.name, status: `${pos.manager.status} · ${pos.manager.role}`, tag: 'Manager', tagBg: 'bg-[#F0EAF9] text-[#5B2D8E]' }
    if (currentView === 'jnr') return { initials: NPC_INITIALS[state.position]?.jnr || '??', avClass: pos.junior.avClass, name: pos.junior.name, status: `${pos.junior.status} · ${pos.junior.role.split('·')[0].trim()}`, tag: 'Junior', tagBg: 'bg-[#FAEEDA] text-[#854F0B]' }
    if (currentView === 'group') return { initials: '🏢', avClass: 'av-teal', name: `#${pos.dept.toLowerCase().replace(/[^a-z]/g, '-')}`, status: `4 anggota · Group channel`, tag: 'Group', tagBg: 'bg-[#E1F5EE] text-[#0F6E56]' }

    const roomNames: Record<string, string> = { inbox: '📧 Inbox', hr: '✍️ HR Office', slack: '💬 Slack', meeting: '🪑 Meeting Room', workspace: '🖥️ Workspace', pantry: '☕ Pantry', notion: '📁 File Manager' }
    return { initials: currentView[0]?.toUpperCase() || '?', avClass: 'av-teal', name: roomNames[currentView] || currentView, status: '', tag: '', tagBg: '' }
  }

  const h = getHeaderInfo()

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E5E3DC] bg-white flex-shrink-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${h.avClass}`}>
        {h.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111111] truncate">{h.name}</p>
        {h.status && <p className="text-xs text-[#888780] truncate">{h.status}</p>}
      </div>
      {h.tag && (
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${h.tagBg}`}>{h.tag}</span>
      )}
    </div>
  )
}

function MessageBubble({ msg, state, pos, taskSubmitText, setTaskSubmitText, reviewResult, onSubmitTask, onNextStep }: {
  msg: Message
  state: SimState
  pos?: typeof POSITIONS[string]
  taskSubmitText: { issues: string; impact: string; recommendation: string }
  setTaskSubmitText: React.Dispatch<React.SetStateAction<{ issues: string; impact: string; recommendation: string }>>
  reviewResult: { review: string; isApproved: boolean } | null
  onSubmitTask: () => Promise<void>
  onNextStep: (step: number) => void
}) {
  const npcColors: Record<string, string> = { sinta: 'av-teal', sup: 'av-blue', mgr: 'av-purple', jnr: 'av-amber' }
  const getNPCInitial = (npcId?: string) => {
    if (npcId === 'sinta') return 'SM'
    if (!state.position) return '?'
    return NPC_INITIALS[state.position]?.[npcId || ''] || '?'
  }
  const getNPCName = (npcId?: string) => {
    if (npcId === 'sinta') return 'Sinta Maharani'
    if (!pos) return 'NPC'
    if (npcId === 'sup') return pos.supervisor.name
    if (npcId === 'mgr') return pos.manager.name
    if (npcId === 'jnr') return pos.junior.name
    return 'NPC'
  }

  if (msg.type === 'user') return (
    <div className="flex justify-end animate-messageIn">
      <div className="max-w-[80%] bg-[#0F6E56] text-white rounded-[8px_0_8px_8px] px-3 py-2.5 text-sm leading-relaxed">
        {msg.text}
      </div>
    </div>
  )

  if (msg.type === 'npc') return (
    <div className="flex gap-2 animate-messageIn">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5 ${npcColors[msg.npcId || 'sinta'] || 'av-teal'}`}>
        {getNPCInitial(msg.npcId)}
      </div>
      <div className="max-w-[80%]">
        <p className="text-[10px] font-semibold text-[#888780] mb-1">{getNPCName(msg.npcId)}</p>
        <div className="bg-white border border-[#E5E3DC] rounded-[0_8px_8px_8px] px-3 py-2.5 text-sm leading-relaxed text-[#111111]"
          dangerouslySetInnerHTML={{ __html: msg.text?.replace(/<em>/g, '<span class="text-[#0F6E56] font-medium not-italic">').replace(/<\/em>/g, '</span>') || '' }}
        />
      </div>
    </div>
  )

  if (msg.type === 'system') return (
    <div className="flex justify-center animate-messageIn">
      <span className="bg-[#F1EFE8] rounded-full px-3 py-1 text-xs text-[#888780]">{msg.text}</span>
    </div>
  )

  if (msg.type === 'learn') {
    const d = msg.data || {}
    return (
      <div className="bg-gradient-to-br from-[#E1F5EE] to-[#d4f5e9] border border-[#0F6E56]/20 rounded-xl p-3 animate-messageIn">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">{String(d.icon ?? '')}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F6E56]">{String(d.title ?? '')}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#085041]">{String(d.body ?? '')}</p>
        {!!d.tip && <p className="mt-2 text-xs italic text-[#085041] bg-[#0F6E56]/10 rounded-lg px-2 py-1.5">💡 {String(d.tip)}</p>}
      </div>
    )
  }

  if (msg.type === 'feedback') {
    const d = msg.data || {}
    const colors: Record<string, string> = {
      good: 'bg-[#DCFCE7] border-[#166534]/20 text-[#166534]',
      neutral: 'bg-[#FAEEDA] border-[#854F0B]/20 text-[#854F0B]',
      bad: 'bg-[#FDECEA] border-[#8B1A1A]/20 text-[#8B1A1A]'
    }
    return (
      <div className={`border rounded-xl p-3 animate-messageIn ${colors[(d.type as string) || 'neutral']}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1">{d.label as string}</p>
        <p className="text-xs leading-relaxed">{d.text as string}</p>
      </div>
    )
  }

  if (msg.type === 'action') {
    const d = msg.data || {}
    return (
      <div className="animate-messageIn ml-10">
        <button
          onClick={() => onNextStep(d.nextStep as number)}
          className="btn-teal text-sm inline-flex items-center gap-2"
        >
          {d.label as string} →
        </button>
      </div>
    )
  }

  if (msg.type === 'email') {
    const d = msg.data || {}
    if (d.isOffering) {
      return (
        <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden animate-messageIn">
          <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] px-4 py-3">
            <p className="text-white font-semibold text-sm">PT Vantara Nusantara</p>
            <p className="text-white/80 text-xs">FMCG Personal Care · Jakarta Selatan</p>
          </div>
          <div className="px-4 py-3">
            <p className="font-semibold text-sm mb-1 text-[#111111]">SURAT PENAWARAN KERJA</p>
            <p className="text-xs text-[#888780] mb-3">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {[
              ['Posisi', d.position], ['Departemen', d.dept], ['Supervisor', d.supervisor],
              ['Gaji Pokok', `Rp ${(d.salary as number).toLocaleString('id-ID')} / bulan`, true],
              ['Tunjangan Makan', `Rp ${(d.mealAllowance as number).toLocaleString('id-ID')} / bulan`],
              ['Tunjangan Transport', `Rp ${(d.transportAllowance as number).toLocaleString('id-ID')} / bulan`],
              ['Masa Probasi', d.probation], ['Sistem Kerja', d.workSystem],
            ].map(([k, v, hl]) => (
              <div key={k as string} className="flex justify-between py-1.5 border-b border-[#E5E3DC] last:border-0 text-xs">
                <span className="text-[#888780]">{k as string}</span>
                <span className={`font-medium ${hl ? 'text-[#0F6E56] text-sm font-bold' : 'text-[#111111]'}`}>{v as string}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden animate-messageIn">
        <div className="bg-[#F1EFE8] px-3 py-2 border-b border-[#E5E3DC]">
          <p className="text-xs text-[#888780]"><strong className="text-[#111111]">Dari:</strong> Sinta Maharani &lt;sinta@vantara.co.id&gt;</p>
          <p className="text-xs text-[#888780]"><strong className="text-[#111111]">Ke:</strong> {state.email}</p>
          <p className="text-xs text-[#888780]"><strong className="text-[#111111]">Subjek:</strong> {d.subject as string}</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#111111]">{d.body as string}</p>
        </div>
      </div>
    )
  }

  if (msg.type === 'task') {
    const d = msg.data || {}
    return (
      <div className="bg-white border-l-[3px] border-[#0F6E56] border border-[#E5E3DC] rounded-[0_8px_8px_0] p-3 animate-messageIn">
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider text-[#888780] mb-2 flex-wrap">
          <span>📋 Task #{String((d.num as number) ?? 0).padStart(2, '0')}</span>
          <span>⏰ {String(d.deadline ?? "")}</span>
          {!!d.dept && <span>🔗 {String(d.dept ?? "")}</span>}
        </div>
        <p className="text-sm font-medium text-[#0F6E56] mb-1.5">{String(d.title ?? "")}</p>
        <p className="text-xs leading-relaxed text-[#111111]" dangerouslySetInnerHTML={{ __html: String(d.body ?? "") }} />
        {!!d.ctx && <p className="mt-2 text-xs text-[#888780] italic">{String(d.ctx ?? "")}</p>}
      </div>
    )
  }

  if (msg.type === 'workspace') {
    const posId = (msg.data?.positionId as string) || state.position
    const currentPos = POSITIONS[posId]
    if (!currentPos) return null

    return (
      <WorkspacePanel
        pos={currentPos}
        taskSubmitText={taskSubmitText}
        setTaskSubmitText={setTaskSubmitText}
        onSubmitTask={onSubmitTask}
        reviewResult={reviewResult}
      />
    )
  }

  if (msg.type === 'cliff') {
    const coins = (msg.data?.coins as number) || state.coins
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
          className="btn-teal text-sm"
        >
          Daftar Waitlist — Lanjutkan Karir →
        </button>
      </div>
    )
  }

  return null
}

function WorkspacePanel({ pos, taskSubmitText, setTaskSubmitText, onSubmitTask, reviewResult }: {
  pos: typeof POSITIONS[string]
  taskSubmitText: { issues: string; impact: string; recommendation: string }
  setTaskSubmitText: React.Dispatch<React.SetStateAction<{ issues: string; impact: string; recommendation: string }>>
  onSubmitTask: () => Promise<void>
  reviewResult: { review: string; isApproved: boolean } | null
}) {
  const [activeTab, setActiveTab] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await onSubmitTask()
    setIsSubmitting(false)
  }

  const downloadExcel = () => {
    // Link to file in public folder
    const link = document.createElement('a')
    link.href = `/tasks/${pos.taskFile}`
    link.download = pos.taskFile
    link.click()
  }

  const dataPreview = getDataPreview(pos.title)

  const tabs = ['📊 Data Preview', '💾 Download', '📝 Submit']

  return (
    <div className="bg-white border border-[#E5E3DC] rounded-xl overflow-hidden animate-messageIn">
      <div className="flex border-b border-[#E5E3DC] bg-[#F1EFE8] overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border-b-2 ${
              activeTab === i ? 'bg-white text-[#0F6E56] border-[#0F6E56]' : 'text-[#888780] border-transparent hover:text-[#111111]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {activeTab === 0 && (
          <div className="p-3">
            <p className="text-xs text-[#888780] mb-2">{dataPreview.desc}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {dataPreview.headers.map(h => (
                      <th key={h} className="bg-[#F1EFE8] px-2 py-1.5 text-left font-semibold border border-[#E5E3DC] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataPreview.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1.5 border border-[#E5E3DC]"
                          dangerouslySetInnerHTML={{ __html: cell }}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 p-2 bg-[#E1F5EE] rounded-lg text-xs text-[#085041]">
              {dataPreview.note}
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="p-4 text-center">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm font-medium text-[#111111] mb-1">{pos.taskFile}</p>
            <p className="text-xs text-[#888780] mb-4">Kerjakan di Excel atau Google Sheets, lalu submit hasilnya di tab Submit.</p>
            <button onClick={downloadExcel} className="btn-teal text-sm inline-flex items-center gap-2">
              ⬇️ Download File Excel
            </button>
            <p className="text-xs text-[#888780] mt-3">Setelah selesai, kembali ke tab Submit untuk mengirim hasilmu.</p>
          </div>
        )}

        {activeTab === 2 && (
          <div className="p-3">
            {reviewResult ? (
              <div className={`p-3 rounded-lg text-sm ${reviewResult.isApproved ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
                <p className="font-bold text-xs uppercase tracking-wide mb-1">
                  {reviewResult.isApproved ? '✅ APPROVED' : '🔄 REVISION NEEDED'}
                </p>
                <p className="text-xs leading-relaxed">{reviewResult.review}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444441] mb-1">
                    Issue yang kamu temukan (spesifik — baris berapa, jenis apa) *
                  </label>
                  <textarea
                    value={taskSubmitText.issues}
                    onChange={(e) => setTaskSubmitText(prev => ({ ...prev, issues: e.target.value }))}
                    placeholder="Contoh: Format tanggal tidak konsisten di baris 2, region null di baris 3 dan 8..."
                    className="w-full p-2.5 border border-[#E5E3DC] rounded-lg text-xs resize-none min-h-[70px] focus:border-[#0F6E56] outline-none focus:ring-2 focus:ring-[#0F6E56]/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#444441] mb-1">
                    Dampak ke bisnis kalau dibiarkan
                  </label>
                  <textarea
                    value={taskSubmitText.impact}
                    onChange={(e) => setTaskSubmitText(prev => ({ ...prev, impact: e.target.value }))}
                    placeholder="Contoh: Total revenue akan salah hitung, laporan ke Marketing tidak akurat..."
                    className="w-full p-2.5 border border-[#E5E3DC] rounded-lg text-xs resize-none min-h-[60px] focus:border-[#0F6E56] outline-none focus:ring-2 focus:ring-[#0F6E56]/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#444441] mb-1">
                    Rekomendasi tindak lanjut
                  </label>
                  <textarea
                    value={taskSubmitText.recommendation}
                    onChange={(e) => setTaskSubmitText(prev => ({ ...prev, recommendation: e.target.value }))}
                    placeholder="Contoh: Standarisasi format tanggal, investigasi order dengan revenue Rp 0..."
                    className="w-full p-2.5 border border-[#E5E3DC] rounded-lg text-xs resize-none min-h-[60px] focus:border-[#0F6E56] outline-none focus:ring-2 focus:ring-[#0F6E56]/10"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !taskSubmitText.issues || taskSubmitText.issues.length < 20}
                  className="btn-teal text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Mengirim...' : 'Submit ke Supervisor →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getDataPreview(posTitle: string): {
  desc: string
  headers: string[]
  rows: string[][]
  note: string
} {
  if (posTitle.includes('Data Analyst')) return {
    desc: 'Data penjualan Lumière Jan 2026 — Preview 8 baris dari 342',
    headers: ['order_id', 'tanggal', 'region', 'SKU', 'qty', 'revenue'],
    rows: [
      ['ORD-001', '2026-01-05', 'Jakarta', 'LM-SERUM-30ML', '12', 'Rp 2.400.000'],
      ['ORD-002', '<span class="text-amber-600 font-medium">05/01/2026 ⚠️</span>', 'Surabaya', 'LM-TONER', '8', 'Rp 960.000'],
      ['ORD-003', '2026-01-07', '<span class="text-red-600 font-medium">NULL ❌</span>', 'LM-SERUM-50ML', '5', 'Rp 1.750.000'],
      ['ORD-004', '2026-01-08', 'Bandung', 'LM-MOISTURIZER', '3', '<span class="text-red-600 font-medium">Rp 0 ❌</span>'],
      ['<span class="text-amber-600 font-medium">ORD-002 ⚠️</span>', '2026-01-09', 'Surabaya', 'LM-TONER', '8', 'Rp 960.000'],
      ['ORD-005', '2026-01-10', 'Medan', 'LM-EYE-CREAM', '6', 'Rp 1.800.000'],
      ['ORD-006', '2026-01-11', 'Jakarta', '<span class="text-amber-600 font-medium">lm-serum ⚠️</span>', '9', 'Rp 1.800.000'],
      ['ORD-007', '<span class="text-amber-600 font-medium">12-01-2026 ⚠️</span>', 'Bali', 'LM-SERUM-30ML', '4', 'Rp 800.000'],
    ],
    note: '⚠️ Preview 8 baris dari 342. Download file Excel untuk analisis lengkap.'
  }

  if (posTitle.includes('Marketing')) return {
    desc: 'Campaign Performance Lumière Q4 2025 — 6 campaign',
    headers: ['Campaign', 'Channel', 'Budget', 'Impresi', 'Klik', 'Konversi', 'CTR%', 'Conv.%'],
    rows: [
      ['LM-Oct-IG', 'Instagram', 'Rp 15jt', '125.000', '3.750', '187', '<span class="text-green-600">3,0%</span>', '<span class="text-green-600">4,99%</span>'],
      ['LM-Nov-TikTok', 'TikTok', 'Rp 25jt', '280.000', '4.200', '63', '<span class="text-amber-600">1,5%</span>', '<span class="text-red-600">1,50% ⚠️</span>'],
      ['LM-Nov-Google', 'Google Ads', 'Rp 20jt', '45.000', '2.700', '189', '<span class="text-green-600">6,0%</span>', '<span class="text-green-600">7,0%</span>'],
      ['LM-Dec-IG', 'Instagram', 'Rp 12jt', '95.000', '1.900', '57', '<span class="text-amber-600">2,0%</span>', '<span class="text-amber-600">3,0%</span>'],
      ['<span class="text-red-600">LM-Dec-YT ❌</span>', 'YouTube', 'Rp 18jt', '210.000', '2.940', '88', '1,4%', '3,0%'],
      ['LM-Oct-Google', 'Google Ads', 'Rp 8jt', '32.000', '2.240', '156', '<span class="text-green-600">7,0%</span>', '<span class="text-green-600">6,96%</span>'],
    ],
    note: '⚠️ Ada campaign dengan data tidak lengkap. CTR = Klik/Impresi × 100% | Conv.Rate = Konversi/Klik × 100%'
  }

  if (posTitle.includes('Finance')) return {
    desc: 'Budget vs Actual Q4 2025 — 8 Departemen',
    headers: ['Departemen', 'Budget', 'Actual', 'Variance', '%'],
    rows: [
      ['Marketing & Brand', 'Rp 150jt', 'Rp 187jt', '<span class="text-red-600 font-medium">+Rp 37jt</span>', '<span class="text-red-600">+24,7%</span>'],
      ['Data & Analytics', 'Rp 45jt', 'Rp 42jt', '<span class="text-green-600">-Rp 3jt</span>', '<span class="text-green-600">-6,7%</span>'],
      ['Sales & Distribusi', 'Rp 200jt', 'Rp 231jt', '<span class="text-red-600 font-medium">+Rp 31jt</span>', '<span class="text-red-600">+15,5%</span>'],
      ['Human Resources', 'Rp 80jt', 'Rp 76jt', '<span class="text-green-600">-Rp 4jt</span>', '<span class="text-green-600">-5,0%</span>'],
      ['Operations', 'Rp 300jt', 'Rp 298jt', '<span class="text-green-600">-Rp 2jt</span>', '<span class="text-green-600">-0,7%</span>'],
      ['IT & Digital', 'Rp 75jt', 'Rp 91jt', '<span class="text-red-600 font-medium">+Rp 16jt</span>', '<span class="text-red-600">+21,3%</span>'],
      ['Finance & Accounting', 'Rp 60jt', 'Rp 58jt', '<span class="text-green-600">-Rp 2jt</span>', '<span class="text-green-600">-3,3%</span>'],
      ['Legal & Compliance', 'Rp 30jt', 'Rp 30jt', 'Rp 0', '0%'],
    ],
    note: '⚠️ Identifikasi departemen dengan overspending terbesar dan buat ringkasan untuk CFO.'
  }

  if (posTitle.includes('HR')) return {
    desc: '5 Kandidat Junior Data Analyst — Batch 1',
    headers: ['Kandidat', 'Pendidikan', 'Pengalaman Data', 'Komunikasi', 'Status'],
    rows: [
      ['Rina S.', 'S1 Statistika UI', 'Magang 3 bln, Excel & SQL', 'Sangat rapi', '<span class="text-green-600">✓ Lolos</span>'],
      ['Dodi P.', 'D3 Akuntansi', 'Excel biasa', 'Cukup, ada typo', '<span class="text-amber-600">⚠️ Perlu dikaji</span>'],
      ['Maya L.', 'S1 Informatika ITS', 'Python, SQL, Google DA cert', 'Sangat structured', '<span class="text-green-600">✓ Strong</span>'],
      ['<span class="text-red-600">Eko W. ❌</span>', '<span class="text-red-600 font-medium">SMA ❌</span>', 'Tidak ada', 'Biasa', '<span class="text-red-600">❌ Gugur</span>'],
      ['Sari A.', 'S1 Manajemen Unpad', 'Tugas akhir analisis, Tableau', 'Baik', '<span class="text-green-600">✓ Lolos</span>'],
    ],
    note: '⚠️ Rubrik: Pendidikan min D3 = must-have. Pengalaman Data = 40%, Komunikasi = 30%, Relevansi = 30%'
  }

  return {
    desc: '6 Calon Distributor Regional PT Vantara Nusantara',
    headers: ['Perusahaan', 'Wilayah', 'Track Record', 'Kapasitas', 'Rev/thn'],
    rows: [
      ['PT Maju Bersama', 'Sulawesi (5 kota)', '<span class="text-green-600">Excellent — 8thn</span>', 'High', 'Rp 2,1M'],
      ['CV Sinar Nusa', 'Kalimantan (3 kota)', '<span class="text-amber-600">Good — 1x late pay</span>', 'Medium', 'Rp 850jt'],
      ['PT Andalan Dist.', 'Papua & Maluku', '<span class="text-green-600">Very Good — 5thn</span>', 'High', 'Rp 1,4M'],
      ['<span class="text-red-600">UD Berkah Jaya ❌</span>', 'NTT & NTB', '<span class="text-red-600 font-medium">Poor — 3x dispute ❌</span>', 'Low', 'Rp 450jt'],
      ['PT Timur Cemerlang', 'Sulawesi Utara', '<span class="text-green-600">Good — 6thn</span>', 'Medium', 'Rp 920jt'],
      ['CV Prima Distribusi', 'Kalimantan Utara', '<span class="text-amber-600">Good — 1 minor</span>', 'Medium', 'Rp 680jt'],
    ],
    note: '⚠️ Kriteria: Track Record (35%) | Coverage (25%) | Kapasitas (20%) | Financial Health (20%)'
  }
}

// ── ONBOARDING FLOW ────────────────────────────────
function OnboardingFlow({ user, onboardStep, setOnboardStep, state, setState, onComplete }: {
  user: User
  onboardStep: number
  setOnboardStep: React.Dispatch<React.SetStateAction<number>>
  state: SimState
  setState: React.Dispatch<React.SetStateAction<SimState>>
  onComplete: (state: SimState) => void
}) {
  const [localName, setLocalName] = useState(user.user_metadata?.full_name?.split(' ')[0] || '')
  const [localBg, setLocalBg] = useState<BackgroundType | ''>('')
  const [localPos, setLocalPos] = useState('')
  const [localExp, setLocalExp] = useState('')
  const [localMot, setLocalMot] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const progSteps = ['Info', 'Latar Belakang', 'Posisi', 'Lamaran']

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const pos = POSITIONS[localPos]
    const bgRole = pos?.getRole(localBg) || ''
    const finalState: SimState = {
      ...INITIAL_STATE,
      firstName: localName,
      email: user.email || '',
      background: localBg,
      bgRole,
      position: localPos,
      experience: localExp,
      motivation: localMot,
      step: 0,
    }
    setState(finalState)
    setTimeout(() => {
      setIsSubmitting(false)
      onComplete(finalState)
    }, 3500)
    setOnboardStep(5) // submitted state
  }

  if (onboardStep === 5) {
    return (
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
          <p className="text-xs text-[#888780] mt-3">Biasanya 1-2 hari kerja. Di Kantoran: beberapa detik 😄</p>
        </div>
      </div>
    )
  }

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
          {progSteps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                i + 1 < onboardStep ? 'bg-[#1D9E75]' : i + 1 === onboardStep ? 'bg-[#0F6E56]' : 'bg-[#E5E3DC]'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E3DC]">
          {/* Step 1: Name */}
          {onboardStep === 1 && (
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Selamat datang 👋</h2>
              <p className="text-sm text-[#888780] mb-6">Kamu akan melamar kerja di perusahaan fiktif dan merasakan prosesnya dari awal.</p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Nama lengkap</label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-4 py-3 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 mb-4 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && localName.trim() && setOnboardStep(2)}
              />
              <button
                onClick={() => localName.trim() && setOnboardStep(2)}
                disabled={!localName.trim()}
                className="btn-teal w-full"
              >
                Lanjut →
              </button>
            </div>
          )}

          {/* Step 2: Background */}
          {onboardStep === 2 && (
            <div>
              <button onClick={() => setOnboardStep(1)} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Kamu saat ini...</h2>
              <p className="text-sm text-[#888780] mb-4">Ini menentukan posisi yang kamu lamar dan cara NPC berinteraksi.</p>
              <div className="flex flex-col gap-2 mb-4">
                {(Object.entries(BACKGROUNDS) as [BackgroundType, typeof BACKGROUNDS[BackgroundType]][]).map(([key, bg]) => (
                  <button
                    key={key}
                    onClick={() => setLocalBg(key)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                      localBg === key ? 'border-[#0F6E56] bg-[#E1F5EE]' : 'border-[#E5E3DC] hover:border-[#0F6E56] bg-white'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{bg.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[#111111]">{bg.label}</p>
                      <p className="text-xs text-[#888780] mt-0.5">{bg.desc}</p>
                      <p className="text-xs font-medium text-[#0F6E56] mt-1">→ Akan melamar sebagai {bg.role}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => localBg && setOnboardStep(3)} disabled={!localBg} className="btn-teal w-full">Lanjut →</button>
            </div>
          )}

          {/* Step 3: Position */}
          {onboardStep === 3 && (
            <div>
              <button onClick={() => setOnboardStep(2)} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-2xl font-bold text-[#111111] mb-1">Mau lamar posisi apa?</h2>
              <p className="text-sm text-[#888780] mb-4">Setiap posisi punya tim NPC, interview, dan task yang berbeda.</p>
              <div className="flex flex-col gap-2 mb-4">
                {Object.entries(POSITIONS).map(([key, p]) => {
                  const role = p.getRole(localBg)
                  return (
                    <button
                      key={key}
                      onClick={() => setLocalPos(key)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                        localPos === key ? 'border-[#0F6E56] bg-[#E1F5EE]' : 'border-[#E5E3DC] hover:border-[#0F6E56] bg-white'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{p.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[#111111]">{p.title}</p>
                        <p className="text-xs text-[#888780] mt-0.5">{p.dept}</p>
                        <p className="text-xs font-medium text-[#0F6E56] mt-1">→ Melamar sebagai {role}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => localPos && setOnboardStep(4)} disabled={!localPos} className="btn-teal w-full">Lanjut →</button>
            </div>
          )}

          {/* Step 4: Apply form */}
          {onboardStep === 4 && (
            <div>
              <button onClick={() => setOnboardStep(3)} className="text-xs text-[#888780] hover:text-[#0F6E56] mb-4 flex items-center gap-1">← Kembali</button>
              <h2 className="font-serif text-xl font-bold text-[#111111] mb-1">
                Apply: {POSITIONS[localPos]?.getRole(localBg)} {POSITIONS[localPos]?.title}
              </h2>
              <p className="text-sm text-[#888780] mb-4">PT Vantara Nusantara membuka lowongan. Lengkapi lamaranmu.</p>

              {/* Job post */}
              <div className="bg-[#FAFAF7] border border-[#E5E3DC] rounded-xl p-3 mb-4">
                <p className="text-sm font-semibold text-[#0F6E56]">{POSITIONS[localPos]?.icon} {POSITIONS[localPos]?.getRole(localBg)} {POSITIONS[localPos]?.title}</p>
                <p className="text-xs text-[#888780] mt-0.5 mb-2">📍 Jakarta Selatan · Hybrid</p>
                <ul className="list-disc list-inside">
                  {POSITIONS[localPos]?.reqs.map(r => (
                    <li key={r} className="text-xs text-[#444441] leading-relaxed">{r}</li>
                  ))}
                </ul>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Pengalaman terkait (opsional)</label>
              <textarea
                value={localExp}
                onChange={(e) => setLocalExp(e.target.value)}
                placeholder="Pernah buat laporan di kampus, project, kursus online, magang..."
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 resize-none min-h-[70px] mb-3 transition-all"
              />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#888780] mb-1.5">Kenapa melamar posisi ini?</label>
              <textarea
                value={localMot}
                onChange={(e) => setLocalMot(e.target.value)}
                placeholder="Ceritakan motivasimu secara singkat..."
                className="w-full px-3 py-2.5 border border-[#E5E3DC] rounded-xl text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10 resize-none min-h-[70px] mb-4 transition-all"
              />
              <button onClick={handleSubmit} disabled={isSubmitting} className="btn-teal w-full">
                {isSubmitting ? 'Mengirim...' : 'Kirim Lamaran →'}
              </button>
              <p className="text-xs text-[#888780] text-center mt-2">Setelah submit, HR Vantara akan menghubungi kamu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
