import { getSupabaseClient } from '@/lib/services/supabase'

export interface DailySummary {
  id: string
  user_id: string
  date: string
  total_calories_consumed: number
  total_calories_burned: number
  net_calories: number
  total_protein_g: number
  created_at: string
}

function getTodayDate(): string {
  return new Date().toISOString().substring(0, 10)
}

export async function getOrCreateDailySummary(
  userId: string,
  date: string = getTodayDate()
): Promise<DailySummary | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching daily summary:', error)
      throw error
    }

    if (data) {
      return data as DailySummary
    }

    const { data: created, error: insertError } = await supabase
      .from('daily_summaries')
      .insert({
        user_id: userId,
        date,
        total_calories_consumed: 0,
        total_calories_burned: 0,
        net_calories: 0,
        total_protein_g: 0,
      })
      .select('*')
      .single()

    if (insertError || !created) {
      console.error('❌ Error creating daily summary:', insertError)
      throw insertError || new Error('Failed to create daily summary')
    }

    return created as DailySummary
  } catch (error: any) {
    console.error('❌ getOrCreateDailySummary failed:', {
      error: error.message,
      userId,
      date,
    })
    return null
  }
}

export async function updateDailySummary(
  summaryId: string,
  fields: Partial<DailySummary>
) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const payload = {
    ...fields,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('daily_summaries')
    .update(payload)
    .eq('id', summaryId)

  if (error) {
    console.error('❌ Error updating daily summary:', {
      summaryId,
      error,
    })
  }
}

