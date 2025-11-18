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

/**
 * Recalcula o daily_summary a partir das refeições confirmadas
 * Útil quando há inconsistências nos dados agregados
 */
export async function recalculateDailySummary(
  dailySummaryId: string
): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  try {
    // Buscar todas as refeições confirmadas deste daily_summary
    const { data: confirmedMeals, error: mealsError } = await supabase
      .from('meals')
      .select('calories, protein_g')
      .eq('daily_summary_id', dailySummaryId)
      .eq('status', 'confirmed')

    if (mealsError) {
      console.error('❌ Error fetching confirmed meals for recalculation:', mealsError)
      return false
    }

    // Somar todos os valores
    const totalCalories = (confirmedMeals || []).reduce(
      (sum, meal) => sum + Math.round(meal.calories || 0),
      0
    )
    const totalProtein = (confirmedMeals || []).reduce(
      (sum, meal) => sum + (meal.protein_g || 0),
      0
    )

    // Buscar o daily_summary para obter o total_calories_burned
    const { data: dailySummary, error: summaryError } = await supabase
      .from('daily_summaries')
      .select('total_calories_burned')
      .eq('id', dailySummaryId)
      .single()

    if (summaryError) {
      console.error('❌ Error fetching daily summary for recalculation:', summaryError)
      return false
    }

    const totalBurned = dailySummary?.total_calories_burned || 0
    const netCalories = totalCalories - totalBurned

    // Atualizar o daily_summary com os valores recalculados
    const { error: updateError } = await supabase
      .from('daily_summaries')
      .update({
        total_calories_consumed: totalCalories,
        total_protein_g: totalProtein,
        net_calories: netCalories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dailySummaryId)

    if (updateError) {
      console.error('❌ Error updating daily summary after recalculation:', updateError)
      return false
    }

    console.log('✅ Daily summary recalculated:', {
      dailySummaryId,
      totalCalories,
      totalProtein,
      netCalories,
    })

    return true
  } catch (error: any) {
    console.error('❌ Error in recalculateDailySummary:', {
      error: error.message,
      dailySummaryId,
    })
    return false
  }
}

/**
 * Deleta uma refeição (pendente ou confirmada) e atualiza o daily_summary se necessário
 */
export async function deleteMeal(mealId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) return false

  try {
    // Primeiro, buscar a refeição para saber se é confirmada e qual o daily_summary_id
    const { data: meal, error: fetchError } = await supabase
      .from('meals')
      .select('id, status, daily_summary_id, calories, protein_g')
      .eq('id', mealId)
      .single()

    if (fetchError || !meal) {
      console.error('❌ Error fetching meal for deletion:', fetchError)
      return false
    }

    const isConfirmed = meal.status === 'confirmed'
    const dailySummaryId = meal.daily_summary_id

    // Deletar a refeição
    const { error: deleteError } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId)

    if (deleteError) {
      console.error('❌ Error deleting meal:', deleteError)
      return false
    }

    // Se era uma refeição confirmada, recalcular o daily_summary
    if (isConfirmed && dailySummaryId) {
      await recalculateDailySummary(dailySummaryId)
    }

    console.log('✅ Meal deleted:', {
      mealId,
      wasConfirmed: isConfirmed,
      dailySummaryId,
    })

    return true
  } catch (error: any) {
    console.error('❌ Error in deleteMeal:', {
      error: error.message,
      mealId,
    })
    return false
  }
}


