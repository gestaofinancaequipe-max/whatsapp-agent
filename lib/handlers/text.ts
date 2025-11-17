import { getOrCreateConversation, getMessagesSinceLastAssistantResponse, getLastAssistantMessage } from '@/lib/services/supabase'
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
import { extractTempData, removeTempData, TemporaryMealData, TemporaryExerciseData } from '@/lib/utils/temp-data'
import { createConfirmedMeal } from '@/lib/services/meals'
import { createConfirmedExercise } from '@/lib/services/exercises'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'

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
    // Otimização: Paralelizar Step 1 e Step 2
    const step1And2Start = Date.now()
    const [conversationId, user] = await Promise.all([
      getOrCreateConversation(senderPhone),
      getOrCreateUserByPhone(senderPhone),
    ])
    console.log('✅ Step 1 & 2 - Conversation & User (parallelized):', {
      handlerId,
      conversationId,
      userId: user?.id,
      time: Date.now() - step1And2Start,
    })

    // Verificar se a mensagem é confirmação/correção e buscar dados temporários
    const normalizedText = text.trim().toLowerCase()
    
    // Palavras-chave de confirmação
    const confirmationKeywords = ['1', 'sim', 'quero', 'certo', 'confirmo', 'confirma', 'ok', 'beleza', 'pode ser']
    const correctionKeywords = ['2', 'corrigir', 'correto', 'corrige', 'errado', 'não', 'nao']
    
    const isConfirmation = confirmationKeywords.includes(normalizedText)
    const isCorrection = correctionKeywords.includes(normalizedText)
    
    if ((isConfirmation || isCorrection) && user?.id) {
      // Buscar última mensagem do assistente para extrair dados temporários
      const lastAssistantMessage = await getLastAssistantMessage(conversationId)
      
      if (lastAssistantMessage) {
        const tempData = extractTempData(lastAssistantMessage.content)
        
        if (tempData) {
          console.log('📋 Found temporary data:', {
            handlerId,
            type: tempData.type,
            timestamp: tempData.timestamp,
          })
          
          if (isConfirmation) {
            // Confirmar: criar meal/exercise diretamente como confirmado
            if (tempData.type === 'meal') {
              const mealData = tempData as TemporaryMealData
              const dailySummary = await getOrCreateDailySummary(mealData.userId)
              
              if (!dailySummary) {
                console.error('❌ Could not get daily summary for meal confirmation')
              } else {
                const confirmedMeal = await createConfirmedMeal({
                  userId: mealData.userId,
                  dailySummaryId: dailySummary.id,
                  description: mealData.data.description,
                  calories: mealData.data.calories,
                  protein: mealData.data.protein_g,
                  carbs: mealData.data.carbs_g,
                  fat: mealData.data.fat_g,
                  fiber: mealData.data.fiber_g,
                  originalEstimate: mealData.data.originalEstimate,
                })
                
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
                  
                  console.log('✅ Meal confirmed from temp data:', {
                    handlerId,
                    mealId: confirmedMeal.id,
                    totalTime: Date.now() - startTime,
                  })
                  return
                }
              }
            } else if (tempData.type === 'exercise') {
              const exerciseData = tempData as TemporaryExerciseData
              const dailySummary = await getOrCreateDailySummary(exerciseData.userId)
              
              if (!dailySummary) {
                console.error('❌ Could not get daily summary for exercise confirmation')
              } else {
                const confirmedExercise = await createConfirmedExercise({
                  userId: exerciseData.userId,
                  dailySummaryId: dailySummary.id,
                  description: exerciseData.data.description,
                  exerciseType: exerciseData.data.exerciseType,
                  durationMinutes: exerciseData.data.durationMinutes,
                  intensity: exerciseData.data.intensity,
                  metValue: exerciseData.data.metValue,
                  caloriesBurned: exerciseData.data.caloriesBurned,
                })
                
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
                  
                  console.log('✅ Exercise confirmed from temp data:', {
                    handlerId,
                    exerciseId: confirmedExercise.id,
                    totalTime: Date.now() - startTime,
                  })
                  return
                }
              }
            }
          } else if (isCorrection) {
            // Correção: apenas responder (dados temporários serão descartados automaticamente)
            const reply = tempData.type === 'meal' 
              ? '🗑️ Refeição cancelada. Pode descrever novamente a refeição correta.'
              : '🗑️ Exercício cancelado. Pode descrever novamente o exercício correto.'
            
            await recordUserMessage({
              conversationId,
              content: text,
              intent: tempData.type === 'meal' ? 'register_meal' : 'register_exercise',
              user: user || undefined,
            })
            
            await recordAssistantMessage({
              conversationId,
              content: reply,
              intent: tempData.type === 'meal' ? 'register_meal' : 'register_exercise',
              user: user || undefined,
            })
            
            await simulateHumanDelay()
            await sendWhatsAppMessage(senderPhone, reply)
            
            console.log('✅ Correction handled (temp data discarded):', {
              handlerId,
              type: tempData.type,
              totalTime: Date.now() - startTime,
            })
            return
          }
        }
      }
    }

    // Otimização: Paralelizar Step 3 e Step 4
    const step3And4Start = Date.now()
    const [conversationContext, messagesSinceLastResponse] = await Promise.all([
      getConversationContext(conversationId),
      getMessagesSinceLastAssistantResponse(conversationId),
    ])
    console.log('✅ Step 3 & 4 - Context & Messages (parallelized):', {
      handlerId,
      historyLength: conversationContext.history.length,
      lastIntent: conversationContext.lastIntent,
      messageCount: messagesSinceLastResponse.length,
      time: Date.now() - step3And4Start,
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

    // Gerar resposta (otimização: não esperar salvar mensagem do usuário)
    const step7Start = Date.now()
    console.log('💭 Step 7 - Generating reply...', { handlerId })
    const replyPromise = handleIntent({
      intentResult,
      messageText: text, // Usar texto original para processamento
      user: user || undefined,
      conversationId,
      history: conversationContext.history,
    })

    // Salvar mensagem do usuário em paralelo com geração de resposta
    const step6Promise = recordUserMessage({
      conversationId,
      content: userMessageForHistory,
      intent: intentResult.intent,
      user: user || undefined,
    })

    // Aguardar ambos
    const [reply] = await Promise.all([replyPromise, step6Promise])
    console.log('✅ Step 6 & 7 - User message saved & Reply generated (parallelized):', {
      handlerId,
      replyLength: reply.length,
      replyPreview: reply.substring(0, 100),
      time: Date.now() - step7Start,
    })

    // Otimização: Delay reduzido + salvar mensagem do assistente em background
    const step9Start = Date.now()
    console.log('⏳ Step 9 - Simulating human delay (reduced)...', { handlerId })
    await simulateHumanDelay() // Delay reduzido (750-1500ms em vez de 1500-3000ms)
    console.log('✅ Step 9 - Delay completed:', {
      handlerId,
      delayTime: Date.now() - step9Start,
    })

    // Enviar resposta (apenas parte visível, sem dados temporários)
    const step10Start = Date.now()
    console.log('📤 Step 10 - Sending WhatsApp message...', { handlerId })
    const visibleMessage = removeTempData(reply) // Remover tempData antes de enviar
    await sendWhatsAppMessage(senderPhone, visibleMessage)
    console.log('✅ Step 10 - Message sent:', {
      handlerId,
      time: Date.now() - step10Start,
    })

    // Salvar resposta do assistente em background (não bloqueia resposta)
    recordAssistantMessage({
      conversationId,
      content: reply, // Salvar completo (com tempData se houver)
      intent: intentResult.intent,
      user: user || undefined,
    }).then(() => {
      console.log('✅ Step 8 - Assistant message saved (background):', {
        handlerId,
        hasTempData: reply.includes('__TEMP_DATA_JSON__'),
      })
    }).catch((error) => {
      // Não falhar se não conseguir salvar
      console.error('⚠️ Failed to save assistant message (non-blocking):', {
        handlerId,
        error: error.message,
      })
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

