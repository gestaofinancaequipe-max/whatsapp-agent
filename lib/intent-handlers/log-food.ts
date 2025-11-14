import { IntentContext } from '@/lib/intent-handlers/types'
import { findFoodItem, incrementFoodUsage } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { createPendingMeal } from '@/lib/services/meals'
import { UserRecord } from '@/lib/services/users'
import { extractFoodWithLLM } from '@/lib/services/food-parser'
import { sanitizeFoodQuery } from '@/lib/utils/text'

interface ParsedMealRequest {
  quantity: number
  unit?: string
  foodQuery: string
}

const UNIT_ALIASES: Record<string, string> = {
  colher: 'colher',
  colheres: 'colher',
  colherada: 'colher',
  colheradas: 'colher',
  fatia: 'fatia',
  fatias: 'fatia',
  grama: 'g',
  gramas: 'g',
  g: 'g',
  kg: 'kg',
  unidade: 'unidade',
  unidades: 'unidade',
  copo: 'copo',
  copos: 'copo',
  xicara: 'copo',
  xicaras: 'copo',
  concha: 'concha',
  conchas: 'concha',
  prato: 'porcao',
  pratos: 'porcao',
  porcao: 'porcao',
  porcoes: 'porcao',
}

function parseMealRequest(text: string): ParsedMealRequest {
  const quantityRegex =
    /(\d+(?:[.,]\d+)?)\s*(colheres?|colheradas?|fatias?|gramas?|g|kg|unidades?|copos?|xic(ar)?as?|conchas?|pratos?|por[cç][oõ]es?)/i
  const match = text.match(quantityRegex)

  if (match) {
    const quantity = parseFloat(match[1].replace(',', '.'))
    const rawUnit = match[2].toLowerCase()
    const unit = UNIT_ALIASES[rawUnit] || rawUnit
    const foodQuery = text.replace(match[0], '').trim()
    return {
      quantity: isNaN(quantity) ? 1 : quantity,
      unit,
      foodQuery: foodQuery.length > 0 ? foodQuery : text,
    }
  }

  return {
    quantity: 1,
    foodQuery: text.trim(),
  }
}

function extractMeasureInGrams(
  food: any,
  quantity: number,
  unit?: string
): number | null {
  const measures = food.common_measures as
    | Array<{ name: string; grams: number }>
    | null
  if (unit && measures && measures.length > 0) {
    const match = measures.find((measure) =>
      measure.name?.toLowerCase().includes(unit)
    )
    if (match && match.grams) {
      return match.grams * quantity
    }
  }

  if (food.serving_size_grams) {
    return food.serving_size_grams * quantity
  }

  return null
}

function formatMacros(value: number | null, unit: string = 'g') {
  if (value === null || value === undefined) return `0${unit}`
  return `${value.toFixed(1)}${unit}`
}

function buildResponseMessage({
  description,
  calories,
  protein,
  carbs,
  fat,
  grams,
}: {
  description: string
  calories: number
  protein: number
  carbs: number | null
  fat: number | null
  grams: number | null
}) {
  const lines = [
    `🍽️ Estimativa para ${description}`,
    grams ? `Quantidade: ~${grams.toFixed(0)} g` : 'Quantidade: porção padrão',
    `Calorias: ~${calories.toFixed(0)} kcal`,
    `Proteínas: ${formatMacros(protein)}`,
    `Carboidratos: ${formatMacros(carbs)}`,
    `Gorduras: ${formatMacros(fat)}`,
    '',
    'Confirma? 1️⃣ Sim | 2️⃣ Corrigir',
  ]

  return lines.join('\n')
}

function getUserId(user?: UserRecord | null): string | null {
  return user?.id || null
}

export async function handleLogFoodIntent(
  context: IntentContext
): Promise<string> {
  const userId = getUserId(context.user)
  if (!userId) {
    return '❌ Não encontrei seu perfil ainda. Digite "ajuda" para iniciar o cadastro.'
  }

  const llmResult = await extractFoodWithLLM(context.messageText)
  const parsed = parseMealRequest(context.messageText)
  if (!parsed.foodQuery) {
    return '🔍 Não entendi o alimento que você comeu. Pode descrever novamente?'
  }

  const foodQuery = sanitizeFoodQuery(
    llmResult.food && llmResult.food !== 'UNKNOWN'
      ? llmResult.food
      : parsed.foodQuery
  )

  console.log('🍽️ Log food extracted query:', {
    original: context.messageText,
    llmFood: llmResult.food,
    regexFood: parsed.foodQuery,
    finalQuery: foodQuery,
  })

  const food = await findFoodItem(foodQuery)

  if (!food) {
    await logFoodFallback({
      query: parsed.foodQuery,
      phoneNumber: context.user?.phone_number || 'unknown',
    })
    return `🤔 Ainda não conheço "${parsed.foodQuery}". Vou pesquisar e te aviso. Pode tentar com outro alimento por enquanto.`
  }

  const quantityValue =
    llmResult.quantity_value && llmResult.quantity_value > 0
      ? llmResult.quantity_value
      : parsed.quantity
  const quantityUnit = llmResult.quantity_unit || parsed.unit

  const grams = extractMeasureInGrams(food, quantityValue, quantityUnit)
  const ratio =
    grams && food.serving_size_grams
      ? grams / food.serving_size_grams
      : quantityValue || 1

  const calories = (food.calories || 0) * (ratio || 1)
  const protein = (food.protein_g || 0) * (ratio || 1)
  const carbs = food.carbs_g ? food.carbs_g * (ratio || 1) : null
  const fat = food.fat_g ? food.fat_g * (ratio || 1) : null
  const fiber = food.fiber_g ? food.fiber_g * (ratio || 1) : null

  const mealDescription = `${quantityValue} ${
    quantityUnit || 'porção'
  } de ${food.name}`

  await createPendingMeal({
    userId,
    description: mealDescription,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    originalEstimate: {
      quantity: quantityValue,
      unit: quantityUnit,
      grams,
      source_food_id: food.id,
    },
  })

  await incrementFoodUsage(food.id, food.usage_count || 0)

  return buildResponseMessage({
    description: mealDescription,
    calories,
    protein,
    carbs,
    fat,
    grams,
  })
}

