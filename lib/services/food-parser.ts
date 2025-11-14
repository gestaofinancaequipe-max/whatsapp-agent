import Groq from 'groq-sdk'
import { getFoodCatalog } from '@/lib/services/food-catalog'
import { sanitizeFoodQuery } from '@/lib/utils/text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

interface FoodParseResult {
  food: string | null
  quantity_value: number | null
  quantity_unit: string | null
}

const QUANTITY_UNITS = [
  'fatia',
  'fatias',
  'colher',
  'colheres',
  'grama',
  'gramas',
  'g',
  'ml',
  'copo',
  'copos',
  'unidade',
  'unidades',
  'concha',
  'conchas',
  'porcao',
  'porcoes',
]

export async function extractFoodWithLLM(
  message: string
): Promise<FoodParseResult> {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY missing')
    return { food: null, quantity_value: null, quantity_unit: null }
  }

  const catalog = await getFoodCatalog()
  const catalogText =
    catalog.length > 0 ? catalog.map((item) => `- ${item}`).join('\n') : ''

  const prompt = `
Você recebe perguntas de usuários sobre alimentos consumidos. 
Sua tarefa é identificar o alimento mais próximo da lista abaixo e a quantidade mencionada.

Lista de alimentos conhecidos:
${catalogText}

Se não identificar nenhum alimento da lista, responda "UNKNOWN" para o campo food.

Unidades válidas: ${QUANTITY_UNITS.join(', ')}. Pode responder "unidade" se for singular.

Retorne SEMPRE no formato JSON:
{
  "food": "nome_em_singular_sem_artigos",
  "quantity_value": número ou null,
  "quantity_unit": unidade ou null
}
`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return { food: null, quantity_value: null, quantity_unit: null }
    }

    const parsed = parseJsonResponse(content)
    if (!parsed) {
      console.warn('⚠️ LLM food parser returned non-JSON content:', content)
      return { food: null, quantity_value: null, quantity_unit: null }
    }

    return parsed
  } catch (error: any) {
    console.error('❌ Error extracting food with LLM:', {
      error: error.message,
    })
    return { food: null, quantity_value: null, quantity_unit: null }
  }
}

function parseJsonResponse(content: string): FoodParseResult | null {
  const attempt = (text: string): FoodParseResult | null => {
    try {
      const parsed = JSON.parse(text) as FoodParseResult
      if (parsed.food && parsed.food !== 'UNKNOWN') {
        parsed.food = sanitizeFoodQuery(parsed.food)
      }
      return parsed
    } catch {
      return null
    }
  }

  const direct = attempt(content)
  if (direct) return direct

  const match = content.match(/\{[\s\S]*\}/)
  if (match) {
    return attempt(match[0])
  }

  return null
}

