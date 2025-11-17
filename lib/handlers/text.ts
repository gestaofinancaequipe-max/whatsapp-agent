import { getOrCreateConversation, getMessagesSinceLastAssistantResponse } from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { classifyIntent } from '@/lib/processors/intent-classifier'
import { getOrCreateUserByPhone } from '@/lib/services/users'
import {
  recordAssistantMessage,
  recordUserMessage,
} from '@/lib/services/messages'
import { handleIntent } from '@/lib/intent-handlers'
import { getConversationContext } from '@/lib/services/conversation-context'
import { simulateHumanDelay } from '@/lib/utils/delay'

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
    const conversationContext = await getConversationContext(conversationId)

    // Buscar todas as mensagens desde a última resposta do assistente
    const messagesSinceLastResponse = await getMessagesSinceLastAssistantResponse(conversationId)
    
    // Se não há mensagens anteriores, adicionar a mensagem atual
    if (messagesSinceLastResponse.length === 0) {
      messagesSinceLastResponse.push({
        role: 'user',
        content: userMessageForHistory,
        created_at: new Date().toISOString(),
      })
    } else {
      // Adicionar mensagem atual ao array (caso ainda não esteja salva)
      const lastMessage = messagesSinceLastResponse[messagesSinceLastResponse.length - 1]
      if (lastMessage.content !== userMessageForHistory) {
        messagesSinceLastResponse.push({
          role: 'user',
          content: userMessageForHistory,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Classificar intent usando todas as mensagens desde última resposta
    const intentResult = await classifyIntent(messagesSinceLastResponse, {
      lastIntent: conversationContext.lastIntent,
      history: conversationContext.history,
    })

    // Salvar mensagem do usuário
    await recordUserMessage({
      conversationId,
      content: userMessageForHistory,
      intent: intentResult.intent,
      user: user || undefined,
    })

    // Gerar resposta
    const reply = await handleIntent({
      intentResult,
      messageText: text, // Usar texto original para processamento
      user: user || undefined,
      conversationId,
      history: conversationContext.history,
    })

    console.log('✅ Response generated for intent:', {
      intent: intentResult.intent,
      matchedPattern: intentResult.matchedPattern,
      senderPhone,
    })

    // Salvar resposta do assistente
    await recordAssistantMessage({
      conversationId,
      content: reply,
      intent: intentResult.intent,
      user: user || undefined,
    })

    // Simular delay humano antes de enviar
    await simulateHumanDelay()

    // Enviar resposta
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

