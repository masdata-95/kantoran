// OpenRouter with auto-fallback to free models
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

const FREE_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free'
]

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

  console.log('=== OPENROUTER START ===')
  console.log('NPC:', npcId)
  console.log('Models:', models)

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`)

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
        const errorText = await res.text()

        console.error('====================')
        console.error('MODEL FAILED')
        console.error('MODEL:', model)
        console.error('STATUS:', res.status)
        console.error('RESPONSE:', errorText)
        console.error('====================')

        continue
      }

      const data = await res.json()

      console.log('SUCCESS MODEL:', model)

      const reply = data?.choices?.[0]?.message?.content

      if (!reply) {
        console.error('Empty response from:', model)
        continue
      }

      return reply
    } catch (err) {
      console.error('====================')
      console.error('MODEL ERROR')
      console.error('MODEL:', model)
      console.error(err)
      console.error('====================')

      continue
    }
  }

  console.error('ALL MODELS FAILED')

  return `
Maaf, seluruh model AI sedang tidak tersedia.

Silakan cek log Vercel untuk melihat error detail OpenRouter.
`
}