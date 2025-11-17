import { distance } from 'fastest-levenshtein'
import { findFoodItem, incrementFoodUsage } from '@/lib/services/food'
import { getSupabaseClient } from '@/lib/services/supabase'
import Groq from 'groq-sdk'

interface ProcessedItem {
  food: any // FoodItem do banco
  quantity: number
  unit: string
  grams: number
  method: 'cache' | 'regex' | 'fuzzy' | 'llm'
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

  // Busca exata primeiro
  const exactMatch = measures.find((m) => {
    const normalizedMeasureName = normalizeUnitForSearch(m.name)
    return normalizedMeasureName === normalizedUnit
  })
  if (exactMatch) {
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
    return flexibleMatch
  }

  return null
}

/**
 * Extrai quantidade e unidade via regex
 */
function extractQuantityWithRegex(quantidade: string | null): { value: number; unit: string } | null {
  if (!quantidade) return null

  const patterns = [
    // "100g", "100 g", "100 gramas"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:g|grama|gramas)/i,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'g',
      }),
    },
    // "2 colheres", "2 colher"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:colheres?|colher de sopa|cs)/i,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'colher',
      }),
    },
    // "1 xícara", "2 xicaras"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:x[íi]caras?)/i,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'xicara',
      }),
    },
    // "150ml", "150 ml"
    {
      regex: /(\d+(?:\.\d+)?)\s*ml/i,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'ml',
      }),
    },
    // "1 unidade", "2 unidades"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:unidades?|un)/i,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'unidade',
      }),
    },
    // Apenas número (assume porção padrão)
    {
      regex: /^(\d+(?:\.\d+)?)$/,
      extract: (m: RegExpMatchArray) => ({
        value: parseFloat(m[1]),
        unit: 'porção',
      }),
    },
  ]

  for (const { regex, extract } of patterns) {
    const match = quantidade.match(regex)
    if (match) {
      return extract(match)
    }
  }

  return null
}

/**
 * Busca alimento usando fuzzy matching
 */
async function findFoodWithFuzzy(alimento: string): Promise<any | null> {
  const normalized = alimento
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Tenta match exato primeiro
  let food = await findFoodItem(normalized)
  if (food) {
    console.log('✅ Food found via EXACT match:', {
      query: alimento,
      found: food.name,
    })
    return food
  }

  // Fuzzy match (Levenshtein distance)
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: topFoods } = await supabase
    .from('food_items')
    .select(
      'id, name, name_normalized, serving_size_grams, calories, protein_g, carbs_g, fat_g, fiber_g, common_measures, usage_count'
    )
    .order('usage_count', { ascending: false })
    .limit(100)

  if (!topFoods || topFoods.length === 0) return null

  let bestMatch = { food: null as any, score: 0 }

  for (const food of topFoods) {
    const foodNorm = food.name_normalized || food.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const dist = distance(normalized, foodNorm)
    const similarity = 1 - dist / Math.max(normalized.length, foodNorm.length)

    if (similarity > bestMatch.score) {
      bestMatch = { food, score: similarity }
    }
  }

  // Threshold: 75% de similaridade
  if (bestMatch.score > 0.75) {
    console.log('✅ Food found via FUZZY match:', {
      query: alimento,
      found: bestMatch.food.name,
      similarity: bestMatch.score.toFixed(2),
    })
    return bestMatch.food
  }

  console.log('❌ Food not found:', {
    query: alimento,
    bestMatch: bestMatch.food?.name,
    bestScore: bestMatch.score.toFixed(2),
  })
  return null
}

/**
 * LLM Fallback para conversão de unidade
 */
async function convertUnitWithLLM(food: any, quantidade: string | null): Promise<number | null> {
  if (!quantidade) return food.serving_size_grams || 100

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    console.warn('⚠️ GROQ_API_KEY not configured, cannot use LLM conversion')
    return null
  }

  const groq = new Groq({ apiKey: groqApiKey })

  const contextInfo: string[] = []
  if (food.serving_size_grams) {
    contextInfo.push(`Porção padrão: ${food.serving_size_grams}g`)
  }

  const measures = parseCommonMeasures(food.common_measures)
  if (measures && measures.length > 0) {
    const measuresStr = measures.map((m) => `${m.name}=${m.grams}g`).join(', ')
    contextInfo.push(`Medidas: ${measuresStr}`)
  }

  const prompt = `Converta para gramas:
${quantidade} de ${food.name}
${contextInfo.length > 0 ? contextInfo.join(', ') : ''}
Retorne só o número.`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Converta unidades para gramas. Retorne apenas número.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 50,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    const grams = parseFloat(content.match(/\d+(?:\.\d+)?/)?.[0] || '0')

    if (grams > 0) {
      console.log('✅ LLM conversion result:', {
        food: food.name,
        quantity: quantidade,
        grams,
      })
      return grams
    }

    return null
  } catch (error: any) {
    console.error('❌ LLM conversion failed:', {
      error: error.message,
      food: food.name,
      quantity: quantidade,
    })
    return null
  }
}

/**
 * Processa uma dupla (alimento, quantidade) usando cascata de métodos
 */
export async function processItemCascade(
  alimento: string,
  quantidade: string | null,
  userId: string,
  cache: Map<string, any>
): Promise<ProcessedItem | null> {
  const cacheKey = `${alimento}|${quantidade || 'default'}`

  // 1. CACHE (0 tokens)
  if (cache.has(cacheKey)) {
    console.log('✅ Item resolved from CACHE:', { alimento, quantidade })
    return { ...cache.get(cacheKey), method: 'cache' }
  }

  // 2. REGEX: Extrair quantidade e unidade (0 tokens)
  const regexResult = extractQuantityWithRegex(quantidade)
  if (!regexResult && quantidade) {
    console.log('⚠️ Could not parse quantity with regex:', quantidade)
  }

  // 3. FUZZY MATCH: Buscar alimento na tabela (0 tokens)
  const food = await findFoodWithFuzzy(alimento)
  if (!food) {
    console.log('❌ Food not found:', alimento)
    return null
  }

  // 4. COMMON_MEASURES: Converter unidade (0 tokens)
  let grams: number | null = null

  if (regexResult) {
    const { value, unit } = regexResult

    // Se já é gramas, usa direto
    if (unit === 'g' || unit === 'grama' || unit === 'gramas') {
      grams = value
      console.log('✅ Unit is already grams:', { value, unit })
    } else {
      // Busca em common_measures
      const measures = parseCommonMeasures(food.common_measures)
      if (measures) {
        const measure = findMeasureInCommonMeasures(measures, unit)
        if (measure) {
          grams = measure.grams * value
          console.log('✅ Converted via COMMON_MEASURES:', {
            value,
            unit,
            gramsPerUnit: measure.grams,
            totalGrams: grams,
          })
        }
      }
    }
  }

  // 5. LLM FALLBACK: Se não conseguiu converter (200 tokens)
  if (grams === null) {
    console.log('⚠️ Using LLM fallback for unit conversion:', {
      food: food.name,
      quantity: quantidade,
    })
    grams = await convertUnitWithLLM(food, quantidade)
  }

  // Último fallback: usar serving_size_grams se disponível
  if (grams === null && food.serving_size_grams) {
    const quantityValue = regexResult?.value || 1
    grams = food.serving_size_grams * quantityValue
    console.log('⚠️ Using serving_size_grams as final fallback:', {
      food: food.name,
      servingSizeGrams: food.serving_size_grams,
      quantity: quantityValue,
      totalGrams: grams,
    })
  }

  if (grams === null) {
    console.log('❌ Could not determine grams')
    return null
  }

  const result: ProcessedItem = {
    food,
    quantity: regexResult?.value || 1,
    unit: regexResult?.unit || 'porção',
    grams,
    method: grams ? (regexResult ? 'regex' : 'llm') : 'llm',
  }

  // Salvar no cache (só após validação do usuário - implementar depois)
  // cache.set(cacheKey, result)

  return result
}

// Exportar funções auxiliares para uso em outros módulos
export { parseCommonMeasures, findMeasureInCommonMeasures }

