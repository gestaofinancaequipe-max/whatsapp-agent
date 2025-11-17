import Groq from 'groq-sdk'
import { sanitizeFoodQuery } from '@/lib/utils/text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface ExerciseParseResult {
  exercise: string | null
  duration_minutes: number | null
  intensity: 'light' | 'moderate' | 'intense' | null
}

const INTENSITY_KEYWORDS = {
  leve: 'light',
  tranquilo: 'light',
  moderado: 'moderate',
  moderada: 'moderate',
  intenso: 'intense',
  intensa: 'intense',
  forte: 'intense',
  pesado: 'intense',
}

/**
 * Extrai informações do exercício usando LLM
 */
export async function extractExerciseWithLLM(
  message: string
): Promise<ExerciseParseResult> {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY missing')
    return { exercise: null, duration_minutes: null, intensity: null }
  }

  const prompt = `
Você recebe mensagens de usuários sobre exercícios praticados.
Sua tarefa é extrair o nome do exercício, duração em minutos e intensidade.

Intensidades válidas: light (leve), moderate (moderado), intense (intenso)

Exemplos:
- "fiz 35 min de corrida na esteira" → exercise: "corrida", duration_minutes: 35, intensity: "moderate"
- "corri 30 minutos intenso" → exercise: "corrida", duration_minutes: 30, intensity: "intense"
- "musculação leve 45 min" → exercise: "musculação", duration_minutes: 45, intensity: "light"

IMPORTANTE:
- Remova verbos como "fiz", "fazer", "pratiquei", "fiz de"
- Remova informações de localização como "na esteira", "do predio", "na academia"
- Retorne apenas o nome essencial do exercício (ex: "corrida", "musculação", "natação")
- Se não identificar duração, retorne null
- Se não identificar intensidade, retorne "moderate" como padrão

Retorne SEMPRE no formato JSON:
{
  "exercise": "nome_do_exercicio_sem_artigos",
  "duration_minutes": número ou null,
  "intensity": "light" | "moderate" | "intense" | null
}
`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return { exercise: null, duration_minutes: null, intensity: null }
    }

    const parsed = parseJsonResponse(content)
    if (!parsed) {
      console.warn('⚠️ LLM exercise parser returned non-JSON content:', content)
      return { exercise: null, duration_minutes: null, intensity: null }
    }

    // Normalizar exercício
    if (parsed.exercise) {
      parsed.exercise = sanitizeFoodQuery(parsed.exercise)
    }

    // Garantir intensidade válida
    if (parsed.intensity && !['light', 'moderate', 'intense'].includes(parsed.intensity)) {
      parsed.intensity = 'moderate'
    }

    console.log('✅ LLM exercise extraction:', {
      original: message,
      extracted: parsed,
    })

    return parsed
  } catch (error: any) {
    console.error('❌ Error extracting exercise with LLM:', {
      error: error.message,
    })
    return { exercise: null, duration_minutes: null, intensity: null }
  }
}

function parseJsonResponse(content: string): ExerciseParseResult | null {
  const attempt = (text: string): ExerciseParseResult | null => {
    try {
      const parsed = JSON.parse(text) as ExerciseParseResult
      return parsed
    } catch {
      return null
    }
  }

  // Tentar parse direto
  const direct = attempt(content)
  if (direct) return direct

  // Tentar extrair JSON de markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    const extracted = attempt(jsonMatch[1])
    if (extracted) return extracted
  }

  // Tentar extrair qualquer JSON
  const anyJsonMatch = content.match(/\{[\s\S]*\}/)
  if (anyJsonMatch) {
    return attempt(anyJsonMatch[0])
  }

  return null
}

