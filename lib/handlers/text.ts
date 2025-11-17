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
import {
  getPendingMeals,
  confirmMeal,
  deletePendingMeal,
} from '@/lib/services/meals'
import {
  getPendingExercises,
  confirmExercise,
  deletePendingExercise,
} from '@/lib/services/exercises'

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
  const startTime = Date.now()
  const handlerId = `handler_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const userMessageForHistory = displayText ?? text

  console.log('🚚 Starting text message handler:', {
    handlerId,
    senderPhone,
    textPreview: text.substring(0, 50),
    timestamp: new Date().toISOString(),
  })

  try {
    const step1Start = Date.now()
    const conversationId = await getOrCreateConversation(senderPhone)
    console.log('✅ Step 1 - Conversation:', {
      handlerId,
      conversationId,
      time: Date.now() - step1Start,
    })

    const step2Start = Date.now()
    const user = await getOrCreateUserByPhone(senderPhone)
    console.log('✅ Step 2 - User:', {
      handlerId,
      userId: user?.id,
      time: Date.now() - step2Start,
    })

    // Verificar se há refeição ou exercício pendente e se a mensagem é confirmação/correção
    const normalizedText = text.trim().toLowerCase()
    
    // Palavras-chave de confirmação
    const confirmationKeywords = ['1', 'sim', 'quero', 'certo', 'confirmo', 'confirma', 'ok', 'beleza', 'pode ser']
    const correctionKeywords = ['2', 'corrigir', 'correto', 'corrige', 'errado', 'não', 'nao']
    
    const isConfirmation = confirmationKeywords.includes(normalizedText)
    const isCorrection = correctionKeywords.includes(normalizedText)
    
    if ((isConfirmation || isCorrection) && user?.id) {
      // Verificar refeição pendente primeiro
      const pendingMeals = await getPendingMeals(user.id, 1)
      
      if (pendingMeals.length > 0) {
        const pendingMeal = pendingMeals[0]
        
        if (isConfirmation) {
          // Confirmar refeição
          console.log('✅ Confirming pending meal:', {
            handlerId,
            mealId: pendingMeal.id,
            description: pendingMeal.description,
          })
          
          const confirmedMeal = await confirmMeal(pendingMeal.id)
          
          if (confirmedMeal) {
            const reply = `✅ Refeição confirmada!\n\n${confirmedMeal.description}\n${confirmedMeal.calories} kcal | ${confirmedMeal.protein_g.toFixed(1)}g proteína`
            
            await recordUserMessage({
              conversationId,
              content: text,
              intent: 'register_meal',
              user: user || undefined,
            })
            
            await recordAssistantMessage({
              conversationId,
              content: reply,
              intent: 'register_meal',
              user: user || undefined,
            })
            
            await simulateHumanDelay()
            await sendWhatsAppMessage(senderPhone, reply)
            
            console.log('✅ Meal confirmed successfully:', {
              handlerId,
              mealId: confirmedMeal.id,
              totalTime: Date.now() - startTime,
            })
            return
          }
        } else if (isCorrection) {
          // Deletar refeição pendente
          console.log('🗑️ Deleting pending meal for correction:', {
            handlerId,
            mealId: pendingMeal.id,
            description: pendingMeal.description,
          })
          
          const deleted = await deletePendingMeal(pendingMeal.id)
          
          if (deleted) {
            const reply = '🗑️ Refeição cancelada. Pode descrever novamente a refeição correta.'
            
            await recordUserMessage({
              conversationId,
              content: text,
              intent: 'register_meal',
              user: user || undefined,
            })
            
            await recordAssistantMessage({
              conversationId,
              content: reply,
              intent: 'register_meal',
              user: user || undefined,
            })
            
            await simulateHumanDelay()
            await sendWhatsAppMessage(senderPhone, reply)
            
            console.log('✅ Meal deleted for correction:', {
              handlerId,
              mealId: pendingMeal.id,
              totalTime: Date.now() - startTime,
            })
            return
          }
        }
      } else {
        // Verificar exercício pendente
        const pendingExercises = await getPendingExercises(user.id, 1)
        
        if (pendingExercises.length > 0) {
          const pendingExercise = pendingExercises[0]
          
          if (isConfirmation) {
            // Confirmar exercício
            console.log('✅ Confirming pending exercise:', {
              handlerId,
              exerciseId: pendingExercise.id,
              description: pendingExercise.description,
            })
            
            const confirmedExercise = await confirmExercise(pendingExercise.id)
            
            if (confirmedExercise) {
              const reply = `✅ Exercício confirmado!\n\n${confirmedExercise.description}\n${confirmedExercise.calories_burned} kcal queimadas`
              
              await recordUserMessage({
                conversationId,
                content: text,
                intent: 'register_exercise',
                user: user || undefined,
              })
              
              await recordAssistantMessage({
                conversationId,
                content: reply,
                intent: 'register_exercise',
                user: user || undefined,
              })
              
              await simulateHumanDelay()
              await sendWhatsAppMessage(senderPhone, reply)
              
              console.log('✅ Exercise confirmed successfully:', {
                handlerId,
                exerciseId: confirmedExercise.id,
                totalTime: Date.now() - startTime,
              })
              return
            }
          } else if (isCorrection) {
            // Deletar exercício pendente
            console.log('🗑️ Deleting pending exercise for correction:', {
              handlerId,
              exerciseId: pendingExercise.id,
              description: pendingExercise.description,
            })
            
            const deleted = await deletePendingExercise(pendingExercise.id)
            
            if (deleted) {
              const reply = '🗑️ Exercício cancelado. Pode descrever novamente o exercício correto.'
              
              await recordUserMessage({
                conversationId,
                content: text,
                intent: 'register_exercise',
                user: user || undefined,
              })
              
              await recordAssistantMessage({
                conversationId,
                content: reply,
                intent: 'register_exercise',
                user: user || undefined,
              })
              
              await simulateHumanDelay()
              await sendWhatsAppMessage(senderPhone, reply)
              
              console.log('✅ Exercise deleted for correction:', {
                handlerId,
                exerciseId: pendingExercise.id,
                totalTime: Date.now() - startTime,
              })
              return
            }
          }
        }
      }
    }

    const step3Start = Date.now()
    const conversationContext = await getConversationContext(conversationId)
    console.log('✅ Step 3 - Context:', {
      handlerId,
      historyLength: conversationContext.history.length,
      lastIntent: conversationContext.lastIntent,
      time: Date.now() - step3Start,
    })

    // Buscar todas as mensagens desde a última resposta do assistente
    const step4Start = Date.now()
    const messagesSinceLastResponse = await getMessagesSinceLastAssistantResponse(conversationId)
    console.log('✅ Step 4 - Messages since last response:', {
      handlerId,
      count: messagesSinceLastResponse.length,
      time: Date.now() - step4Start,
    })

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
    const step5Start = Date.now()
    console.log('🤖 Step 5 - Classifying intent...', {
      handlerId,
      messageCount: messagesSinceLastResponse.length,
    })
    const intentResult = await classifyIntent(messagesSinceLastResponse, {
      lastIntent: conversationContext.lastIntent,
      history: conversationContext.history,
    })
    console.log('✅ Step 5 - Intent classified:', {
      handlerId,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      matchedPattern: intentResult.matchedPattern,
      time: Date.now() - step5Start,
    })

    // Salvar mensagem do usuário
    const step6Start = Date.now()
    await recordUserMessage({
      conversationId,
      content: userMessageForHistory,
      intent: intentResult.intent,
      user: user || undefined,
    })
    console.log('✅ Step 6 - User message saved:', {
      handlerId,
      time: Date.now() - step6Start,
    })

    // Gerar resposta
    const step7Start = Date.now()
    console.log('💭 Step 7 - Generating reply...', { handlerId })
    const reply = await handleIntent({
      intentResult,
      messageText: text, // Usar texto original para processamento
      user: user || undefined,
      conversationId,
      history: conversationContext.history,
    })
    console.log('✅ Step 7 - Reply generated:', {
      handlerId,
      replyLength: reply.length,
      replyPreview: reply.substring(0, 100),
      time: Date.now() - step7Start,
    })

    // Salvar resposta do assistente
    const step8Start = Date.now()
    await recordAssistantMessage({
      conversationId,
      content: reply,
      intent: intentResult.intent,
      user: user || undefined,
    })
    console.log('✅ Step 8 - Assistant message saved:', {
      handlerId,
      time: Date.now() - step8Start,
    })

    // Simular delay humano antes de enviar
    const step9Start = Date.now()
    console.log('⏳ Step 9 - Simulating human delay...', { handlerId })
    await simulateHumanDelay()
    console.log('✅ Step 9 - Delay completed:', {
      handlerId,
      delayTime: Date.now() - step9Start,
    })

    // Enviar resposta
    const step10Start = Date.now()
    console.log('📤 Step 10 - Sending WhatsApp message...', { handlerId })
    await sendWhatsAppMessage(senderPhone, reply)
    console.log('✅ Step 10 - Message sent:', {
      handlerId,
      time: Date.now() - step10Start,
    })

    console.log('✅ Text message processed successfully:', {
      handlerId,
      senderPhone,
      conversationId,
      intent: intentResult.intent,
      totalTime: Date.now() - startTime,
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

