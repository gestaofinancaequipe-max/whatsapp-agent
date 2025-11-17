import { getSupabaseClient } from '@/lib/services/supabase'

export interface UserRecord {
  id: string
  phone_number: string
  user_name: string | null
  gender: string | null // 'masculino' ou 'feminino'
  goal_calories: number | null
  goal_protein_g: number | null
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  last_interaction_at: string | null
  last_user_message_at: string | null
}

const DEFAULT_GOAL_CALORIES = 2000
const DEFAULT_GOAL_PROTEIN = 150

export async function getOrCreateUserByPhone(
  phoneNumber: string
): Promise<UserRecord | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return null
  }

  try {
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching user by phone:', {
        phoneNumber,
        error,
      })
      throw error
    }

    if (existingUser) {
      return existingUser as UserRecord
    }

    const timestamp = new Date().toISOString()

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        phone_number: phoneNumber,
        goal_calories: DEFAULT_GOAL_CALORIES,
        goal_protein_g: DEFAULT_GOAL_PROTEIN,
        created_at: timestamp,
        updated_at: timestamp,
        last_interaction_at: timestamp,
      })
      .select('*')
      .single()

    if (insertError || !newUser) {
      console.error('❌ Error creating user by phone:', insertError)
      throw insertError || new Error('Failed to create user')
    }

    return newUser as UserRecord
  } catch (error: any) {
    console.error('❌ getOrCreateUserByPhone failed:', {
      error: error.message,
      phoneNumber,
    })
    return null
  }
}

export async function updateUserInteractionTimestamps(
  userId: string,
  options: { userMessage?: boolean } = {}
) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return
  }

  const now = new Date().toISOString()
  const payload: Record<string, string> = {
    last_interaction_at: now,
  }

  if (options.userMessage) {
    payload.last_user_message_at = now
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)

  if (error) {
    console.error('❌ Error updating user interaction timestamps:', {
      userId,
      error,
    })
  }
}

export async function upsertUserData(
  userId: string,
  fields: Partial<UserRecord>
) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const payload = {
    ...fields,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('users').update(payload).eq('id', userId)

  if (error) {
    console.error('❌ Error updating user data:', {
      userId,
      error,
    })
  }
}

