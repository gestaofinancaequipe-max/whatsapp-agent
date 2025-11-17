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

/**
 * Busca exercícios pendentes do usuário (mais recente primeiro)
 */
export async function getPendingExercises(
  userId: string,
  limit: number = 1
): Promise<ExerciseRecord[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Error fetching pending exercises:', error)
    return []
  }

  return (data || []) as ExerciseRecord[]
}

/**
 * Confirma um exercício pendente (muda status para 'confirmed')
 */
export async function confirmExercise(exerciseId: string): Promise<ExerciseRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('exercises')
    .update({ status: 'confirmed' })
    .eq('id', exerciseId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (error || !data) {
    console.error('❌ Error confirming exercise:', error)
    return null
  }

  // Atualizar daily_summary com os valores confirmados
  const exercise = data as ExerciseRecord
  
  const { data: dailySummary } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('id', exercise.daily_summary_id)
    .single()

  if (dailySummary) {
    const { error: updateError } = await supabase
      .from('daily_summaries')
      .update({
        total_calories_burned: (dailySummary.total_calories_burned || 0) + Math.round(exercise.calories_burned),
        net_calories: (dailySummary.net_calories || 0) - Math.round(exercise.calories_burned),
      })
      .eq('id', exercise.daily_summary_id)

    if (updateError) {
      console.error('❌ Error updating daily summary from exercise:', updateError)
    }
  }

  return exercise
}

/**
 * Deleta um exercício pendente (para correção)
 */
export async function deletePendingExercise(exerciseId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', exerciseId)
    .eq('status', 'pending')

  if (error) {
    console.error('❌ Error deleting pending exercise:', error)
    return false
  }

  return true
}

