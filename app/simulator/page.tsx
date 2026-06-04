'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import LoginPage from '@/components/LoginPage'
import ProfileSetup from '@/components/ProfileSetup'
import JobListing from '@/components/JobListing'
import SimulatorApp from '@/components/SimulatorApp'
import WishlistForm from '@/components/WishlistForm'
import type { UserProfile } from '@/lib/profile'
import type { BackgroundType } from '@/lib/positions'

type AppStage =
  | 'loading'
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        setStage('login')
        return
      }
      // Check if user has a profile
      try {
        const res = await fetch(`/api/profile?userId=${u.id}`)
        const { profile: existingProfile } = await res.json()
        if (existingProfile && existingProfile.full_name) {
          setProfile(existingProfile)
          // Check if they have an ongoing simulation
          const progressRes = await fetch(`/api/progress?userId=${u.id}`)
          const { progress } = await progressRes.json()
          if (progress && progress.step > 0 && progress.step < 10) {
            setBackground(progress.background || '')
            setSelectedPosition(progress.position || '')
            setStage('simulator')
          } else if (progress && progress.step >= 10) {
            setStage('wishlist')
          } else {
            setStage('job_listing')
          }
        } else {
          setStage('profile_setup')
        }
      } catch {
        setStage('profile_setup')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (!u) setStage('login')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (stage === 'loading') return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF7' }}>
      <div className="flex gap-2">
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
        <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce" />
      </div>
    </div>
  )

  if (stage === 'login' || !user) return <LoginPage />

  if (stage === 'profile_setup') return (
    <ProfileSetup
      user={user}
      onComplete={(p) => {
        setProfile(p)
        setStage('job_listing')
      }}
    />
  )

  if (stage === 'job_listing') return (
    <JobListing
      background={background}
      onApply={(positionId) => {
        setSelectedPosition(positionId)
        // Background will be set in onboarding
        setStage('simulator')
      }}
    />
  )

  if (stage === 'wishlist') return (
    <WishlistForm
      user={user}
      positionTried={selectedPosition}
      firstName={profile?.full_name?.split(' ')[0] || 'Kamu'}
      coins={simCoins}
      tasksDone={simTasksDone}
    />
  )

  // simulator
  return (
    <SimulatorApp
      user={user}
      userProfile={profile}
      initialPosition={selectedPosition}
      onWishlist={(coins, tasksDone) => {
        setSimCoins(coins)
        setSimTasksDone(tasksDone)
        setStage('wishlist')
      }}
    />
  )
}
