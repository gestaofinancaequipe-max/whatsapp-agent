import { getOrCreateConversation, saveMessage } from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { classifyIntent } from '@/lib/processors/intent-classifier'
import { generateMockResponse } from '@/lib/handlers/response-handler'

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
    await saveMessage(conversationId, 'user', userMessageForHistory)

    const intentResult = classifyIntent(text)
    const reply = generateMockResponse(intentResult.intent, text)

    console.log('✅ Response generated for intent:', {
      intent: intentResult.intent,
      matchedPattern: intentResult.matchedPattern,
      senderPhone,
    })

    await saveMessage(conversationId, 'assistant', reply)
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

