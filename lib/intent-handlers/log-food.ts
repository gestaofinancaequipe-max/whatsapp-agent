import { IntentContext } from '@/lib/intent-handlers/types'
import { findFoodItem, incrementFoodUsage } from '@/lib/services/food'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { UserRecord } from '@/lib/services/users'
import {
  extractFoodWithLLM,
  FoodParseResult,
  FoodParseResultArray,
} from '@/lib/services/food-parser'
import { sanitizeFoodQuery } from '@/lib/utils/text'
import { encodeTempData, TemporaryMealData } from '@/lib/utils/temp-data'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import Groq from 'groq-sdk'

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

/**
 * Parse common_measures que pode vir como JSON string ou array
 */
function parseCommonMeasures(measures: any): Array<{ name: string; grams: number }> | null {
  if (!measures) return null

  // Se for string JSON, fazer parse
  if (typeof measures === 'string') {
    try {
      const parsed = JSON.parse(measures)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  // Se já for array, retornar direto
  if (Array.isArray(measures)) {
    return measures
  }

  return null
}

/**
 * Normaliza nome da unidade para busca (singular, lowercase, remove acentos básicos)
 */
function normalizeUnitForSearch(unit: string): string {
  return unit
    .toLowerCase()
    .trim()
    .replace(/ões$/, 'ão') // colheres -> colher
    .replace(/s$/, '') // remove plural
    .replace(/[_\s]+/g, ' ') // substitui underscores e múltiplos espaços por espaço único
    .trim()
}

/**
 * Busca medida em common_measures com normalização melhorada
 */
function findMeasureInCommonMeasures(
  measures: Array<{ name: string; grams: number }>,
  unit: string
): { name: string; grams: number } | null {
  const normalizedUnit = normalizeUnitForSearch(unit)

  // Extrair palavra-chave principal da unidade (ex: "colher" de "colher de sopa")
  const unitKeywords = normalizedUnit
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['de', 'da', 'do', 'em'].includes(word))

  console.log('🔍 Searching measure in common_measures:', {
    originalUnit: unit,
    normalizedUnit,
    unitKeywords,
    availableMeasures: measures.map((m) => m.name),
  })

  // Busca exata primeiro
  const exactMatch = measures.find((m) => {
    const normalizedMeasureName = normalizeUnitForSearch(m.name)
    return normalizedMeasureName === normalizedUnit
  })
  if (exactMatch) {
    console.log('✅ Exact match found:', { measure: exactMatch.name, grams: exactMatch.grams })
    return exactMatch
  }

  // Busca por palavra-chave (ex: "colher" encontra "colher_sopa", "colher de sopa")
  if (unitKeywords.length > 0) {
    const keywordMatch = measures.find((m) => {
      const normalizedMeasureName = normalizeUnitForSearch(m.name)
      // Verifica se alguma palavra-chave está no nome da medida
      return unitKeywords.some((keyword) => normalizedMeasureName.includes(keyword))
    })
    if (keywordMatch) {
      console.log('✅ Keyword match found:', { measure: keywordMatch.name, grams: keywordMatch.grams })
      return keywordMatch
    }
  }

  // Busca por inclusão bidirecional (flexível)
  const flexibleMatch = measures.find((m) => {
    const normalizedMeasureName = normalizeUnitForSearch(m.name)
    return (
      normalizedMeasureName.includes(normalizedUnit) ||
      normalizedUnit.includes(normalizedMeasureName)
    )
  })
  if (flexibleMatch) {
    console.log('✅ Flexible match found:', { measure: flexibleMatch.name, grams: flexibleMatch.grams })
    return flexibleMatch
  }

  console.log('❌ No measure found in common_measures')
  return null
}

/**
 * Converte unidade para gramas usando LLM como fallback
 */
async function convertUnitToGramsWithLLM(
  foodName: string,
  quantity: number,
  unit: string,
  context: {
    servingSizeGrams?: number | null
    commonMeasures?: Array<{ name: string; grams: number }> | null
  }
): Promise<number | null> {
  try {
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      console.warn('⚠️ GROQ_API_KEY not configured, cannot use LLM conversion')
      return null
    }

    const groq = new Groq({ apiKey: groqApiKey })

    const contextInfo: string[] = []
    if (context.servingSizeGrams) {
      contextInfo.push(`Porção padrão do alimento: ${context.servingSizeGrams}g`)
    }
    if (context.commonMeasures && context.commonMeasures.length > 0) {
      const measuresText = context.commonMeasures
        .map((m) => `${m.name} = ${m.grams}g`)
        .join(', ')
      contextInfo.push(`Medidas conhecidas: ${measuresText}`)
    }

    const prompt = `Você é um especialista em nutrição. Converta a medida para gramas.

Alimento: ${foodName}
Quantidade: ${quantity}
Unidade: ${unit}

${contextInfo.length > 0 ? `Contexto:\n${contextInfo.join('\n')}` : ''}

Responda APENAS com um número (quantidade de gramas), sem texto adicional.
Se não souber a conversão exata, faça uma estimativa baseada no tipo de alimento e unidade comum.

Exemplos:
- "2 colheres de sopa de arroz" → aproximadamente 30g
- "1 copo de leite" → aproximadamente 240g
- "2 fatias de pão" → aproximadamente 50g

Resposta (apenas número):`

    console.log('🤖 Converting unit to grams with LLM:', {
      food: foodName,
      quantity,
      unit,
      hasContext: contextInfo.length > 0,
    })

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em nutrição. Responda APENAS com números, sem texto adicional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 50,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) return null

    // Extrair número da resposta (pode ter texto antes/depois)
    const numberMatch = content.match(/(\d+(?:[.,]\d+)?)/)
    if (!numberMatch) return null

    const grams = parseFloat(numberMatch[1].replace(',', '.'))
    if (isNaN(grams) || grams <= 0) return null

    const totalGrams = grams * quantity

    console.log('✅ LLM conversion result:', {
      food: foodName,
      quantity,
      unit,
      gramsPerUnit: grams,
      totalGrams,
    })

    return totalGrams
  } catch (error: any) {
    console.error('❌ Error converting unit with LLM:', {
      error: error.message,
      food: foodName,
      quantity,
      unit,
    })
    return null
  }
}

/**
 * Extrai medida em gramas, tentando primeiro common_measures, depois LLM como fallback
 */
async function extractMeasureInGrams(
  food: any,
  quantity: number,
  unit?: string
): Promise<number | null> {
  // Se não tem unidade, usar serving_size_grams como fallback
  if (!unit) {
    if (food.serving_size_grams) {
      return food.serving_size_grams * quantity
    }
    return null
  }

  // Se a unidade já é gramas (g, grama, gramas), usar diretamente sem conversão
  const normalizedUnit = unit.toLowerCase().trim()
  if (normalizedUnit === 'g' || normalizedUnit === 'grama' || normalizedUnit === 'gramas' || normalizedUnit === 'gram') {
    console.log('✅ Unit is already grams, using directly:', {
      food: food.name,
      quantity,
      totalGrams: quantity,
    })
    return quantity
  }

  // Tentar buscar em common_measures primeiro
  const measures = parseCommonMeasures(food.common_measures)
  if (measures && measures.length > 0) {
    const match = findMeasureInCommonMeasures(measures, unit)
    if (match && match.grams) {
      console.log('✅ Found measure in common_measures:', {
        food: food.name,
        unit,
        measureName: match.name,
        gramsPerUnit: match.grams,
        quantity,
        totalGrams: match.grams * quantity,
      })
      return match.grams * quantity
    }
  }

  // Se não encontrou em common_measures, usar LLM como fallback
  console.log('⚠️ Measure not found in common_measures, using LLM fallback:', {
    food: food.name,
    unit,
    quantity,
  })

  const llmGrams = await convertUnitToGramsWithLLM(
    food.name,
    quantity,
    unit,
    {
      servingSizeGrams: food.serving_size_grams,
      commonMeasures: measures,
    }
  )

  if (llmGrams) {
    return llmGrams
  }

  // Último fallback: usar serving_size_grams
  if (food.serving_size_grams) {
    console.log('⚠️ Using serving_size_grams as final fallback:', {
      food: food.name,
      servingSizeGrams: food.serving_size_grams,
      quantity,
      totalGrams: food.serving_size_grams * quantity,
    })
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
  items?: Array<{ name: string; calories: number; protein: number; grams?: number | null }>
}) {
  const lines: string[] = []

  if (items && items.length > 1) {
    // Refeição composta - mostrar cada item
    // Adicionar gramas na descrição se houver total
    const descriptionWithGrams = grams 
      ? `${description} (~${grams.toFixed(0)}g)`
      : description
    lines.push(`🍽️ Estimativa para ${descriptionWithGrams}`)
    lines.push('')
    items.forEach((item) => {
      const itemWithGrams = item.grams 
        ? `${item.name} (~${item.grams.toFixed(0)}g)`
        : item.name
      lines.push(
        `• ${itemWithGrams}: ~${item.calories.toFixed(0)} kcal, ${formatMacros(item.protein)} proteína`
      )
    })
    lines.push('')
    lines.push('📊 Total:')
  } else {
    // Alimento único - adicionar gramas na descrição
    const descriptionWithGrams = grams 
      ? `${description} (~${grams.toFixed(0)}g)`
      : description
    lines.push(`🍽️ Estimativa para ${descriptionWithGrams}`)
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

  const grams = await extractMeasureInGrams(food, quantityValue, quantityUnit)
  const ratio =
    grams && food.serving_size_grams
      ? grams / food.serving_size_grams
      : quantityValue || 1

  const calories = (food.calories || 0) * (ratio || 1)
  const protein = (food.protein_g || 0) * (ratio || 1)
  const carbs = food.carbs_g ? food.carbs_g * (ratio || 1) : null
  const fat = food.fat_g ? food.fat_g * (ratio || 1) : null
  const fiber = food.fiber_g ? food.fiber_g * (ratio || 1) : null

  console.log('🧮 Single food calculation:', {
    food: food.name,
    foodId: food.id,
    quantity: {
      value: quantityValue,
      unit: quantityUnit || 'porção padrão',
      gramsConsidered: grams,
    },
    conversion: {
      grams: grams,
      servingSizeGrams: food.serving_size_grams,
      ratio: ratio.toFixed(3),
      formula: grams && food.serving_size_grams 
        ? `${grams}g / ${food.serving_size_grams}g = ${ratio.toFixed(3)}`
        : `Using quantity: ${quantityValue}`,
    },
    baseValues: {
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      servingSizeGrams: food.serving_size_grams,
    },
    calculatedValues: {
      calories: calories.toFixed(1),
      protein_g: protein.toFixed(1),
      carbs_g: carbs ? carbs.toFixed(1) : null,
      fat_g: fat ? fat.toFixed(1) : null,
      fiber_g: fiber ? fiber.toFixed(1) : null,
      gramsUsed: grams || null,
    },
  })

  const mealDescription = grams 
    ? `${quantityValue} ${quantityUnit || 'porção'} de ${food.name} (~${grams.toFixed(0)}g)`
    : `${quantityValue} ${quantityUnit || 'porção'} de ${food.name}`

  await incrementFoodUsage(food.id, food.usage_count || 0)

  // Obter daily summary para incluir no tempData
  const dailySummary = await getOrCreateDailySummary(userId)
  if (!dailySummary) {
    return '❌ Erro ao processar. Tente novamente.'
  }

  // Construir mensagem visível
  const visibleMessage = buildResponseMessage({
    description: mealDescription,
    calories,
    protein,
    carbs,
    fat,
    grams,
  })

  // Criar dados temporários
  const tempData: TemporaryMealData = {
    type: 'meal',
    timestamp: new Date().toISOString(),
    userId,
    data: {
      description: mealDescription,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
      grams: grams || null,
      originalEstimate: {
        quantity: quantityValue,
        unit: quantityUnit,
        grams,
        source_food_id: food.id,
      },
    },
  }

  // Retornar mensagem com dados temporários codificados
  return `${visibleMessage}${encodeTempData(tempData)}`
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
    unit: string | undefined
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
    const quantityUnit = foodItem.quantity_unit || undefined

    const grams = await extractMeasureInGrams(food, quantityValue, quantityUnit)
    const ratio =
      grams && food.serving_size_grams
        ? grams / food.serving_size_grams
        : quantityValue || 1

    const calories = (food.calories || 0) * (ratio || 1)
    const protein = (food.protein_g || 0) * (ratio || 1)
    const carbs = food.carbs_g ? food.carbs_g * (ratio || 1) : null
    const fat = food.fat_g ? food.fat_g * (ratio || 1) : null
    const fiber = food.fiber_g ? food.fiber_g * (ratio || 1) : null

    console.log('🧮 Food item calculation:', {
      food: food.name,
      foodId: food.id,
      quantity: {
        value: quantityValue,
        unit: quantityUnit || 'porção padrão',
        gramsConsidered: grams,
      },
      conversion: {
        grams: grams,
        servingSizeGrams: food.serving_size_grams,
        ratio: ratio.toFixed(3),
        formula: grams && food.serving_size_grams 
          ? `${grams}g / ${food.serving_size_grams}g = ${ratio.toFixed(3)}`
          : `Using quantity: ${quantityValue}`,
      },
      baseValues: {
        calories: food.calories,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        servingSizeGrams: food.serving_size_grams,
      },
      calculatedValues: {
        calories: calories.toFixed(1),
        protein_g: protein.toFixed(1),
        carbs_g: carbs ? carbs.toFixed(1) : null,
        fat_g: fat ? fat.toFixed(1) : null,
        fiber_g: fiber ? fiber.toFixed(1) : null,
        gramsUsed: grams || null,
      },
    })

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

  console.log('🧮 Total meal calculation:', {
    itemCount: processedFoods.length,
    items: processedFoods.map((f) => ({
      food: f.food.name,
      quantity: `${f.quantity} ${f.unit || 'porção'}`,
      gramsConsidered: f.grams,
      calories: f.calories.toFixed(1),
      protein_g: f.protein.toFixed(1),
    })),
    totals: {
      calories: totalCalories.toFixed(1),
      protein_g: totalProtein.toFixed(1),
      carbs_g: totalCarbs.toFixed(1),
      fat_g: totalFat.toFixed(1),
      fiber_g: totalFiber.toFixed(1),
      totalGramsConsidered: totalGrams > 0 ? totalGrams.toFixed(1) : null,
    },
  })

  // Criar descrição da refeição
  const mealItems = processedFoods.map((f) => {
    const qty = f.quantity > 1 ? `${f.quantity} ` : ''
    const unit = f.unit ? `${f.unit} de ` : ''
    return `${qty}${unit}${f.food.name}`
  })
  const mealDescription = mealItems.join(', ')

  // Obter daily summary para incluir no tempData
  const dailySummary = await getOrCreateDailySummary(userId)
  if (!dailySummary) {
    return '❌ Erro ao processar. Tente novamente.'
  }

  // Preparar itens para exibição
  const displayItems = processedFoods.map((f) => {
    const qty = f.quantity > 1 ? `${f.quantity} ` : ''
    const unit = f.unit ? `${f.unit} de ` : ''
    const gramsText = f.grams ? ` (~${f.grams.toFixed(0)}g)` : ''
    return {
      name: `${qty}${unit}${f.food.name}${gramsText}`,
      calories: f.calories,
      protein: f.protein,
      grams: f.grams,
    }
  })

  // Construir mensagem visível
  const visibleMessage = buildResponseMessage({
    description: mealDescription,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    grams: totalGrams > 0 ? totalGrams : null,
    items: displayItems,
  })

  // Criar dados temporários
  const tempData: TemporaryMealData = {
    type: 'meal',
    timestamp: new Date().toISOString(),
    userId,
    data: {
      description: mealDescription,
      calories: totalCalories,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fat_g: totalFat,
      fiber_g: totalFiber,
      grams: totalGrams > 0 ? totalGrams : null,
      originalEstimate: {
        items: processedFoods.map((f) => ({
          food_id: f.food.id,
          food_name: f.food.name,
          quantity: f.quantity,
          unit: f.unit,
          grams: f.grams,
        })),
      },
    },
  }

  // Retornar mensagem com dados temporários codificados
  return `${visibleMessage}${encodeTempData(tempData)}`
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

