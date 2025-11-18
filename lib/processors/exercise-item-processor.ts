import { distance } from 'fastest-levenshtein'
import { findExerciseMet, resolveMetValue } from '@/lib/services/exercise-met'
import { getSupabaseClient } from '@/lib/services/supabase'
import { sanitizeExerciseQuery } from '@/lib/utils/text'
import Groq from 'groq-sdk'

interface ProcessedExercise {
  exercise: any // ExerciseMetRecord do banco
  duration: number // em minutos
  intensity: 'light' | 'moderate' | 'intense'
  metValue: number
  caloriesBurned: number
  method: 'cache' | 'regex' | 'fuzzy' | 'llm'
}

/**
 * Processa uma dupla (exercicio, duracao) usando cascata de métodos
 */
export async function processExerciseCascade(
  exercicio: string,
  duracao: string | null,
  userId: string,
  userWeight: number, // peso do usuário em kg
  cache: Map<string, any>
): Promise<ProcessedExercise | null> {
  const cacheKey = `${exercicio}|${duracao || 'default'}`

  // 1. CACHE (0 tokens) - preparado para uso futuro
  if (cache.has(cacheKey)) {
    console.log('✅ Exercise resolved from CACHE:', { exercicio, duracao })
    return { ...cache.get(cacheKey), method: 'cache' }
  }

  // 2. REGEX: Extrair duração (0 tokens)
  const durationMinutes = extractDurationWithRegex(duracao)
  if (!durationMinutes && duracao) {
    console.log('⚠️ Could not parse duration with regex:', duracao)
    // Fallback para LLM depois
  }

  // 3. FUZZY MATCH: Buscar exercício na tabela (0 tokens)
  const exercise = await findExerciseWithFuzzy(exercicio)
  if (!exercise) {
    console.log('❌ Exercise not found:', exercicio)
    return null
  }

  console.log('✅ Exercise found via FUZZY:', {
    query: exercicio,
    found: exercise.exercise_name,
    method: 'fuzzy',
  })

  // 4. DETERMINAR INTENSIDADE (padrão: moderate)
  let intensity: 'light' | 'moderate' | 'intense' = 'moderate'
  let metValue = resolveMetValue(exercise, intensity)

  // Se não conseguiu extrair duração via regex, usar LLM
  let finalDuration = durationMinutes
  if (!finalDuration && duracao) {
    console.log('⚠️ Using LLM fallback for duration extraction:', duracao)
    finalDuration = await extractDurationWithLLM(duracao)
  }

  // Se não tem duração especificada, retornar null (usuário precisa especificar)
  if (!finalDuration) {
    console.log('❌ Could not determine duration')
    return null
  }

  // 5. CALCULAR CALORIAS (fórmula MET)
  // Calorias = MET × peso (kg) × duração (horas)
  const durationHours = finalDuration / 60
  const caloriesBurned = metValue * userWeight * durationHours

  console.log('🧮 Exercise calculation:', {
    exercise: exercise.exercise_name,
    duration: `${finalDuration} min`,
    intensity,
    metValue,
    userWeight,
    formula: `${metValue} × ${userWeight}kg × ${durationHours.toFixed(2)}h = ${caloriesBurned.toFixed(0)} kcal`,
  })

  const result: ProcessedExercise = {
    exercise,
    duration: finalDuration,
    intensity,
    metValue,
    caloriesBurned,
    method: durationMinutes ? 'regex' : 'llm',
  }

  // Salvar no cache (só após validação do usuário - implementar depois)
  // cache.set(cacheKey, result)

  return result
}

/**
 * Extrai duração em minutos via regex
 */
function extractDurationWithRegex(duracao: string | null): number | null {
  if (!duracao) return null

  const patterns = [
    // "30 minutos", "30 min", "30min"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:minutos?|min)/i,
      extract: (m: RegExpMatchArray) => parseFloat(m[1]),
    },
    // "1 hora", "1h", "1.5 horas"
    {
      regex: /(\d+(?:\.\d+)?)\s*(?:horas?|h)/i,
      extract: (m: RegExpMatchArray) => parseFloat(m[1]) * 60,
    },
    // "1h30", "1h30min"
    {
      regex: /(\d+)h\s*(\d+)(?:min)?/i,
      extract: (m: RegExpMatchArray) => parseInt(m[1]) * 60 + parseInt(m[2]),
    },
    // Apenas número (assume minutos)
    {
      regex: /^(\d+(?:\.\d+)?)$/,
      extract: (m: RegExpMatchArray) => parseFloat(m[1]),
    },
  ]

  for (const { regex, extract } of patterns) {
    const match = duracao.match(regex)
    if (match) {
      const minutes = extract(match)
      if (minutes > 0 && minutes <= 1440) {
        // Validar: máximo 24 horas
        return minutes
      }
    }
  }

  return null
}

/**
 * Busca exercício usando fuzzy matching
 */
async function findExerciseWithFuzzy(exercicio: string): Promise<any | null> {
  const normalized = exercicio
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remover palavras irrelevantes
    .replace(/\b(fiz|fazer|pratiquei|na|no|do|da|de)\b/gi, '')
    .trim()

  // Tenta match exato primeiro
  let exercise = await findExerciseMet(normalized)
  if (exercise) {
    console.log('✅ Exercise found via EXACT match:', {
      query: exercicio,
      found: exercise.exercise_name,
    })
    return exercise
  }

  // Fuzzy match (Levenshtein distance)
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: topExercises } = await supabase
    .from('exercise_met_table')
    .select('*')
    .order('id')
    .limit(50) // Top 50 exercícios mais comuns

  if (!topExercises || topExercises.length === 0) return null

  let bestMatch = { exercise: null as any, score: 0 }
  
  // Normalização agressiva para comparação (remove espaços/hífens)
  const normalizedAggressive = sanitizeExerciseQuery(normalized)

  for (const exercise of topExercises) {
    const exerciseNorm = (
      exercise.exercise_name_normalized || exercise.exercise_name
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    
    // Comparar com versão normalizada (com espaços) e agressiva (sem espaços/hífens)
    const exerciseNormAggressive = sanitizeExerciseQuery(exerciseNorm)
    
    // Calcular similaridade com ambas as versões e pegar a melhor
    const dist1 = distance(normalized, exerciseNorm)
    const similarity1 = 1 - dist1 / Math.max(normalized.length, exerciseNorm.length)
    
    const dist2 = distance(normalizedAggressive, exerciseNormAggressive)
    const similarity2 = 1 - dist2 / Math.max(normalizedAggressive.length, exerciseNormAggressive.length)
    
    const similarity = Math.max(similarity1, similarity2)

    if (similarity > bestMatch.score) {
      bestMatch = { exercise, score: similarity }
    }
  }

  // Threshold: 70% de similaridade (mais permissivo que alimentos)
  if (bestMatch.score > 0.7) {
    console.log('✅ Exercise found via FUZZY match:', {
      query: exercicio,
      found: bestMatch.exercise.exercise_name,
      similarity: bestMatch.score.toFixed(2),
    })
    return bestMatch.exercise
  }

  console.log('❌ Exercise not found via fuzzy:', {
    query: exercicio,
    bestMatch: bestMatch.exercise?.exercise_name,
    bestScore: bestMatch.score.toFixed(2),
  })
  return null
}

/**
 * LLM Fallback para extração de duração
 */
async function extractDurationWithLLM(duracao: string): Promise<number | null> {
  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    console.warn('⚠️ GROQ_API_KEY not configured, cannot use LLM conversion')
    return null
  }

  const groq = new Groq({ apiKey: groqApiKey })

  const prompt = `Extraia a duração em minutos:
"${duracao}"

Retorne só o número em minutos.
Exemplos:
- "meia hora" → 30
- "um pouquinho" → 15
- "bastante tempo" → 45
- "trinta minutos" → 30`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Extraia duração em minutos. Retorne apenas número.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 50,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content?.trim() || ''
    const minutes = parseFloat(content.match(/\d+(?:\.\d+)?/)?.[0] || '0')

    if (minutes > 0 && minutes <= 1440) {
      // Validar: máximo 24 horas
      console.log('✅ LLM duration extraction result:', {
        input: duracao,
        minutes,
      })
      return minutes
    }

    return null
  } catch (error: any) {
    console.error('❌ LLM duration extraction failed:', {
      error: error.message,
      input: duracao,
    })
    return null
  }
}

