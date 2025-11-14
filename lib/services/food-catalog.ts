import { getSupabaseClient } from '@/lib/services/supabase'

interface CatalogCache {
  updatedAt: number
  items: string[]
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora
let catalogCache: CatalogCache | null = null

export async function getFoodCatalog(): Promise<string[]> {
  const now = Date.now()
  if (catalogCache && now - catalogCache.updatedAt < CACHE_TTL_MS) {
    return catalogCache.items
  }

  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('food_items')
    .select('name')
    .order('usage_count', { ascending: false })
    .limit(500)

  if (error || !data) {
    console.error('❌ Error fetching food catalog:', error)
    return []
  }

  const items = data
    .map((row) => row.name?.trim())
    .filter((name): name is string => !!name)

  catalogCache = {
    updatedAt: now,
    items,
  }

  return items
}

