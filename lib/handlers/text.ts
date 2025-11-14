import { processTextWithGroq } from '@/lib/services/groq'
import {
  getConversationHistory,
  getOrCreateConversation,
  saveMessage,
} from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

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

  const conversationId = await getOrCreateConversation(senderPhone)
  const history = await getConversationHistory(conversationId, 10)

  await saveMessage(conversationId, 'user', userMessageForHistory)

  let reply = await processTextWithGroq(text, history)

  if (!reply || reply.trim().length === 0) {
    reply = FALLBACK_REPLY
  }

  await saveMessage(conversationId, 'assistant', reply)
  await sendWhatsAppMessage(senderPhone, reply)

  console.log('✅ Text message processed successfully:', {
    senderPhone,
    conversationId,
    replyLength: reply.length,
  })
}

