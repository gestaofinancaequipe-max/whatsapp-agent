import { IntentContext } from '@/lib/intent-handlers/types'
import { findFoodItem } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { extractFoodNameFromQuestion } from '@/lib/utils/text'

function formatMacroLine(label: string, value: number | null) {
  if (value === null || value === undefined) return `${label}: 0 g`
  return `${label}: ${value.toFixed(1)} g`
}

export async function handleQueryFoodIntent(
  context: IntentContext
): Promise<string> {
  const queryOriginal = context.messageText.trim()
  if (!queryOriginal) {
    return '🍽️ Qual alimento você quer analisar?'
  }

  const foodQuery = extractFoodNameFromQuestion(queryOriginal)
  console.log('🍽️ Food intent lookup:', {
    queryOriginal,
    foodQuery,
  })

  const food = await findFoodItem(foodQuery)
  console.log('🍽️ Food intent lookup:', {
    queryOriginal,
    foodQuery,
    found: !!food,
    foodId: food?.id,
    serving: food?.serving_size,
  })

  if (!food) {
    console.log('⚠️ Food not found, logging fallback:', {
      queryOriginal,
      foodQuery,
    })
    await logFoodFallback({
      query: foodQuery,
      phoneNumber: context.user?.phone_number || 'unknown',
    })
    return `🤔 Ainda não tenho dados sobre "${foodQuery}". Vou pesquisar e te aviso quando estiver disponível.`
  }

  const response = [
    `🍽️ ${food.name} (${food.serving_size || 'porção padrão'})`,
    `• ${food.calories} kcal`,
    `• ${formatMacroLine('Proteína', food.protein_g)}`,
    `• ${formatMacroLine('Carboidratos', food.carbs_g)}`,
    `• ${formatMacroLine('Gorduras', food.fat_g)}`,
    '',
    'Quer registrar? 1️⃣ Sim | 2️⃣ Não',
  ]

  return response.join('\n')
}

