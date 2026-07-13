'use client'

import { useEffect, useState } from 'react'
import { supabase, authFetch } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import LoginPage from '@/components/LoginPage'
import ProfileSetup from '@/components/ProfileSetup'
import JobListing from '@/components/JobListing'
import SimulatorApp from '@/components/SimulatorApp'
import WishlistForm from '@/components/WishlistForm'
import type { UserProfile } from '@/lib/profile'
import type { BackgroundType, LevelType } from '@/lib/positions'

type AppStage =
  | 'loading'
  | 'login'
  | 'profile_setup'
  | 'job_listing'
  | 'simulator'
  | 'wishlist'

// Posisi yang sedang dibuka disimpan per-tab: refresh di tengah simulasi harus
// kembali ke simulasi, BUKAN ke hub. sessionStorage pas: bertahan saat refresh,
// bersih saat tab ditutup (kunjungan berikutnya tetap mendarat di hub).
const activePosKey = (uid: string) => `kantoran_active_pos_${uid}`

export default function SimulatorPage() {
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<AppStage>('loading')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [background, setBackground] = useState<BackgroundType | ''>('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<LevelType>('intern')
  const [simCoins, setSimCoins] = useState(0)
  const [simTasksDone, setSimTasksDone] = useState(0)
  const [simRecap, setSimRecap] = useState('')

  async function checkUserState(uid: string) {
    try {
      // Check profile
      const profileRes = await authFetch('/api/profile')
      const { profile: existingProfile } = await profileRes.json()

      if (!existingProfile || !existingProfile.full_name) {
        setStage('profile_setup')
        return
      }

      setProfile(existingProfile)
      setBackground((existingProfile.category || '') as BackgroundType | '')

      // Refresh di tengah simulasi → langsung resume posisi yang sedang dibuka
      try {
        const raw = sessionStorage.getItem(activePosKey(uid))
        if (raw) {
          const saved = JSON.parse(raw) as { position?: string; level?: LevelType }
          if (saved?.position) {
            setSelectedPosition(saved.position)
            if (saved.level) setSelectedLevel(saved.level)
            setStage('simulator')
            return
          }
        }
      } catch { /* sessionStorage tidak tersedia → ke hub seperti biasa */ }

      // Multi-role: job listing adalah hub karir — semua status run per posisi
      // ditampilkan di sana (Mulai / Lanjutkan / Selesai).
      setStage('job_listing')
    } catch (e) {
      console.error('Check state error:', e)
      setStage('profile_setup')
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const initApp = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user ?? null
      setUser(u)

      if (!u) {
        // Langsung ke login Google — onboarding slides dihilangkan
        setStage('login')
        return
      }

      await checkUserState(u.id)

      // Listen for auth changes — simpan subscription supaya bisa di-unsubscribe
      // (tanpa ini, remount menumpuk listener duplikat)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const newUser = session?.user ?? null
        setUser(newUser)
        if (!newUser) {
          setStage('login')
        } else if (newUser.id !== u?.id) {
          // Different user logged in
          await checkUserState(newUser.id)
        }
      })
      unsubscribe = () => subscription.unsubscribe()
    }

    initApp()
    return () => unsubscribe?.()
  }, [])

  // Selesai hari-1 sebuah posisi: form wishlist hanya sekali seumur akun,
  // setelah itu langsung balik ke hub karir untuk coba posisi lain
  const handleSimDone = async (coins: number, tasksDone: number, recap?: string) => {
    setSimCoins(coins)
    setSimTasksDone(tasksDone)
    if (recap) setSimRecap(recap)
    if (user) try { sessionStorage.removeItem(activePosKey(user.id)) } catch { /* abaikan */ }
    try {
      const res = await authFetch('/api/waitlist')
      const { submitted } = await res.json()
      setStage(submitted ? 'job_listing' : 'wishlist')
    } catch {
      setStage('wishlist')
    }
  }

  // Loading
  if (stage === 'loading') return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF7' }}>
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
      </div>
    </div>
  )

  // Login
  if (stage === 'login' || !user) return <LoginPage />

  // Profile setup
  if (stage === 'profile_setup') return (
    <ProfileSetup
      user={user}
      onComplete={(p) => {
        const profileWithCat = p as UserProfile & { category?: string }
        setProfile(p)
        setBackground((profileWithCat.category || '') as BackgroundType | '')
        setStage('job_listing')
      }}
    />
  )

  // Job listing — hub karir multi-role
  if (stage === 'job_listing') return (
    <JobListing
      background={background}
      onApply={(positionId, level) => {
        setSelectedPosition(positionId)
        setSelectedLevel(level)
        try { sessionStorage.setItem(activePosKey(user.id), JSON.stringify({ position: positionId, level })) } catch { /* abaikan */ }
        setStage('simulator')
      }}
    />
  )

  // Wishlist
  if (stage === 'wishlist') return (
    <WishlistForm
      user={user}
      positionTried={selectedPosition}
      firstName={profile?.full_name?.split(' ')[0] || 'Kamu'}
      coins={simCoins}
      tasksDone={simTasksDone}
      shareText={simRecap}
      onExplore={() => setStage('job_listing')}
    />
  )

  // Simulator
  return (
    <SimulatorApp
      user={user}
      userProfile={profile}
      initialPosition={selectedPosition}
      initialBackground={background}
      initialLevel={selectedLevel}
      onExit={() => {
        try { sessionStorage.removeItem(activePosKey(user.id)) } catch { /* abaikan */ }
        setStage('job_listing')
      }}
      onWishlist={handleSimDone}
    />
  )
}
