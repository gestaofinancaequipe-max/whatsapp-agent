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
  created_at?: string
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

/**
 * Busca refeições pendentes do usuário (mais recente primeiro)
 */
export async function getPendingMeals(
  userId: string,
  limit: number = 1
): Promise<MealRecord[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Error fetching pending meals:', error)
    return []
  }

  return (data || []) as MealRecord[]
}

/**
 * Confirma uma refeição pendente (muda status para 'confirmed')
 */
export async function confirmMeal(mealId: string): Promise<MealRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('meals')
    .update({ status: 'confirmed' })
    .eq('id', mealId)
    .eq('status', 'pending') // Apenas atualizar se ainda estiver pendente
    .select('*')
    .single()

  if (error || !data) {
    console.error('❌ Error confirming meal:', error)
    return null
  }

  // Atualizar daily_summary com os valores confirmados
  const meal = data as MealRecord
  
  // Buscar o daily_summary e atualizar manualmente
  const { data: dailySummary } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('id', meal.daily_summary_id)
    .single()

  if (dailySummary) {
    const { error: updateError } = await supabase
      .from('daily_summaries')
      .update({
        total_calories_consumed: (dailySummary.total_calories_consumed || 0) + Math.round(meal.calories),
        total_protein_g: (dailySummary.total_protein_g || 0) + meal.protein_g,
        net_calories: (dailySummary.net_calories || 0) + Math.round(meal.calories),
      })
      .eq('id', meal.daily_summary_id)

    if (updateError) {
      console.error('❌ Error updating daily summary from meal:', updateError)
      // Não falhar a confirmação se o update do summary falhar
    }
  }

  return meal
}

/**
 * Deleta uma refeição pendente (para correção)
 */
export async function deletePendingMeal(mealId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)
    .eq('status', 'pending') // Apenas deletar se ainda estiver pendente

  if (error) {
    console.error('❌ Error deleting pending meal:', error)
    return false
  }

  return true
}

/**
 * Cria uma refeição diretamente confirmada (usado quando usuário confirma dados temporários)
 */
export async function createConfirmedMeal({
  userId,
  dailySummaryId,
  description,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  originalEstimate,
}: {
  userId: string
  dailySummaryId: string
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

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      daily_summary_id: dailySummaryId,
      description,
      calories: Math.round(calories),
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
      status: 'confirmed', // Criar direto como confirmado
      original_estimate: originalEstimate,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('❌ Error creating confirmed meal:', error)
    return null
  }

  const meal = data as MealRecord

  // Atualizar daily_summary imediatamente
  const { data: dailySummary } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('id', dailySummaryId)
    .single()

  if (dailySummary) {
    const { error: updateError } = await supabase
      .from('daily_summaries')
      .update({
        total_calories_consumed: (dailySummary.total_calories_consumed || 0) + Math.round(calories),
        total_protein_g: (dailySummary.total_protein_g || 0) + protein,
        net_calories: (dailySummary.net_calories || 0) + Math.round(calories),
      })
      .eq('id', dailySummaryId)

    if (updateError) {
      console.error('❌ Error updating daily summary from confirmed meal:', updateError)
    }
  }

  await updateUserStreaks(userId)

  return meal
}


