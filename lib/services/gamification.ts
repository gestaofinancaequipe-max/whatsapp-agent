import { getSupabaseClient } from '@/lib/services/supabase'

function getTodayDate() {
  return new Date().toISOString().substring(0, 10)
}

export async function updateUserStreaks(userId: string) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const today = getTodayDate()

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

  const lastDate = user.last_user_message_at
    ? user.last_user_message_at.substring(0, 10)
    : null

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().substring(0, 10)

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

