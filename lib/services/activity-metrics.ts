import { getSupabaseClient } from '@/lib/services/supabase'

export async function countMealsForDate(
  userId: string,
  date: string
): Promise<number> {
  const supabase = getSupabaseClient()
  if (!supabase) return 0

  const { count } = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)

  return count || 0
}

export async function countExercisesForDate(
  userId: string,
  date: string
): Promise<number> {
  const supabase = getSupabaseClient()
  if (!supabase) return 0

  const { count } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)

  return count || 0
}

