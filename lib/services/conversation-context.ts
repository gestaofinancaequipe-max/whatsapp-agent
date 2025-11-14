import { getConversationHistory } from '@/lib/services/supabase'
import { IntentType } from '@/lib/types/intents'

const CONTEXT_MAX_MINUTES = 10

export interface ConversationContext {
  history: Array<{ role: string; content: string; created_at: string; intent?: IntentType | null }>
  lastIntent?: IntentType
  lastIntentTimestamp?: string
}

export async function getConversationContext(
  conversationId: string
): Promise<ConversationContext> {
  const history = await getConversationHistory(conversationId, 10)

  const lastMessage = history[history.length - 1]
  if (
    lastMessage &&
    Date.now() - new Date(lastMessage.created_at).getTime() >
      CONTEXT_MAX_MINUTES * 60 * 1000
  ) {
    return { history: [] }
  }

  return {
    history,
    lastIntent: findLastIntent(history),
    lastIntentTimestamp: findLastIntentTimestamp(history),
  }
}

function findLastIntent(
  history: Array<{ role: string; intent?: IntentType | null }>
): IntentType | undefined {
  const last = [...history]
    .reverse()
    .find((msg) => msg.role === 'user' && msg.intent && msg.intent !== 'unknown')
  return last?.intent || undefined
}

function findLastIntentTimestamp(
  history: Array<{ role: string; created_at: string; intent?: IntentType | null }>
): string | undefined {
  const last = [...history]
    .reverse()
    .find((msg) => msg.role === 'user' && msg.intent && msg.intent !== 'unknown')
  return last?.created_at
}

