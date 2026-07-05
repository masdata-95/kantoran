// Multi-provider AI with smart fallback
// Gemini (paid, primary) → Groq (fallback) → OpenRouter (last resort)

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

export interface AIOptions {
  maxTokens?: number      // default 250
  temperature?: number    // default 0.85; pakai 0.3 untuk output JSON
  json?: boolean          // structured output (response_format / responseMimeType)
  clean?: boolean         // default true; otomatis false saat json
  deadlineMs?: number     // total budget semua provider, default 25000 (< maxDuration 30s)
}

export interface AIResult {
  text: string
  provider: 'gemini' | 'groq' | 'openrouter'
}

interface CallConfig {
  maxTokens: number
  temperature: number
  json: boolean
}

// ── GEMINI (PRIMARY — paid) ──────────────────────
const GEMINI_TIMEOUT_MS = 12000

async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
  cfg: CallConfig
): Promise<string | null> {
  const key = getNextGeminiKey()
  if (!key) return null

  // Convert OpenAI format to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  try {
    // gemini-2.0-flash-exp & seluruh keluarga 2.0 sudah di-shutdown per 1 Juni 2026 — pakai 2.5-flash
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

    const res = await fetch(url, {
      method: 'POST',
      // Key di header, bukan query string — query string gampang bocor lewat log/proxy
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: cfg.maxTokens,
          temperature: cfg.temperature,
          // 2.5-flash default-nya "thinking" — matikan agar token output tidak habis untuk reasoning
          thinkingConfig: { thinkingBudget: 0 },
          ...(cfg.json ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ]
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
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

// ── GROQ (FALLBACK) ──────────────────────────────
const GROQ_TIMEOUT_MS = 8000

async function callGroq(
  messages: ChatMessage[],
  systemPrompt: string,
  cfg: CallConfig
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
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        ...(cfg.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS)
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

// ── OPENROUTER (LAST RESORT) ─────────────────────
const OPENROUTER_TIMEOUT_MS = 8000

async function callOpenRouter(
  messages: ChatMessage[],
  systemPrompt: string,
  cfg: CallConfig
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
        // 'openrouter/free' bukan model ID valid — pakai model :free konkret + fallback berantai
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        models: [
          'meta-llama/llama-3.3-70b-instruct:free',
          'deepseek/deepseek-chat-v3-0324:free',
          'qwen/qwen3-235b-a22b:free',
        ],
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        ...(cfg.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS)
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

// ── MAIN ENTRY ───────────────────────────────────
// Urutan: Gemini (paid) → Groq → OpenRouter.
// Return null saat SEMUA provider gagal — route yang menentukan pesan ke user.
// Deadline budget mencegah rantai fallback melewati maxDuration serverless.
export async function callAI(
  messages: ChatMessage[],
  systemPrompt: string,
  opts: AIOptions = {}
): Promise<AIResult | null> {
  const maxTokens = opts.maxTokens ?? 250
  const temperature = opts.temperature ?? (opts.json ? 0.3 : 0.85)
  const json = opts.json ?? false
  const clean = json ? false : (opts.clean ?? true)
  const deadline = Date.now() + (opts.deadlineMs ?? 25000)

  const cfg: CallConfig = { maxTokens, temperature, json }
  const finish = (text: string): string => (clean ? cleanResponse(text) : text)
  const timeLeft = () => deadline - Date.now()

  // Gemini dulu (paid, primary)
  for (let attempt = 0; attempt < Math.min(Math.max(GEMINI_KEYS.length, 1), 2); attempt++) {
    if (timeLeft() < GEMINI_TIMEOUT_MS) break
    const result = await callGemini(messages, systemPrompt, cfg)
    if (result) return { text: finish(result), provider: 'gemini' }
  }

  // Groq (fallback)
  for (let attempt = 0; attempt < Math.min(GROQ_KEYS.length, 2); attempt++) {
    if (timeLeft() < GROQ_TIMEOUT_MS) break
    const result = await callGroq(messages, systemPrompt, cfg)
    if (result) return { text: finish(result), provider: 'groq' }
  }

  // Last resort: OpenRouter
  if (timeLeft() >= OPENROUTER_TIMEOUT_MS) {
    const orResult = await callOpenRouter(messages, systemPrompt, cfg)
    if (orResult) return { text: finish(orResult), provider: 'openrouter' }
  }

  console.error('ALL PROVIDERS FAILED')
  return null
}

// Clean markdown artifacts + buang tanda dash (terlihat seperti tulisan AI).
// Di-export karena dipakai juga untuk membersihkan field teks hasil JSON (mis. feedback review).
export function cleanResponse(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')            // *italic* → italic
    .replace(/^#{1,6}\s+/gm, '')            // remove # headers
    .replace(/^\s*[-*]\s+/gm, '')           // buang bullet dash di awal baris
    .replace(/```[\s\S]*?```/g, '')         // remove code blocks
    .replace(/`(.+?)`/g, '$1')              // remove inline code
    // ── Hapus dash sebagai tanda baca, JANGAN sentuh kata majemuk (sehari-hari) ──
    .replace(/\s+[—–]\s+/g, ', ')           // spasi em/en dash spasi → koma
    .replace(/[—–]/g, ', ')                 // sisa em/en dash → koma
    .replace(/\s+-\s+/g, ', ')              // spasi hyphen spasi (dipakai sbg dash) → koma
    .replace(/\s*,\s*,/g, ',')              // bereskan koma dobel
    .replace(/,\s*([.!?])/g, '$1')          // koma sebelum titik/tanya → buang
    .replace(/[ \t]{2,}/g, ' ')             // rapikan spasi ganda
    .trim()
}
