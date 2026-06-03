'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import LoginPage from '@/components/LoginPage'
import SimulatorApp from '@/components/SimulatorApp'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAFAF7]">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-[#0F6E56] dot-bounce"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <SimulatorApp user={user} />
}
