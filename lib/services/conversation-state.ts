import { getSupabaseClient } from './supabase'

export interface ConversationState {
  phoneNumber: string
  lastIntent: string
  awaitingInput?: {
    type: 'confirmation' | 'data' | 'choice'
    context: any
    expiresAt: string // ISO string
  }
  onboardingStep?: 'name' | 'physical_data' | 'goal' | 'complete'
}

/**
 * Salva estado da conversa
 */
export async function saveConversationState(
  conversationId: string,
  state: ConversationState
): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  // Salvar apenas conversation_state
  // (expiresAt já está dentro do JSON do state, não precisa de coluna separada)
  const { error } = await supabase
    .from('conversations')
    .update({
      conversation_state: state,
    })
    .eq('id', conversationId)

  if (error) {
    console.error('❌ Error saving conversation state:', error)
  } else {
    console.log('✅ Conversation state saved:', {
      conversationId,
      lastIntent: state.lastIntent,
      awaitingInput: state.awaitingInput?.type,
    })
  }
}

/**
 * Recupera estado da conversa
 */
export async function getConversationState(
  conversationId: string
): Promise<ConversationState | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('conversations')
    .select('conversation_state')
    .eq('id', conversationId)
    .single()

  if (error || !data?.conversation_state) {
    return null
  }

  const state = data.conversation_state as ConversationState

  // Verificar se expirou (expiresAt está dentro do JSON)
  if (state.awaitingInput?.expiresAt) {
    const expiresAt = new Date(state.awaitingInput.expiresAt)
    if (expiresAt < new Date()) {
      console.log('⏰ Conversation state expired, clearing...')
      await clearConversationState(conversationId)
      return null
    }
  }

  return state
}

/**
 * Limpa estado da conversa
 */
export async function clearConversationState(
  conversationId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { error } = await supabase
    .from('conversations')
    .update({
      conversation_state: null,
    })
    .eq('id', conversationId)

  if (error) {
    console.error('❌ Error clearing conversation state:', error)
  } else {
    console.log('✅ Conversation state cleared:', conversationId)
  }
}

