// OpenRouter with auto-fallback to free models
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

// Model priority - free first, paid fallback
const FREE_MODELS = [
  'google/gemini-flash-1.5:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
]

const PAID_FALLBACK = 'anthropic/claude-haiku-4'

// NPC-specific model assignment
export const NPC_MODELS: Record<string, string[]> = {
  sinta: FREE_MODELS,
  sup: FREE_MODELS,
  mgr: FREE_MODELS,
  jnr: FREE_MODELS,
  review: FREE_MODELS,
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
      console.log('Trying model:', model)

      const res = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer':
              process.env.NEXT_PUBLIC_APP_URL ||
              'https://kantoran.vercel.app',
            'X-Title': 'Kantoran Simulasi Dunia Kerja'
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.85,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              ...messages
            ]
          })
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn(
          `Model ${model} failed:`,
          err?.error?.message || res.status
        )
        continue
      }

      const data = await res.json()

      const reply = data?.choices?.[0]?.message?.content

      if (!reply) {
        console.warn(`Model ${model} returned empty response`)
        continue
      }

      console.log(`Used model: ${model}`)
      return reply

    } catch (err) {
      console.error(`Model ${model} error:`, err)
      continue
    }
  }

  // All free models failed - try paid fallback
  try {
    console.log('Trying paid fallback model')

    const res = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL ||
            'https://kantoran.vercel.app',
          'X-Title': 'Kantoran Simulasi Dunia Kerja'
        },
        body: JSON.stringify({
          model: PAID_FALLBACK,
          max_tokens: maxTokens,
          temperature: 0.85,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...messages
          ]
        })
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Paid fallback failed:', err)
      return 'Maaf, AI sedang tidak tersedia saat ini.'
    }

    const data = await res.json()

    return (
      data?.choices?.[0]?.message?.content ||
      'Maaf, ada gangguan sebentar. Coba lagi ya.'
    )

  } catch (error) {
    console.error('Paid fallback error:', error)
    return 'Maaf, ada gangguan koneksi. Coba lagi ya!'
  }
}