import { getSupabaseClient } from '@/lib/services/supabase'
import { sanitizeFoodQuery } from '@/lib/utils/text'

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
  console.log('🔎 Searching exercise MET:', { query, normalized })

  try {
    // Estratégia de busca em cascata: exato -> starts with -> palavras completas -> parcial
    
    // 1. Match exato (case-insensitive)
    const { data: exactMatch } = await supabase
      .from('exercise_met_table')
      .select(
        'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
      )
      .or(`exercise_name.ilike.${normalized},exercise_name_normalized.ilike.${normalized},aliases.cs.{${normalized}}`)
      .limit(1)
      .maybeSingle()

    if (exactMatch) {
      console.log('🔎 Exercise search result (exact match):', {
        query,
        found: true,
        exerciseName: exactMatch.exercise_name,
        matchType: 'exact',
      })
      return exactMatch
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

    // Se não encontrou nada, retornar null
    console.log('🔎 Exercise search result:', {
      query,
      found: false,
      matchType: 'none',
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

