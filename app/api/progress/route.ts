import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, getServiceClient } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = getServiceClient()

    const body = await req.json()
    const { progress } = body

    if (!progress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        first_name: progress.firstName,
        email: progress.email,
        background: progress.background,
        bg_role: progress.bgRole,
        position: progress.position,
        step: progress.step,
        coins: progress.coins,
        tasks_done: progress.tasksDone,
        streak: progress.streak,
        last_active: new Date().toISOString(),
        chat_history: progress.chatHistory || {},
        task_submissions: progress.taskSubmissions || {},
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('Progress save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await getServiceClient()
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ progress: data || null })

  } catch (error) {
    console.error('Progress load error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
