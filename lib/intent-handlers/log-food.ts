import { IntentContext } from '@/lib/intent-handlers/types'
import { incrementFoodUsage } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { UserRecord } from '@/lib/services/users'
import { encodeTempData, TemporaryMealData } from '@/lib/utils/temp-data'
import { processItemCascade } from '@/lib/processors/item-processor'
import { DIVIDER } from '@/lib/utils/message-formatters'
import { saveConversationState } from '@/lib/services/conversation-state'

function getUserId(user?: UserRecord | null): string | null {
  return user?.id || null
}

export async function handleLogFoodIntent(
  context: IntentContext
): Promise<string> {
  const { intentResult, user, conversationId, messageText } = context
  const userId = getUserId(user)

  if (!userId) {
    return '❌ Não encontrei seu perfil ainda. Digite "ajuda" para iniciar o cadastro.'
  }

  // Verificar se temos items extraídos do intent
  if (!intentResult.items || intentResult.items.length === 0) {
    return '🤔 Não consegui identificar os alimentos. Pode descrever o que comeu?'
  }

  console.log('🍽️ Processing food items:', intentResult.items)

  // Processar cada dupla (alimento, quantidade)
  const processedItems: Array<any> = []
  const failedItems: Array<string> = []
  const itemCache = new Map<string, any>() // Cache local para esta sessão

  for (const item of intentResult.items) {
    if (!item.alimento) continue

    const processed = await processItemCascade(
      item.alimento,
      item.quantidade || null,
      userId,
      itemCache
    )

    if (processed) {
      // Calcular nutrição
      const ratio = processed.grams / processed.food.serving_size_grams
      const nutrition = {
        calories: processed.food.calories * ratio,
        protein_g: processed.food.protein_g * ratio,
        carbs_g: processed.food.carbs_g ? processed.food.carbs_g * ratio : 0,
        fat_g: processed.food.fat_g ? processed.food.fat_g * ratio : 0,
        fiber_g: processed.food.fiber_g ? processed.food.fiber_g * ratio : 0,
      }

      processedItems.push({
        ...processed,
        ...nutrition,
      })

      console.log('✅ Item processed:', {
        food: processed.food.name,
        quantity: `${processed.quantity} ${processed.unit}`,
        grams: processed.grams,
        calories: nutrition.calories.toFixed(0),
        method: processed.method,
      })

      // Incrementar usage_count
      await incrementFoodUsage(processed.food.id, processed.food.usage_count || 0)

      // Log fallback para alimentos não encontrados (se necessário)
      if (processed.method === 'llm' && processed.food) {
        await logFoodFallback({
          query: item.alimento,
          phoneNumber: user?.phone_number || 'unknown',
        })
      }
    } else {
      failedItems.push(item.alimento)
      await logFoodFallback({
        query: item.alimento,
        phoneNumber: user?.phone_number || 'unknown',
      })
    }
  }

  if (processedItems.length === 0) {
    return `🤔 Não encontrei "${failedItems.join(', ')}" no meu catálogo

💡 Tente:
• Ser mais específico: "pizza calabresa" → "pizza de calabresa tamanho família"
• Usar unidades padrão: "100g de X" ou "1 fatia de Y"
• Descrever de outra forma

Ou posso buscar na internet (demora ~10 seg).

O que prefere?

1️⃣ Vou reformular
2️⃣ Busca na internet
3️⃣ Cancelar`.trim()
  }

  // Somar totais
  const totals = {
    calories: processedItems.reduce((sum, i) => sum + i.calories, 0),
    protein_g: processedItems.reduce((sum, i) => sum + i.protein_g, 0),
    carbs_g: processedItems.reduce((sum, i) => sum + i.carbs_g, 0),
    fat_g: processedItems.reduce((sum, i) => sum + i.fat_g, 0),
    fiber_g: processedItems.reduce((sum, i) => sum + i.fiber_g, 0),
    totalGrams: processedItems.reduce((sum, i) => sum + i.grams, 0),
  }

  // Montar mensagem
  const itemsList = processedItems
    .map((item, i) => {
      const qty = item.quantity > 1 ? `${item.quantity} ` : ''
      const unit = item.unit ? `${item.unit} de ` : ''
      return `${i + 1}. ${qty}${unit}${item.food.name}
     ${item.calories.toFixed(0)} kcal | ${item.protein_g.toFixed(1)}g prot`
    })
    .join('\n\n')

  const visibleMessage =
    processedItems.length === 1
      ? `🍽️ Refeição identificada

${processedItems[0].quantity} ${processedItems[0].unit} de ${processedItems[0].food.name}
${processedItems[0].calories.toFixed(0)} kcal | ${processedItems[0].protein_g.toFixed(1)}g prot

${DIVIDER}
📊 TOTAL: ${totals.calories.toFixed(0)} kcal | ${totals.protein_g.toFixed(1)}g prot

Está correto?

1️⃣ Sim, registrar
2️⃣ Ajustar quantidade
3️⃣ Cancelar`
      : `🍽️ Refeição identificada

${itemsList}

${DIVIDER}
📊 TOTAL: ${totals.calories.toFixed(0)} kcal | ${totals.protein_g.toFixed(1)}g prot

Está correto?

1️⃣ Sim, registrar
2️⃣ Ajustar quantidade
3️⃣ Cancelar`

  // Encode tempData (mantido como fallback)
  const tempData: TemporaryMealData = {
    type: 'meal',
    timestamp: new Date().toISOString(),
    userId,
    data: {
      description: processedItems.map((i) => `${i.quantity} ${i.unit} de ${i.food.name}`).join(', '),
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      fiber_g: totals.fiber_g,
      grams: totals.totalGrams,
      originalEstimate: {
        items: processedItems.map((i) => ({
          food_id: i.food.id,
          food_name: i.food.name,
          quantity: i.quantity,
          unit: i.unit,
          grams: i.grams,
        })),
        totals,
      },
    },
  }

  // Salvar estado da conversa para confirmação
  await saveConversationState(context.conversationId, {
    phoneNumber: user?.phone_number || '',
    lastIntent: 'register_meal',
    awaitingInput: {
      type: 'confirmation',
      context: {
        mealData: {
          description: processedItems.map((i) => `${i.quantity} ${i.unit} de ${i.food.name}`).join(', '),
          calories: totals.calories,
          protein_g: totals.protein_g,
          carbs_g: totals.carbs_g,
          fat_g: totals.fat_g,
          fiber_g: totals.fiber_g,
          grams: totals.totalGrams,
          originalEstimate: {
            items: processedItems.map((i) => ({
              food_id: i.food.id,
              food_name: i.food.name,
              quantity: i.quantity,
              unit: i.unit,
              grams: i.grams,
            })),
            totals,
          },
        },
      },
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
    },
  })

  return `${visibleMessage}${encodeTempData(tempData)}`
}

// Funções antigas removidas - agora usamos processItemCascade diretamente no handleLogFoodIntent

