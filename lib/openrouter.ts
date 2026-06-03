// OpenRouter with auto-fallback to free models
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

// Model priority — free first, paid fallback
const FREE_MODELS = [
  'meta-llama/llama-3.1-70b-instruct:free',
  'google/gemini-flash-1.5:free',
  'microsoft/phi-3-medium-128k-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
]

const PAID_FALLBACK = 'anthropic/claude-haiku-4'

// NPC-specific model assignment
export const NPC_MODELS: Record<string, string[]> = {
  sinta:  FREE_MODELS,  // HR — most important, gets best available free
  sup:    FREE_MODELS,  // Supervisor — needs smart reasoning
  mgr:    FREE_MODELS,  // Manager — formal, needs consistency
  jnr:    FREE_MODELS,  // Junior — casual, any model works
  review: FREE_MODELS,  // Task review — needs accuracy
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function callOpenRouter(
  messages: ChatMessage[],
  systemPrompt: string,
  npcId: string = 'sinta',
  maxTokens: number = 250
): Promise<string> {
  const models = NPC_MODELS[npcId] || FREE_MODELS

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://kantoran.vercel.app',
          'X-Title': 'Kantoran — Simulasi Dunia Kerja',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0.85,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ]
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn(`Model ${model} failed:`, err?.error?.message || res.status)
        continue // try next model
      }

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content
      if (!reply) { continue }

      console.log(`✓ Used model: ${model}`)
      return reply

    } catch (err) {
      console.warn(`Model ${model} error:`, err)
      continue // try next model
    }
  }

  // All free models failed — try paid fallback
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://kantoran.vercel.app',
        'X-Title': 'Kantoran — Simulasi Dunia Kerja',
      },
      body: JSON.stringify({
        model: PAID_FALLBACK,
        max_tokens: maxTokens,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'Maaf, ada gangguan sebentar. Coba lagi ya.'
  } catch {
    return 'Maaf, ada gangguan koneksi. Coba lagi ya!'
  }
}
