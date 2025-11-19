import { getOrCreateConversation, getMessagesSinceLastAssistantResponse, getLastAssistantMessage } from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { classifyIntent } from '@/lib/processors/intent-classifier'
import { getOrCreateUserByPhone, upsertUserData } from '@/lib/services/users'
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
import { getConversationState, clearConversationState } from '@/lib/services/conversation-state'

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
    
    // Palavras-chave de confirmação (verificar se está contida na mensagem)
    const confirmationKeywords = [
      '1', 
      'sim', 
      'quero', 
      'certo', 
      'confirmo', 
      'confirma', 
      'pode confirmar',
      'confirmar',
      'ok', 
      'beleza', 
      'pode ser',
      'adicionar',
      'adiciona',
      'registrar',
      'registra',
      'salvar',
      'salva',
      'vai',
      'tá certo',
      'ta certo',
      'está certo',
      'esta certo',
      'correto',
      'perfeito',
      'yes',
      'y',
      '👍',
      '✅',
    ]
    const correctionKeywords = ['2', 'corrigir', 'corrige', 'errado', 'não', 'nao', 'cancelar', 'cancela']
    
    // Verificar se a mensagem contém alguma palavra-chave de confirmação
    // (match exato para palavras curtas, ou se está contida para frases)
    const isConfirmation = confirmationKeywords.some(keyword => {
      if (keyword.length <= 3) {
        // Para palavras curtas, verificar match exato ou início da mensagem seguido de espaço
        return normalizedText === keyword || normalizedText.startsWith(keyword + ' ')
      } else {
        // Para frases, verificar se está contida na mensagem
        return normalizedText.includes(keyword)
      }
    })
    
    const isCorrection = correctionKeywords.some(keyword => {
      if (keyword.length <= 3) {
        // Para palavras curtas, verificar match exato ou início da mensagem seguido de espaço
        return normalizedText === keyword || normalizedText.startsWith(keyword + ' ')
      } else {
        // Para frases, verificar se está contida na mensagem
        return normalizedText.includes(keyword)
      }
    })
    
    // Verificar se está aguardando nome (onboarding)
    const conversationState = await getConversationState(conversationId)
    if (conversationState?.onboardingStep === 'name' && user?.id && !isConfirmation && !isCorrection) {
      // Extrair nome da mensagem (remover palavras comuns e pegar primeira palavra válida)
      const cleanedText = text.trim()
      // Se a mensagem parece um nome (2-30 caracteres, sem números, sem comandos comuns)
      const namePattern = /^[A-Za-zÀ-ÿ\s]{2,30}$/
      const isLikelyName = namePattern.test(cleanedText) && 
                          !cleanedText.toLowerCase().includes('comi') &&
                          !cleanedText.toLowerCase().includes('corri') &&
                          !cleanedText.toLowerCase().includes('saldo')
      
      if (isLikelyName) {
        const userName = cleanedText.trim()
        // Salvar nome
        await upsertUserData(user.id, { user_name: userName })
        
        // Limpar estado e avançar para próxima etapa
        await clearConversationState(conversationId)
        
        const reply = `Prazer, ${userName}! 😊

Para calcular suas necessidades calóricas, preciso de alguns dados:

📏 Peso, altura e idade
💬 Pode enviar assim: "75kg, 180cm, 28 anos"

(Não se preocupe, seus dados são privados e seguros)`.trim()
        
        await recordUserMessage({
          conversationId,
          content: text,
          intent: 'update_user_data',
          user: user || undefined,
        })
        
        await recordAssistantMessage({
          conversationId,
          content: reply,
          intent: 'update_user_data',
          user: user || undefined,
        })
        
        await simulateHumanDelay()
        await sendWhatsAppMessage(senderPhone, reply)
        
        console.log('✅ Name captured and saved:', {
          handlerId,
          userName,
          totalTime: Date.now() - startTime,
        })
        return
      }
    }
    
    if ((isConfirmation || isCorrection) && user?.id) {
      // PRIORIDADE 1: Buscar estado da conversa (mais confiável)
      // (conversationState já foi buscado acima, mas pode ter sido atualizado)
      const currentState = conversationState || await getConversationState(conversationId)
      
      // Se é confirmação/correção, verificar estado OU tempData
      // Não continuar para classificação de intent se for confirmação
      if (currentState?.awaitingInput?.type === 'confirmation') {
        const context = currentState.awaitingInput.context
        
        if (isConfirmation) {
          // Confirmar usando dados do estado
          if (context.mealData) {
            const mealData = context.mealData
            const dailySummary = await getOrCreateDailySummary(user.id)
            
            if (dailySummary) {
              const confirmedMeal = await createConfirmedMeal({
                userId: user.id,
                dailySummaryId: dailySummary.id,
                description: mealData.description,
                calories: mealData.calories,
                protein: mealData.protein_g,
                carbs: mealData.carbs_g,
                fat: mealData.fat_g,
                fiber: mealData.fiber_g,
                originalEstimate: mealData.originalEstimate,
              })
              
              if (confirmedMeal) {
                // Limpar estado após confirmação
                await clearConversationState(conversationId)
                
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
                
                console.log('✅ Meal confirmed from conversation state:', {
                  handlerId,
                  mealId: confirmedMeal.id,
                  totalTime: Date.now() - startTime,
                })
                return
              }
            }
          } else if (context.exerciseData) {
            const exerciseData = context.exerciseData
            const dailySummary = await getOrCreateDailySummary(user.id)
            
            if (dailySummary) {
              const confirmedExercise = await createConfirmedExercise({
                userId: user.id,
                dailySummaryId: dailySummary.id,
                description: exerciseData.description,
                exerciseType: exerciseData.exerciseType,
                durationMinutes: exerciseData.durationMinutes,
                intensity: exerciseData.intensity,
                metValue: exerciseData.metValue,
                caloriesBurned: exerciseData.caloriesBurned,
              })
              
              if (confirmedExercise) {
                // Limpar estado após confirmação
                await clearConversationState(conversationId)
                
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
                
                console.log('✅ Exercise confirmed from conversation state:', {
                  handlerId,
                  exerciseId: confirmedExercise.id,
                  totalTime: Date.now() - startTime,
                })
                return
              }
            }
          }
        } else if (isCorrection) {
          // Correção: limpar estado
          await clearConversationState(conversationId)
          
          const reply = context.mealData
            ? '🗑️ Refeição cancelada. Pode descrever novamente a refeição correta.'
            : '🗑️ Exercício cancelado. Pode descrever novamente o exercício correto.'
          
          await recordUserMessage({
            conversationId,
            content: text,
            intent: context.mealData ? 'register_meal' : 'register_exercise',
            user: user || undefined,
          })
          
          await recordAssistantMessage({
            conversationId,
            content: reply,
            intent: context.mealData ? 'register_meal' : 'register_exercise',
            user: user || undefined,
          })
          
          await simulateHumanDelay()
          await sendWhatsAppMessage(senderPhone, reply)
          
          console.log('✅ Correction handled (conversation state cleared):', {
            handlerId,
            type: context.mealData ? 'meal' : 'exercise',
            totalTime: Date.now() - startTime,
          })
          return
        }
      }
      
      // FALLBACK: Se não encontrou estado, usar tempData (sistema atual)
      const lastAssistantMessage = await getLastAssistantMessage(conversationId)
      
      console.log('🔍 Checking for tempData in last assistant message:', {
        handlerId,
        hasLastMessage: !!lastAssistantMessage,
        messagePreview: lastAssistantMessage?.content?.substring(0, 100),
        hasTempDataDelimiter: lastAssistantMessage?.content?.includes('__TEMP_DATA_JSON__'),
      })
      
      if (lastAssistantMessage) {
        const tempData = extractTempData(lastAssistantMessage.content)
        
        console.log('📋 TempData extraction result:', {
          handlerId,
          found: !!tempData,
          type: tempData?.type,
        })
        
        if (tempData) {
          console.log('📋 Found temporary data (fallback):', {
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
      
      // Se é confirmação mas não encontrou dados, retornar mensagem apropriada
      // (evitar que continue para classificação de intent)
      if (isConfirmation) {
        const reply = '🤔 Não encontrei uma refeição ou exercício pendente para confirmar. Pode descrever novamente?'
        
        await recordUserMessage({
          conversationId,
          content: text,
          intent: 'unknown',
          user: user || undefined,
        })
        
        await recordAssistantMessage({
          conversationId,
          content: reply,
          intent: 'unknown',
          user: user || undefined,
        })
        
        await simulateHumanDelay()
        await sendWhatsAppMessage(senderPhone, reply)
        
        console.log('⚠️ Confirmation detected but no pending data found:', {
          handlerId,
          totalTime: Date.now() - startTime,
        })
        return
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

