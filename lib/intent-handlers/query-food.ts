import { IntentContext } from '@/lib/intent-handlers/types'
import { findFoodItem } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { extractFoodNameFromQuestion } from '@/lib/utils/text'
import {
  extractFoodWithLLM,
  FoodParseResult,
  FoodParseResultArray,
} from '@/lib/services/food-parser'
import { IntentType } from '@/lib/types/intents'
import { processItemCascade } from '@/lib/processors/item-processor'

function formatMacroLine(label: string, value: number | null) {
  if (value === null || value === undefined) return `${label}: 0 g`
  return `${label}: ${value.toFixed(1)} g`
}

export async function handleQueryFoodIntent(
  context: IntentContext
): Promise<string> {
  const { intentResult, messageText, user } = context
  const queryOriginal = messageText.trim()
  
  if (!queryOriginal) {
    return '🍽️ Qual alimento você quer analisar?'
  }

  // PRIORIDADE 1: Usar dados já extraídos pelo classificador de intenção
  let foodName: string | null = null
  let quantity: string | null = null
  let dataSource: 'intent_classifier' | 'llm_extraction' | 'fallback' = 'fallback'
  
  if (intentResult.items && intentResult.items.length > 0) {
    const firstItem = intentResult.items[0]
    foodName = firstItem.alimento || null
    quantity = firstItem.quantidade || null
    dataSource = 'intent_classifier'
    
    console.log('🍽️ Using extracted data from intent classifier:', {
      foodName,
      quantity,
      itemsCount: intentResult.items.length,
      allItems: intentResult.items.map((i) => ({
        alimento: i.alimento,
        quantidade: i.quantidade,
      })),
    })
    
    if (intentResult.items.length > 1) {
      console.log('⚠️ Multiple foods detected in intent, using first:', {
        allFoods: intentResult.items.map((i) => i.alimento),
        using: foodName,
      })
    }
  }

  // PRIORIDADE 2: Se não temos dados do classificador, tentar extrair com LLM
  if (!foodName || foodName === 'UNKNOWN') {
    console.log('🔄 Intent items not available, trying LLM extraction...', {
      queryOriginal,
      hasIntentItems: !!(intentResult.items && intentResult.items.length > 0),
    })
    const llmResult = await extractFoodWithLLM(queryOriginal)
    
    if (llmResult) {
      dataSource = 'llm_extraction'
      if (Array.isArray(llmResult) && llmResult.length > 0) {
        foodName = llmResult[0].food
        quantity = llmResult[0].quantity_value 
          ? `${llmResult[0].quantity_value}${llmResult[0].quantity_unit || ''}` 
          : null
        console.log('✅ LLM extraction successful (array):', {
          foodName,
          quantity,
          arrayLength: llmResult.length,
        })
      } else if (llmResult && typeof llmResult === 'object' && 'food' in llmResult) {
        foodName = (llmResult as FoodParseResult).food
        quantity = llmResult.quantity_value 
          ? `${llmResult.quantity_value}${llmResult.quantity_unit || ''}` 
          : null
        console.log('✅ LLM extraction successful (object):', {
          foodName,
          quantity,
        })
      }
    } else {
      console.log('⚠️ LLM extraction returned null or empty')
    }
  }

  // PRIORIDADE 3: Fallback para extração simples do texto
  const fallbackQuery = extractFoodNameFromQuestion(queryOriginal)
  const contextFood = extractFoodFromHistory(
    context.history,
    context.intentResult.intent
  )
  
  const foodQuery = foodName && foodName !== 'UNKNOWN'
    ? foodName
    : contextFood || fallbackQuery

  console.log('🍽️ Food intent lookup:', {
    queryOriginal,
    foodName,
    quantity,
    foodQuery,
    dataSource,
    hasIntentItems: !!(intentResult.items && intentResult.items.length > 0),
  })

  // Buscar alimento no banco
  const food = await findFoodItem(foodQuery)
  
  if (!food) {
    console.log('⚠️ Food not found, logging fallback:', {
      queryOriginal,
      foodQuery,
    })
    await logFoodFallback({
      query: foodQuery,
      phoneNumber: user?.phone_number || 'unknown',
    })
    return `🤔 Ainda não tenho dados sobre "${foodQuery}". Vou pesquisar e te aviso quando estiver disponível.`
  }

  // Se temos quantidade, processar para calcular valores exatos
  let displayQuantity = food.serving_size || 'porção padrão'
  let calories = food.calories
  let protein = food.protein_g
  let carbs = food.carbs_g
  let fat = food.fat_g
  let fiber = food.fiber_g

  if (quantity) {
    if (!user?.id) {
      // Se não temos userId, apenas mostrar a quantidade no display
      displayQuantity = `${quantity} (${food.serving_size || 'porção padrão'})`
      console.log('⚠️ No userId available, showing quantity without processing:', {
        quantity,
        displayQuantity,
      })
    } else {
      console.log('🔢 Processing quantity for food query:', {
        food: food.name,
        quantity,
        userId: user.id,
      })
      
      const itemCache = new Map<string, any>()
      const processed = await processItemCascade(
        foodName || foodQuery,
        quantity,
        user.id,
        itemCache
      )
      
      if (processed) {
        const ratio = processed.grams / processed.food.serving_size_grams
        calories = processed.food.calories * ratio
        protein = processed.food.protein_g * ratio
        carbs = processed.food.carbs_g ? processed.food.carbs_g * ratio : 0
        fat = processed.food.fat_g ? processed.food.fat_g * ratio : 0
        fiber = processed.food.fiber_g ? processed.food.fiber_g * ratio : 0
        
        displayQuantity = `${processed.quantity} ${processed.unit} (~${processed.grams.toFixed(0)}g)`
        
        console.log('✅ Quantity processed:', {
          displayQuantity,
          calories: calories.toFixed(0),
          protein: protein.toFixed(1),
          grams: processed.grams,
        })
      } else {
        // Se processamento falhou, mostrar quantidade original
        displayQuantity = `${quantity} (${food.serving_size || 'porção padrão'})`
        console.log('⚠️ Quantity processing failed, using default serving size:', {
          quantity,
          displayQuantity,
        })
      }
    }
  }

  const response = [
    `🍽️ ${food.name} (${displayQuantity})`,
    `• ${calories.toFixed(0)} kcal`,
    `• ${formatMacroLine('Proteína', protein)}`,
    `• ${formatMacroLine('Carboidratos', carbs)}`,
    `• ${formatMacroLine('Gorduras', fat)}`,
    '',
    'Quer registrar? 1️⃣ Sim | 2️⃣ Não',
  ]

  return response.join('\n')
}

function extractFoodFromHistory(
  history: IntentContext['history'],
  currentIntent: IntentType
): string | undefined {
  if (currentIntent !== 'query_food_info') return undefined
  const lastAssistant = [...history]
    .reverse()
    .find((msg) => msg.role === 'assistant' && msg.content.includes('🍽️'))
  if (!lastAssistant) return undefined
  const match = lastAssistant.content.match(/🍽️ (.+?) \(/)
  if (match) {
    return match[1]
  }
  return undefined
}

