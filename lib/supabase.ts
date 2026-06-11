import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// fetch dengan Authorization header (Supabase access token) — wajib untuk semua /api/*
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  // hanya set JSON untuk body string; FormData biar browser yang set multipart boundary
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}

export type Database = {
  public: {
    Tables: {
      user_progress: {
        Row: {
          id: string
          user_id: string
          first_name: string
          email: string
          background: string
          bg_role: string
          position: string
          step: number
          coins: number
          tasks_done: number
          streak: number
          last_active: string
          chat_history: Record<string, unknown>
          task_submissions: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_progress']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_progress']['Insert']>
      }
    }
  }
}
