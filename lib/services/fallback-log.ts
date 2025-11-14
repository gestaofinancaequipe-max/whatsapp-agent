import { getSupabaseClient } from '@/lib/services/supabase'
import { sanitizeFoodQuery } from '@/lib/utils/text'

export async function logFoodFallback({
  query,
  phoneNumber,
}: {
  query: string
  phoneNumber: string
}) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const normalized = sanitizeFoodQuery(query)

  const { error } = await supabase.from('api_fallback_log').insert({
    search_query: query,
    normalized_query: normalized,
    user_phone: phoneNumber,
    intent: 'log_food',
    found_in_db: false,
    found_in_api: false,
    api_used: 'local_db',
  })

  if (error) {
    console.error('❌ Error logging fallback food:', error)
  }
}

