// Multi-provider AI with smart fallback
// Groq (primary) → Gemini (fallback) → OpenRouter (last resort)

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
  process.env.GROQ_API_KEY_5,
].filter(Boolean) as string[]

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean) as string[]

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

// Track which key was used last (round-robin)
let groqIndex = 0
let geminiIndex = 0

// Track failed keys with cooldown (60 seconds)
const failedKeys = new Map<string, number>()
const COOLDOWN_MS = 60 * 1000

function isKeyFailed(key: string): boolean {
  const failedAt = failedKeys.get(key)
  if (!failedAt) return false
  if (Date.now() - failedAt > COOLDOWN_MS) {
    failedKeys.delete(key)
    return false
  }
  return true
}

function markKeyFailed(key: string) {
  failedKeys.set(key, Date.now())
}

function getNextGroqKey(): string | null {
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[groqIndex]
    groqIndex = (groqIndex + 1) % GROQ_KEYS.length
    if (!isKeyFailed(key)) return key
  }
  return null
}

function getNextGeminiKey(): string | null {
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[geminiIndex]
    geminiIndex = (geminiIndex + 1) % GEMINI_KEYS.length
    if (!isKeyFailed(key)) return key
  }
  return null
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ── GROQ ─────────────────────────────────────────
async function callGroq(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const key = getNextGroqKey()
  if (!key) return null

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(8000)
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn(`Groq key failed (${res.status}):`, err.substring(0, 100))
      markKeyFailed(key)
      return null
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) {
      markKeyFailed(key)
      return null
    }

    console.log(`✓ Groq success (key index: ${groqIndex})`)
    return reply

  } catch (err) {
    console.warn(`Groq error:`, err)
    markKeyFailed(key)
    return null
  }
}

// ── GEMINI ───────────────────────────────────────
async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const key = getNextGeminiKey()
  if (!key) return null

  // Convert OpenAI format to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.85,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ]
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn(`Gemini key failed (${res.status}):`, err.substring(0, 100))
      markKeyFailed(key)
      return null
    }

    const data = await res.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) {
      markKeyFailed(key)
      return null
    }

    console.log(`✓ Gemini success (key index: ${geminiIndex})`)
    return reply

  } catch (err) {
    console.warn(`Gemini error:`, err)
    markKeyFailed(key)
    return null
  }
}

// ── OPENROUTER (LAST RESORT) ─────────────────────
async function callOpenRouter(
  messages: ChatMessage[],
  systemPrompt: string,
  maxTokens: number
): Promise<string | null> {
  if (!OPENROUTER_KEY) return null

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://kantoran.vercel.app',
        'X-Title': 'Kantoran',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: maxTokens,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

// ── MAIN ENTRY ───────────────────────────────────
export async function callAI(
  messages: ChatMessage[],
  systemPrompt: string,
  _npcId: string = 'sinta',
  maxTokens: number = 250
): Promise<string> {

  // Try Groq first (fastest, smartest free)
  for (let attempt = 0; attempt < Math.min(GROQ_KEYS.length, 3); attempt++) {
    const result = await callGroq(messages, systemPrompt, maxTokens)
    if (result) return cleanResponse(result)
  }

  // Try Gemini (fallback)
  for (let attempt = 0; attempt < Math.min(GEMINI_KEYS.length, 3); attempt++) {
    const result = await callGemini(messages, systemPrompt, maxTokens)
    if (result) return cleanResponse(result)
  }

  // Last resort: OpenRouter
  const orResult = await callOpenRouter(messages, systemPrompt, maxTokens)
  if (orResult) return cleanResponse(orResult)

  // All failed
  console.error('ALL PROVIDERS FAILED')
  return 'Maaf, ada gangguan koneksi sebentar. Coba kirim pesan lagi ya!'
}

// Clean markdown artifacts from response
function cleanResponse(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')      // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')           // *italic* → italic
    .replace(/^#{1,6}\s+/gm, '')           // remove # headers
    .replace(/^[-*]\s+/gm, '• ')           // bullets to dot
    .replace(/```[\s\S]*?```/g, '')        // remove code blocks
    .replace(/`(.+?)`/g, '$1')             // remove inline code
    .trim()
}

// Backward compatibility export
export const callOpenRouter_compat = callAI
