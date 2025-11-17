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

  const prompt = `Você é um extrator de alimentos. Identifique TODOS os alimentos mencionados e suas quantidades.

Lista de alimentos conhecidos:
${catalogText}

REGRAS:
1. Se o usuário mencionar MÚLTIPLOS alimentos, retorne um ARRAY JSON
2. Se mencionar apenas UM alimento, retorne um OBJETO JSON
3. Se não identificar nenhum alimento, use "UNKNOWN" para o campo food
4. SEMPRE retorne JSON válido, nunca texto livre

Unidades válidas: ${QUANTITY_UNITS.join(', ')}. Use "unidade" se for singular.

Formato para UM alimento:
{
  "food": "nome_em_singular_sem_artigos",
  "quantity_value": número ou null,
  "quantity_unit": unidade ou null
}

Formato para MÚLTIPLOS alimentos:
{
  "foods": [
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
}

Exemplos:
- "Comi 2 fatias de pizza" → {"food": "pizza", "quantity_value": 2, "quantity_unit": "fatia"}
- "Almocei arroz, feijão e frango" → {"foods": [{"food": "arroz", "quantity_value": null, "quantity_unit": null}, {"food": "feijao", "quantity_value": null, "quantity_unit": null}, {"food": "frango", "quantity_value": null, "quantity_unit": null}]}

IMPORTANTE: Retorne APENAS JSON válido, sem explicações ou texto adicional.`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 500, // Aumentado para suportar arrays
      response_format: { type: 'json_object' }, // Forçar JSON
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      console.warn('⚠️ LLM food parser returned empty content')
      return null
    }

    const parsed = parseJsonResponse(content)
    if (!parsed) {
      console.warn('⚠️ LLM food parser returned non-JSON content:', {
        contentPreview: content.substring(0, 200),
        contentLength: content.length,
      })
      return null
    }

    return parsed
  } catch (error: any) {
    console.error('❌ Error extracting food with LLM:', {
      error: error.message,
      errorType: error.constructor?.name,
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
      
      // Se tiver campo "foods" (múltiplos alimentos em objeto)
      if (parsed && typeof parsed === 'object' && 'foods' in parsed && Array.isArray(parsed.foods)) {
        const items: FoodItem[] = parsed.foods
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
          console.log('✅ LLM extracted multiple foods (from foods array):', {
            count: items.length,
            foods: items.map(i => i.food),
          })
          return items
        }
      }
      
      // Se for array direto (múltiplos alimentos)
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
          console.log('✅ LLM extracted multiple foods (from array):', {
            count: items.length,
            foods: items.map(i => i.food),
          })
          return items
        }
        return null
      }
      
      // Se for objeto com campo "food" (um alimento)
      if (parsed && typeof parsed === 'object' && 'food' in parsed) {
        const result = parsed as FoodParseResult
        if (result.food && result.food !== 'UNKNOWN') {
          result.food = sanitizeFoodQuery(result.food)
        }
        return result
      }
      
      return null
    } catch (parseError: any) {
      console.warn('⚠️ JSON parse error in food parser:', {
        error: parseError.message,
        textPreview: text.substring(0, 100),
      })
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

