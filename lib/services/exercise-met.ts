import { getSupabaseClient } from '@/lib/services/supabase'
import { sanitizeFoodQuery, sanitizeExerciseQuery } from '@/lib/utils/text'

export interface ExerciseMetRecord {
  id: string
  exercise_name: string
  exercise_name_normalized: string
  aliases: string[] | null
  met_light: number | null
  met_moderate: number | null
  met_intense: number | null
  category: string | null
}

export async function findExerciseMet(
  query: string
): Promise<ExerciseMetRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const normalized = sanitizeFoodQuery(query)
  const normalizedAggressive = sanitizeExerciseQuery(query) // Versão sem espaços/hífens
  console.log('🔎 Searching exercise MET:', { 
    query, 
    normalized, 
    normalizedAggressive,
    table: 'exercise_met_table',
    fields: ['exercise_name', 'exercise_name_normalized', 'aliases']
  })

  try {
    // Estratégia de busca em cascata: exato -> starts with -> palavras completas -> parcial -> agressivo
    
    // 1. Match exato (case-insensitive) - com espaços
    // Tentar busca SQL primeiro
    let exactMatch = null
    try {
      const { data, error } = await supabase
        .from('exercise_met_table')
        .select(
          'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
        )
        .or(`exercise_name.ilike.%${normalized}%,exercise_name_normalized.ilike.%${normalized}%`)
        .limit(10)
      
      if (data && data.length > 0) {
        console.log('🔍 Found candidates from SQL:', {
          count: data.length,
          candidates: data.map(c => ({
            name: c.exercise_name,
            normalized: c.exercise_name_normalized,
            aliases: c.aliases,
          })),
        })
        
        // Verificar match exato em memória (mais confiável)
        for (const candidate of data) {
          const candidateName = (candidate.exercise_name_normalized || candidate.exercise_name).toLowerCase()
          console.log('🔍 Comparing:', {
            queryNormalized: normalized,
            candidateName,
            match: candidateName === normalized,
          })
          
          if (candidateName === normalized) {
            exactMatch = candidate
            break
          }
          // Verificar aliases
          if (candidate.aliases && Array.isArray(candidate.aliases)) {
            for (const alias of candidate.aliases) {
              const aliasLower = alias?.toLowerCase()
              console.log('🔍 Comparing alias:', {
                queryNormalized: normalized,
                alias: aliasLower,
                match: aliasLower === normalized,
              })
              if (aliasLower === normalized) {
                exactMatch = candidate
                break
              }
            }
            if (exactMatch) break
          }
        }
      }
      
      if (error) {
        console.warn('⚠️ SQL query error (trying fallback):', error.message)
      }
    } catch (err: any) {
      console.warn('⚠️ SQL query exception (trying fallback):', err.message)
    }

    if (exactMatch) {
      console.log('🔎 Exercise search result (exact match):', {
        query,
        found: true,
        exerciseName: exactMatch.exercise_name,
        matchType: 'exact',
      })
      return exactMatch
    }

    // 1b. Match exato agressivo (sem espaços/hífens) - para casos como "cross-fit" → "crossfit"
    // Busca em memória comparando versões normalizadas sem espaços/hífens
    if (normalizedAggressive && normalizedAggressive.length >= 3) {
      // Buscar candidatos de forma mais ampla (não apenas por prefixo)
      const { data: candidates } = await supabase
        .from('exercise_met_table')
        .select(
          'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
        )
        .or(`exercise_name.ilike.%${normalizedAggressive}%,exercise_name_normalized.ilike.%${normalizedAggressive}%`)
        .limit(100) // Aumentar limite para pegar mais candidatos

      if (candidates && candidates.length > 0) {
        // Comparar versões normalizadas sem espaços/hífens
        for (const candidate of candidates) {
          // Verificar exercise_name_normalized
          const candidateNormalized = sanitizeExerciseQuery(
            candidate.exercise_name_normalized || candidate.exercise_name
          )
          
          if (candidateNormalized === normalizedAggressive) {
            console.log('🔎 Exercise search result (exact match aggressive - name):', {
              query,
              found: true,
              exerciseName: candidate.exercise_name,
              matchType: 'exact_aggressive_name',
              queryNormalized: normalizedAggressive,
              dbNormalized: candidateNormalized,
            })
            return candidate
          }
          
          // Verificar aliases também!
          if (candidate.aliases && Array.isArray(candidate.aliases)) {
            for (const alias of candidate.aliases) {
              const aliasNormalized = sanitizeExerciseQuery(alias)
              if (aliasNormalized === normalizedAggressive) {
                console.log('🔎 Exercise search result (exact match aggressive - alias):', {
                  query,
                  found: true,
                  exerciseName: candidate.exercise_name,
                  alias,
                  matchType: 'exact_aggressive_alias',
                  queryNormalized: normalizedAggressive,
                  aliasNormalized,
                })
                return candidate
              }
            }
          }
        }
      }
    }

    // 2. Match que começa com o termo
    const { data: startsWithMatch } = await supabase
      .from('exercise_met_table')
      .select(
        'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
      )
      .or(`exercise_name.ilike.${normalized}%,exercise_name_normalized.ilike.${normalized}%`)
      .limit(1)
      .maybeSingle()

    if (startsWithMatch) {
      console.log('🔎 Exercise search result (starts with match):', {
        query,
        found: true,
        exerciseName: startsWithMatch.exercise_name,
        matchType: 'starts_with',
      })
      return startsWithMatch
    }

    // 3. Para queries curtas (<= 5 caracteres), não fazer busca parcial
    const isShortQuery = normalized.length <= 5
    
    if (isShortQuery) {
      console.log('🔎 Exercise search result:', {
        query,
        found: false,
        matchType: 'none',
        reason: 'short_query_no_exact_match_prevent_false_positive',
      })
      return null
    }
    
    // 4. Match parcial com palavras completas (apenas para queries longas)
    const words = normalized.split(/\s+/).filter(w => w.length >= 3)
    
    if (words.length > 0) {
      const { data: candidates } = await supabase
        .from('exercise_met_table')
        .select(
          'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
        )
        .or(
          words.map(word => `exercise_name_normalized.ilike.%${word}%`).join(',')
        )
        .limit(20)

      if (candidates && candidates.length > 0) {
        for (const candidate of candidates) {
          const candidateName = (candidate.exercise_name_normalized || candidate.exercise_name).toLowerCase()
          
          const hasAllWords = words.every(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i')
            return regex.test(candidateName)
          })

          if (hasAllWords) {
            console.log('🔎 Exercise search result (full words match):', {
              query,
              found: true,
              exerciseName: candidate.exercise_name,
              matchType: 'full_words',
            })
            return candidate
          }
        }
      }
    }

    // 5. FALLBACK FINAL: Buscar todos os exercícios e comparar em memória
    // Útil se queries SQL falharem ou para casos edge
    console.log('🔄 Fallback: Searching all exercises in memory...')
    try {
      const { data: allExercises } = await supabase
        .from('exercise_met_table')
        .select(
          'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
        )
        .limit(500) // Buscar mais exercícios para garantir
      
      if (allExercises && allExercises.length > 0) {
        // Comparar com versão normalizada (com espaços)
        for (const exercise of allExercises) {
          const exerciseName = (exercise.exercise_name_normalized || exercise.exercise_name).toLowerCase()
          if (exerciseName === normalized) {
            console.log('🔎 Exercise search result (fallback - name):', {
              query,
              found: true,
              exerciseName: exercise.exercise_name,
              matchType: 'fallback_name',
            })
            return exercise
          }
          
          // Verificar aliases
          if (exercise.aliases && Array.isArray(exercise.aliases)) {
            for (const alias of exercise.aliases) {
              if (alias?.toLowerCase() === normalized) {
                console.log('🔎 Exercise search result (fallback - alias):', {
                  query,
                  found: true,
                  exerciseName: exercise.exercise_name,
                  alias,
                  matchType: 'fallback_alias',
                })
                return exercise
              }
            }
          }
        }
        
        // Comparar com versão agressiva (sem espaços/hífens)
        if (normalizedAggressive && normalizedAggressive.length >= 3) {
          for (const exercise of allExercises) {
            const exerciseNormalized = sanitizeExerciseQuery(
              exercise.exercise_name_normalized || exercise.exercise_name
            )
            if (exerciseNormalized === normalizedAggressive) {
              console.log('🔎 Exercise search result (fallback - aggressive name):', {
                query,
                found: true,
                exerciseName: exercise.exercise_name,
                matchType: 'fallback_aggressive_name',
              })
              return exercise
            }
            
            // Verificar aliases agressivo
            if (exercise.aliases && Array.isArray(exercise.aliases)) {
              for (const alias of exercise.aliases) {
                const aliasNormalized = sanitizeExerciseQuery(alias)
                if (aliasNormalized === normalizedAggressive) {
                  console.log('🔎 Exercise search result (fallback - aggressive alias):', {
                    query,
                    found: true,
                    exerciseName: exercise.exercise_name,
                    alias,
                    matchType: 'fallback_aggressive_alias',
                  })
                  return exercise
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Fallback search failed:', err.message)
    }

    // Se não encontrou nada, retornar null
    console.log('🔎 Exercise search result:', {
      query,
      found: false,
      matchType: 'none',
      normalized,
      normalizedAggressive,
    })

    return null
  } catch (error: any) {
    console.error('❌ findExerciseMet failed:', {
      error: error.message,
      query,
    })
    return null
  }
}

export function resolveMetValue(
  record: ExerciseMetRecord,
  intensity: 'light' | 'moderate' | 'intense'
): number {
  if (intensity === 'light' && record.met_light) return record.met_light
  if (intensity === 'moderate' && record.met_moderate) return record.met_moderate
  if (intensity === 'intense' && record.met_intense) return record.met_intense

  return (
    record.met_moderate ||
    record.met_light ||
    record.met_intense ||
    6 // default moderate MET
  )
}

