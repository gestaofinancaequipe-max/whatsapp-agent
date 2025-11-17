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
  console.log('🔎 Searching food item:', { query, normalized })

  try {
    // Estratégia de busca em cascata: exato -> starts with -> palavras completas -> parcial com validação
    
    // 1. Match exato (case-insensitive)
    const { data: exactMatch } = await supabase
      .from('food_items')
      .select(
        'id, name, name_normalized, aliases, serving_size, serving_size_grams, calories, protein_g, carbs_g, fat_g, fiber_g, common_measures, usage_count'
      )
      .or(`name.ilike.${normalized},name_normalized.ilike.${normalized},aliases.cs.{${normalized}}`)
      .order('usage_count', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactMatch) {
      console.log('🔎 Food search result (exact match):', {
        query,
        found: true,
        foodName: exactMatch.name,
        matchType: 'exact',
      })
      return exactMatch
    }

    // 2. Match que começa com o termo
    const { data: startsWithMatch } = await supabase
      .from('food_items')
      .select(
        'id, name, name_normalized, aliases, serving_size, serving_size_grams, calories, protein_g, carbs_g, fat_g, fiber_g, common_measures, usage_count'
      )
      .or(`name.ilike.${normalized}%,name_normalized.ilike.${normalized}%`)
      .order('usage_count', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (startsWithMatch) {
      console.log('🔎 Food search result (starts with match):', {
        query,
        found: true,
        foodName: startsWithMatch.name,
        matchType: 'starts_with',
      })
      return startsWithMatch
    }

    // 3. Para queries curtas (<= 5 caracteres), não fazer busca parcial
    // Isso evita matches ruins como "pera" encontrando "temperada"
    const isShortQuery = normalized.length <= 5
    
    if (isShortQuery) {
      console.log('🔎 Food search result:', {
        query,
        found: false,
        matchType: 'none',
        reason: 'short_query_no_exact_match_prevent_false_positive',
      })
      return null
    }
    
    // 4. Match parcial com palavras completas (apenas para queries longas)
    const words = normalized.split(/\s+/).filter(w => w.length >= 3) // Palavras com pelo menos 3 caracteres
    
    if (words.length > 0) {
      // Buscar candidatos que contenham as palavras
      const { data: candidates } = await supabase
        .from('food_items')
        .select(
          'id, name, name_normalized, aliases, serving_size, serving_size_grams, calories, protein_g, carbs_g, fat_g, fiber_g, common_measures, usage_count'
        )
        .or(
          words.map(word => `name_normalized.ilike.%${word}%`).join(',')
        )
        .order('usage_count', { ascending: false })
        .limit(20)

      if (candidates && candidates.length > 0) {
        // Filtrar candidatos: procurar palavras completas (word boundaries)
        for (const candidate of candidates) {
          const candidateName = (candidate.name_normalized || candidate.name).toLowerCase()
          
          // Verificar se todas as palavras estão presentes como palavras completas
          const hasAllWords = words.every(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i')
            return regex.test(candidateName)
          })

          if (hasAllWords) {
            console.log('🔎 Food search result (full words match):', {
              query,
              found: true,
              foodName: candidate.name,
              matchType: 'full_words',
            })
            return candidate
          }
        }
      }
    }

    // Se não encontrou nada, retornar null
    console.log('🔎 Food search result:', {
      query,
      found: false,
      matchType: 'none',
    })

    return null
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

