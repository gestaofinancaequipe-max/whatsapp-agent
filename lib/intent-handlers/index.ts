import { IntentResult } from '@/lib/types/intents'
import { generateMockResponse } from '@/lib/handlers/response-handler'
import { UserRecord } from '@/lib/services/users'

interface IntentHandlerPayload {
  intentResult: IntentResult
  messageText: string
  user?: UserRecord | null
  conversationId: string
}

export async function handleIntent({
  intentResult,
  messageText,
  user,
}: IntentHandlerPayload): Promise<string> {
  console.log('🧭 Routing intent to handler:', {
    intent: intentResult.intent,
    userId: user?.id,
  })

  // Placeholder: future implementations will replace this switch
  const reply = generateMockResponse(intentResult.intent, messageText)
  console.log('✅ Intent handler executed:', {
    intent: intentResult.intent,
  })

  return reply
}

