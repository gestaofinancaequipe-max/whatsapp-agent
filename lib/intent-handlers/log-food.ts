import { IntentContext } from '@/lib/intent-handlers/types'
import { findFoodItem, incrementFoodUsage } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { createPendingMeal } from '@/lib/services/meals'
import { UserRecord } from '@/lib/services/users'
import {
  extractFoodWithLLM,
  FoodParseResult,
  FoodParseResultArray,
} from '@/lib/services/food-parser'
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
  items,
}: {
  description: string
  calories: number
  protein: number
  carbs: number | null
  fat: number | null
  grams: number | null
  items?: Array<{ name: string; calories: number; protein: number }>
}) {
  const lines: string[] = []

  if (items && items.length > 1) {
    // Refeição composta - mostrar cada item
    lines.push(`🍽️ Estimativa para ${description}`)
    lines.push('')
    items.forEach((item) => {
      lines.push(
        `• ${item.name}: ~${item.calories.toFixed(0)} kcal, ${formatMacros(item.protein)} proteína`
      )
    })
    lines.push('')
    lines.push('📊 Total:')
  } else {
    lines.push(`🍽️ Estimativa para ${description}`)
    if (grams) {
      lines.push(`Quantidade: ~${grams.toFixed(0)} g`)
    } else {
      lines.push('Quantidade: porção padrão')
    }
  }

  lines.push(`Calorias: ~${calories.toFixed(0)} kcal`)
  lines.push(`Proteínas: ${formatMacros(protein)}`)
  lines.push(`Carboidratos: ${formatMacros(carbs)}`)
  lines.push(`Gorduras: ${formatMacros(fat)}`)
  lines.push('')
  lines.push('Confirma? 1️⃣ Sim | 2️⃣ Corrigir')

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
  const contextFood = extractFoodFromHistory(context.history)

  // Verificar se é array (múltiplos alimentos)
  if (Array.isArray(llmResult) && llmResult.length > 0) {
    return await handleMultipleFoods(
      llmResult,
      userId,
      context.user?.phone_number || 'unknown',
      context.messageText
    )
  }

  // Processar alimento único (comportamento original)
  if (!parsed.foodQuery) {
    return '🔍 Não entendi o alimento que você comeu. Pode descrever novamente?'
  }

  const singleResult = llmResult as FoodParseResult | null
  const rawFoodQuery =
    singleResult?.food && singleResult.food !== 'UNKNOWN'
      ? singleResult.food
      : contextFood || parsed.foodQuery
  const foodQuery = sanitizeFoodQuery(rawFoodQuery)

  console.log('🍽️ Log food extracted query:', {
    original: context.messageText,
    llmFood: singleResult?.food,
    contextFood,
    regexFood: parsed.foodQuery,
    finalQuery: foodQuery,
  })

  const food = await findFoodItem(foodQuery)

  if (!food) {
    await logFoodFallback({
      query: foodQuery,
      phoneNumber: context.user?.phone_number || 'unknown',
    })
    return `🤔 Ainda não conheço "${parsed.foodQuery}". Vou pesquisar e te aviso. Pode tentar com outro alimento por enquanto.`
  }

  const quantityValue =
    singleResult?.quantity_value && singleResult.quantity_value > 0
      ? singleResult.quantity_value
      : parsed.quantity
  const quantityUnit = singleResult?.quantity_unit || parsed.unit

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

async function handleMultipleFoods(
  foods: FoodParseResultArray,
  userId: string,
  phoneNumber: string,
  originalMessage: string
): Promise<string> {
  console.log('🍽️ Processing multiple foods:', {
    count: foods.length,
    foods: foods.map((f) => f.food),
  })

  const processedFoods: Array<{
    food: any
    quantity: number
    unit: string | null
    grams: number | null
    calories: number
    protein: number
    carbs: number | null
    fat: number | null
    fiber: number | null
  }> = []

  const notFoundFoods: string[] = []

  // Processar cada alimento
  for (const foodItem of foods) {
    const foodQuery = sanitizeFoodQuery(foodItem.food)
    const food = await findFoodItem(foodQuery)

    if (!food) {
      notFoundFoods.push(foodItem.food)
      await logFoodFallback({
        query: foodQuery,
        phoneNumber,
      })
      continue
    }

    const quantityValue = foodItem.quantity_value || 1
    const quantityUnit = foodItem.quantity_unit || null

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

    processedFoods.push({
      food,
      quantity: quantityValue,
      unit: quantityUnit,
      grams,
      calories,
      protein,
      carbs,
      fat,
      fiber,
    })

    await incrementFoodUsage(food.id, food.usage_count || 0)
  }

  // Se nenhum alimento foi encontrado
  if (processedFoods.length === 0) {
    return `🤔 Não consegui identificar nenhum dos alimentos mencionados. Pode tentar descrever de outra forma?`
  }

  // Se alguns alimentos não foram encontrados
  if (notFoundFoods.length > 0) {
    console.log('⚠️ Some foods not found:', notFoundFoods)
  }

  // Somar totais
  const totalCalories = processedFoods.reduce((sum, f) => sum + f.calories, 0)
  const totalProtein = processedFoods.reduce((sum, f) => sum + f.protein, 0)
  const totalCarbs = processedFoods.reduce(
    (sum, f) => sum + (f.carbs || 0),
    0
  )
  const totalFat = processedFoods.reduce((sum, f) => sum + (f.fat || 0), 0)
  const totalFiber = processedFoods.reduce((sum, f) => sum + (f.fiber || 0), 0)
  const totalGrams = processedFoods.reduce(
    (sum, f) => sum + (f.grams || 0),
    0
  )

  // Criar descrição da refeição
  const mealItems = processedFoods.map((f) => {
    const qty = f.quantity > 1 ? `${f.quantity} ` : ''
    const unit = f.unit ? `${f.unit} de ` : ''
    return `${qty}${unit}${f.food.name}`
  })
  const mealDescription = mealItems.join(', ')

  // Criar refeição composta
  await createPendingMeal({
    userId,
    description: mealDescription,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    fiber: totalFiber,
    originalEstimate: {
      items: processedFoods.map((f) => ({
        food_id: f.food.id,
        food_name: f.food.name,
        quantity: f.quantity,
        unit: f.unit,
        grams: f.grams,
      })),
    },
  })

  // Preparar itens para exibição
  const displayItems = processedFoods.map((f) => ({
    name: `${f.quantity > 1 ? `${f.quantity} ` : ''}${f.unit ? `${f.unit} de ` : ''}${f.food.name}`,
    calories: f.calories,
    protein: f.protein,
  }))

  return buildResponseMessage({
    description: mealDescription,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    grams: totalGrams > 0 ? totalGrams : null,
    items: displayItems,
  })
}

function extractFoodFromHistory(
  history: IntentContext['history']
): string | undefined {
  const lastUser = [...history]
    .reverse()
    .find((msg) => msg.role === 'user' && msg.intent === 'register_meal')
  if (!lastUser) return undefined
  const match = lastUser.content.match(/de\s+([a-zà-ú\s]+)/i)
  if (match) {
    return match[1].trim()
  }
  return undefined
}

