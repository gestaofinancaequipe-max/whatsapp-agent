import { getSupabaseClient } from '@/lib/services/supabase'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import { updateUserStreaks } from '@/lib/services/gamification'

export interface ExerciseRecord {
  id: string
  user_id: string
  daily_summary_id: string
  description: string
  exercise_type: string
  duration_minutes: number
  intensity: string
  met_value: number
  calories_burned: number
  status: string
}

export async function createPendingExercise({
  userId,
  description,
  exerciseType,
  durationMinutes,
  intensity,
  metValue,
  caloriesBurned,
}: {
  userId: string
  description: string
  exerciseType: string
  durationMinutes: number
  intensity: string
  metValue: number
  caloriesBurned: number
}): Promise<ExerciseRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const summary = await getOrCreateDailySummary(userId)
  if (!summary) return null

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      daily_summary_id: summary.id,
      description,
      exercise_type: exerciseType,
      duration_minutes: durationMinutes,
      intensity,
      met_value: metValue,
      calories_burned: Math.round(caloriesBurned),
      status: 'pending',
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('❌ Error creating pending exercise:', error)
    return null
  }

  await updateUserStreaks(userId)

  return data as ExerciseRecord
}

