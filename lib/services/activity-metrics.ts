import { getSupabaseClient } from '@/lib/services/supabase'
import { getDateRangeUTC } from '@/lib/utils/date-br'

export async function countMealsForDate(
  userId: string,
  date: string
): Promise<number> {
  const supabase = getSupabaseClient()
  if (!supabase) return 0

  // Converter data do horário do Brasil para range UTC
  const { start, end } = getDateRangeUTC(date)

  const { count } = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)

  return count || 0
}

export async function countExercisesForDate(
  userId: string,
  date: string
): Promise<number> {
  const supabase = getSupabaseClient()
  if (!supabase) return 0

  // Converter data do horário do Brasil para range UTC
  const { start, end } = getDateRangeUTC(date)

  const { count } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)

  return count || 0
}

