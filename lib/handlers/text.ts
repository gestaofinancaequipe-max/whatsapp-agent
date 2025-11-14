import { getConversationHistory, getOrCreateConversation } from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { classifyIntent } from '@/lib/processors/intent-classifier'
import { getOrCreateUserByPhone } from '@/lib/services/users'
import {
  recordAssistantMessage,
  recordUserMessage,
} from '@/lib/services/messages'
import { handleIntent } from '@/lib/intent-handlers'

interface TextHandlerParams {
  senderPhone: string
  text: string
  displayText?: string
}

const FALLBACK_REPLY =
  'Desculpe, tive dificuldade em responder agora. Pode tentar novamente?'

export async function handleTextMessage({
  senderPhone,
  text,
  displayText,
}: TextHandlerParams) {
  const userMessageForHistory = displayText ?? text

  try {
    const conversationId = await getOrCreateConversation(senderPhone)
    const user = await getOrCreateUserByPhone(senderPhone)
    const historyRecords = await getConversationHistory(conversationId, 10)
    const recentHistory = (() => {
      if (!historyRecords.length) return []
      const lastMessage = historyRecords[historyRecords.length - 1]
      const lastTimestamp = new Date(lastMessage.created_at).getTime()
      const now = Date.now()
      const TEN_MIN_MS = 10 * 60 * 1000
      if (now - lastTimestamp > TEN_MIN_MS) {
        return []
      }
      return historyRecords.map(({ role, content }) => ({ role, content }))
    })()

    const intentResult = classifyIntent(text)
    await recordUserMessage({
      conversationId,
      content: userMessageForHistory,
      intent: intentResult.intent,
      user: user || undefined,
    })

    const reply = await handleIntent({
      intentResult,
      messageText: text,
      user: user || undefined,
      conversationId,
      history: recentHistory,
    })

    console.log('✅ Response generated for intent:', {
      intent: intentResult.intent,
      matchedPattern: intentResult.matchedPattern,
      senderPhone,
    })

    await recordAssistantMessage({
      conversationId,
      content: reply,
      intent: intentResult.intent,
      user: user || undefined,
    })
    await sendWhatsAppMessage(senderPhone, reply)

    console.log('✅ Text message processed successfully:', {
      senderPhone,
      conversationId,
      intent: intentResult.intent,
    })
  } catch (error: any) {
    console.error('❌ Error handling text message:', {
      error: error.message,
      stack: error.stack,
      senderPhone,
    })

    await sendWhatsAppMessage(senderPhone, FALLBACK_REPLY)
  }
}

