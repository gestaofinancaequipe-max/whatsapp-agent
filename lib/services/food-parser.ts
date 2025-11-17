import Groq from 'groq-sdk'
import { getFoodCatalog } from '@/lib/services/food-catalog'
import { sanitizeFoodQuery } from '@/lib/utils/text'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface FoodParseResult {
  food: string | null
  quantity_value: number | null
  quantity_unit: string | null
}

export interface FoodItem {
  food: string
  quantity_value: number | null
  quantity_unit: string | null
}

export type FoodParseResultArray = FoodItem[]

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
): Promise<FoodParseResult | FoodParseResultArray | null> {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY missing')
    return null
  }

  const catalog = await getFoodCatalog()
  const catalogText =
    catalog.length > 0 ? catalog.map((item) => `- ${item}`).join('\n') : ''

  const prompt = `
Você recebe perguntas de usuários sobre alimentos consumidos. 
Sua tarefa é identificar TODOS os alimentos mencionados e suas quantidades.

Lista de alimentos conhecidos:
${catalogText}

IMPORTANTE:
- Se o usuário mencionar MÚLTIPLOS alimentos, retorne um ARRAY
- Se mencionar apenas UM alimento, retorne um OBJETO
- Se não identificar nenhum alimento da lista, responda "UNKNOWN" para o campo food

Unidades válidas: ${QUANTITY_UNITS.join(', ')}. Pode responder "unidade" se for singular.

Formato para UM alimento:
{
  "food": "nome_em_singular_sem_artigos",
  "quantity_value": número ou null,
  "quantity_unit": unidade ou null
}

Formato para MÚLTIPLOS alimentos:
[
  {
    "food": "nome_do_primeiro_alimento",
    "quantity_value": número ou null,
    "quantity_unit": unidade ou null
  },
  {
    "food": "nome_do_segundo_alimento",
    "quantity_value": número ou null,
    "quantity_unit": unidade ou null
  }
]

Exemplos:
- "Comi 2 fatias de pizza" → { "food": "pizza", "quantity_value": 2, "quantity_unit": "fatia" }
- "Almocei arroz, feijão e frango" → [{ "food": "arroz", ... }, { "food": "feijao", ... }, { "food": "frango", ... }]
`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 500, // Aumentado para suportar arrays
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return null
    }

    const parsed = parseJsonResponse(content)
    if (!parsed) {
      console.warn('⚠️ LLM food parser returned non-JSON content:', content)
      return null
    }

    return parsed
  } catch (error: any) {
    console.error('❌ Error extracting food with LLM:', {
      error: error.message,
    })
    return null
  }
}

function parseJsonResponse(
  content: string
): FoodParseResult | FoodParseResultArray | null {
  const attempt = (text: string): FoodParseResult | FoodParseResultArray | null => {
    try {
      const parsed = JSON.parse(text)
      
      // Se for array (múltiplos alimentos)
      if (Array.isArray(parsed)) {
        const items: FoodItem[] = parsed
          .filter((item: any) => item && typeof item === 'object')
          .map((item: any) => ({
            food: item.food && item.food !== 'UNKNOWN' 
              ? sanitizeFoodQuery(item.food) 
              : item.food || 'UNKNOWN',
            quantity_value: item.quantity_value ?? null,
            quantity_unit: item.quantity_unit ?? null,
          }))
          .filter((item: FoodItem) => item.food && item.food !== 'UNKNOWN')
        
        if (items.length > 0) {
          console.log('✅ LLM extracted multiple foods:', {
            count: items.length,
            foods: items.map(i => i.food),
          })
          return items
        }
        return null
      }
      
      // Se for objeto (um alimento)
      if (parsed && typeof parsed === 'object' && 'food' in parsed) {
        const result = parsed as FoodParseResult
        if (result.food && result.food !== 'UNKNOWN') {
          result.food = sanitizeFoodQuery(result.food)
        }
        return result
      }
      
      return null
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

  // Tentar extrair qualquer JSON (objeto ou array)
  const anyJsonMatch = content.match(/(?:\[|\{)[\s\S]*(?:\]|\})/)
  if (anyJsonMatch) {
    return attempt(anyJsonMatch[0])
  }

  return null
}

