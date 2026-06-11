import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/serverAuth'

export const maxDuration = 30
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File terlalu besar (maks 8MB)' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    const buf = Buffer.from(await file.arrayBuffer())
    let text = ''

    if (name.endsWith('.pdf')) {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buf))
      const out = await extractText(pdf, { mergePages: true })
      text = Array.isArray(out.text) ? out.text.join('\n') : out.text
    } else if (name.endsWith('.docx')) {
      const mammoth = (await import('mammoth')).default
      const out = await mammoth.extractRawText({ buffer: buf })
      text = out.value
    } else if (name.endsWith('.txt')) {
      text = buf.toString('utf8')
    } else {
      return NextResponse.json({ error: 'Format tidak didukung. Pakai PDF, DOCX, atau TXT.' }, { status: 400 })
    }

    text = text.replace(/\n{3,}/g, '\n\n').trim()
    if (text.length < 30) {
      return NextResponse.json({ error: 'Teks CV tidak terbaca dari file. Coba tempel manual atau pakai file lain.' }, { status: 422 })
    }

    return NextResponse.json({ text: text.slice(0, 12000) })
  } catch (error) {
    console.error('CV extract error:', error)
    return NextResponse.json({ error: 'Gagal membaca file. Coba file lain atau tempel manual.' }, { status: 500 })
  }
}
