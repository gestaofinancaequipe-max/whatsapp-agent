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

  try {
    const { data, error } = await supabase
      .from('exercise_met_table')
      .select(
        'id, exercise_name, exercise_name_normalized, aliases, met_light, met_moderate, met_intense, category'
      )
      .or(
        `exercise_name.ilike.%${normalized}%,exercise_name_normalized.ilike.%${normalized}%,aliases.cs.{${normalized}}`
      )
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching exercise MET:', {
        query,
        error,
      })
      throw error
    }

    return data || null
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

