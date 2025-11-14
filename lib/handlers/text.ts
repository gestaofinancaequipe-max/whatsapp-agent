import { getOrCreateConversation } from '@/lib/services/supabase'
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

