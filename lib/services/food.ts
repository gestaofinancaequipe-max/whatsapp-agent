import { getSupabaseClient } from '@/lib/services/supabase'
import { sanitizeFoodQuery } from '@/lib/utils/text'

export interface FoodItem {
  id: string
  name: string
  name_normalized: string
  aliases: string[] | null
  serving_size: string | null
  serving_size_grams: number | null
  calories: number
  protein_g: number
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  common_measures: any | null
  usage_count?: number | null
}

export async function findFoodItem(query: string): Promise<FoodItem | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const normalized = sanitizeFoodQuery(query)

  try {
    const { data, error } = await supabase
      .from('food_items')
      .select(
        'id, name, name_normalized, aliases, serving_size, serving_size_grams, calories, protein_g, carbs_g, fat_g, fiber_g, common_measures, usage_count'
      )
      .or(
        `name.ilike.%${normalized}%,name_normalized.ilike.%${normalized}%,aliases.cs.{${normalized}}`
      )
      .order('usage_count', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error searching food_items:', {
        query,
        error,
      })
      throw error
    }

    return data || null
  } catch (error: any) {
    console.error('❌ findFoodItem failed:', {
      error: error.message,
      query,
    })
    return null
  }
}

export async function incrementFoodUsage(
  foodId: string,
  currentCount?: number | null
) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const nextCount =
    typeof currentCount === 'number' && !Number.isNaN(currentCount)
      ? currentCount + 1
      : 1

  const { error } = await supabase
    .from('food_items')
    .update({
      usage_count: nextCount,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', foodId)

  if (error) {
    console.error('❌ Error updating food usage:', {
      foodId,
      error,
    })
  }
}

