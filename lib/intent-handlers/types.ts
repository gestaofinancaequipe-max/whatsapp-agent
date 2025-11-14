import { IntentResult } from '@/lib/types/intents'
import { UserRecord } from '@/lib/services/users'

export interface IntentContext {
  intentResult: IntentResult
  messageText: string
  user?: UserRecord | null
  conversationId: string
  history: Array<{ role: string; content: string }>
}

