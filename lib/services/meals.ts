import { getSupabaseClient } from '@/lib/services/supabase'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import { updateUserStreaks } from '@/lib/services/gamification'

export interface MealRecord {
  id: string
  user_id: string
  daily_summary_id: string
  description: string
  calories: number
  protein_g: number
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  status: string
  original_estimate: any
}

export async function createPendingMeal({
  userId,
  description,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  originalEstimate,
}: {
  userId: string
  description: string
  calories: number
  protein: number
  carbs: number | null
  fat: number | null
  fiber: number | null
  originalEstimate: any
}): Promise<MealRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const dailySummary = await getOrCreateDailySummary(userId)
  if (!dailySummary) return null

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      daily_summary_id: dailySummary.id,
      description,
      calories: Math.round(calories),
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
      status: 'pending',
      original_estimate: originalEstimate,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('❌ Error creating pending meal:', error)
    return null
  }

  await updateUserStreaks(userId)

  return data as MealRecord
}


