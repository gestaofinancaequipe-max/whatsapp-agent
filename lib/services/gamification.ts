import { getSupabaseClient } from '@/lib/services/supabase'
import { getTodayDateBR, getYesterdayDateBR } from '@/lib/utils/date-br'

export async function updateUserStreaks(userId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const today = getTodayDateBR()
  const yesterdayStr = getYesterdayDateBR()

  const { data: user, error } = await supabase
    .from('users')
    .select(
      'current_streak_days, longest_streak_days, total_days_logged, last_user_message_at'
    )
    .eq('id', userId)
    .single()

  if (error || !user) {
    console.error('❌ Error fetching user for streaks:', error)
    return
  }

  // Converter last_user_message_at (UTC) para data no horário do Brasil
  const lastDate = user.last_user_message_at
    ? (() => {
        const dateUTC = new Date(user.last_user_message_at)
        // Converter para horário do Brasil usando Intl.DateTimeFormat
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const parts = formatter.formatToParts(dateUTC)
        const year = parts.find(p => p.type === 'year')?.value || ''
        const month = parts.find(p => p.type === 'month')?.value || ''
        const day = parts.find(p => p.type === 'day')?.value || ''
        return `${year}-${month}-${day}`
      })()
    : null

  let currentStreak = user.current_streak_days || 0
  if (lastDate === today) {
    // already counted today
  } else if (lastDate === yesterdayStr) {
    currentStreak += 1
  } else {
    currentStreak = 1
  }

  const longestStreak = Math.max(user.longest_streak_days || 0, currentStreak)
  const totalDays =
    lastDate === today ? user.total_days_logged || 0 : (user.total_days_logged || 0) + 1

  const { error: updateError } = await supabase
    .from('users')
    .update({
      current_streak_days: currentStreak,
      longest_streak_days: longestStreak,
      total_days_logged: totalDays,
      last_interaction_at: new Date().toISOString(),
      last_user_message_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    console.error('❌ Error updating streaks:', updateError)
  }
}

