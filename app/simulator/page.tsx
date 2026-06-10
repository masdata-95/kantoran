'use client'

import { useEffect, useState } from 'react'
import { supabase, authFetch } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import LoginPage from '@/components/LoginPage'
import OnboardingSlides from '@/components/OnboardingSlides'
import ProfileSetup from '@/components/ProfileSetup'
import JobListing from '@/components/JobListing'
import SimulatorApp from '@/components/SimulatorApp'
import WishlistForm from '@/components/WishlistForm'
import type { UserProfile } from '@/lib/profile'
import type { BackgroundType } from '@/lib/positions'

type AppStage =
  | 'loading'
  | 'onboarding'   // slides before login
  | 'login'
  | 'profile_setup'
  | 'job_listing'
  | 'simulator'
  | 'wishlist'

export default function SimulatorPage() {
  const [user, setUser] = useState<User | null>(null)
  const [stage, setStage] = useState<AppStage>('loading')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [background, setBackground] = useState<BackgroundType | ''>('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [simCoins, setSimCoins] = useState(0)
  const [simTasksDone, setSimTasksDone] = useState(0)

  useEffect(() => {
    initApp()
  }, [])

  const initApp = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user ?? null
    setUser(u)

    if (!u) {
      // Check if user has seen onboarding slides
      const seenOnboarding = localStorage.getItem('kantoran_onboarding_seen')
      setStage(seenOnboarding ? 'login' : 'onboarding')
      return
    }

    await checkUserState(u)

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)
      if (!newUser) {
        setStage('login')
      } else if (newUser.id !== u?.id) {
        // Different user logged in
        await checkUserState(newUser)
      }
    })
  }

  const checkUserState = async (u: User) => {
    try {
      // Check profile
      const profileRes = await authFetch('/api/profile')
      const { profile: existingProfile } = await profileRes.json()

      if (!existingProfile || !existingProfile.full_name) {
        setStage('profile_setup')
        return
      }

      setProfile(existingProfile)
      const bg = existingProfile.category || ''
      setBackground(bg as BackgroundType | '')

      // Check progress
      const progressRes = await authFetch('/api/progress')
      const { progress } = await progressRes.json()

      if (progress && progress.step > 0 && progress.step < 10) {
        // Has active simulation — continue
        setSelectedPosition(progress.position || '')
        setBackground((progress.background || bg) as BackgroundType | '')
        setStage('simulator')
      } else if (progress && progress.step >= 10) {
        // Simulation done — go to wishlist
        setSimCoins(progress.coins || 0)
        setSimTasksDone(progress.tasks_done || 0)
        setStage('wishlist')
      } else {
        // No active simulation — go to job listing
        setStage('job_listing')
      }
    } catch (e) {
      console.error('Check state error:', e)
      setStage('profile_setup')
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

  // Onboarding slides
  if (stage === 'onboarding') return (
    <OnboardingSlides
      onDone={() => {
        localStorage.setItem('kantoran_onboarding_seen', '1')
        setStage('login')
      }}
    />
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

  // Job listing
  if (stage === 'job_listing') return (
    <JobListing
      background={background}
      onApply={(positionId) => {
        setSelectedPosition(positionId)
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
    />
  )

  // Simulator
  return (
    <SimulatorApp
      user={user}
      userProfile={profile}
      initialPosition={selectedPosition}
      initialBackground={background}
      onWishlist={(coins, tasksDone) => {
        setSimCoins(coins)
        setSimTasksDone(tasksDone)
        setStage('wishlist')
      }}
    />
  )
}
