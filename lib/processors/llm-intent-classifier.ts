import Groq from 'groq-sdk'
import { IntentResult, IntentType } from '@/lib/types/intents'

interface ConversationMessage {
  role: string
  content: string
  created_at?: string
}

interface LLMIntentResponse {
  intent: IntentType
  confidence: number
  items?: Array<{
    alimento?: string
    quantidade?: string | null
    exercicio?: string
    duracao?: string | null
  }>
  reasoning?: string
}

// Inicializar cliente Groq
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error('❌ GROQ_API_KEY não está configurada')
    return null
  }

  return new Groq({
    apiKey: apiKey,
  })
}

/**
 * Classifica intenção usando LLM (Groq)
 * Analisa todas as mensagens do usuário desde a última resposta do assistente
 * @param messages Array de mensagens do usuário desde a última resposta
 * @param recentHistory Histórico recente da conversa (últimas 5 mensagens) para contexto
 * @returns IntentResult com intent, confidence e extracted_data
 */
export async function classifyIntentWithLLM(
  messages: ConversationMessage[],
  recentHistory?: ConversationMessage[]
): Promise<IntentResult | null> {
  try {
    const groq = getGroqClient()
    if (!groq) {
      throw new Error('Groq client not initialized')
    }

    if (!messages || messages.length === 0) {
      console.log('⚠️ No messages provided for LLM classification')
      return null
    }

    // Concatenar todas as mensagens do usuário
    const userMessagesText = messages
      .map((msg) => msg.content)
      .join('\n')
      .trim()

    // Filtrar apenas mensagens do usuário do histórico recente
    const userMessages = recentHistory
      ? recentHistory
          .filter((msg) => msg.role === 'user')
          .slice(-3) // Últimas 3 mensagens do usuário
          .map((msg) => msg.content)
          .join('\n')
      : 'Nenhum histórico disponível'

    console.log('🤖 Classifying intent with LLM:', {
      messageCount: messages.length,
      totalLength: userMessagesText.length,
      hasHistory: !!recentHistory && recentHistory.length > 0,
      userHistoryCount: recentHistory
        ? recentHistory.filter((msg) => msg.role === 'user').length
        : 0,
    })

    const systemPrompt = `Você é um classificador de intenções para um bot nutricional no WhatsApp.

Classifique a intenção e extraia dados estruturados.

Intents disponíveis:
- register_meal: registrar refeição
- register_exercise: registrar exercício
- query_balance: consultar calorias restantes
- query_food_info: informação nutricional
- view_user_data: ver dados cadastrados do usuário
- help, greeting, daily_summary, summary_week, update_user_data, update_goal, onboarding, unknown

Para register_meal:
- Extraia lista de [alimento, quantidade] EXATAMENTE como o usuário escreveu
- Se quantidade não especificada: null
- Exemplos:
  * "100g de arroz" → [{"alimento":"arroz","quantidade":"100g"}]
  * "arroz e feijão" → [{"alimento":"arroz","quantidade":null},{"alimento":"feijão","quantidade":null}]
  * "2 colheres de arroz, 150g de frango" → [{"alimento":"arroz","quantidade":"2 colheres"},{"alimento":"frango","quantidade":"150g"}]

Para register_exercise:
- Extraia [exercicio, duracao] EXATAMENTE como o usuário escreveu
- Se duração não especificada: null
- Exemplos:
  * "corri 30 minutos" → [{"exercicio":"corrida","duracao":"30 minutos"}]
  * "malhei" → [{"exercicio":"musculacao","duracao":null}]
  * "30 min de esteira e 20 min de bicicleta" → [{"exercicio":"esteira","duracao":"30 min"},{"exercicio":"bicicleta","duracao":"20 min"}]

Retorne JSON:
{
  "intent": "register_meal",
  "confidence": 0.95,
  "items": [{"alimento":"...","quantidade":"..."}]
}`

    const userPrompt = `Mensagens do usuário:
${userMessagesText}

Contexto (mensagens anteriores do usuário):
${userMessages}

Classifique e extraia dados.`

    const timeout = parseInt(process.env.LLM_INTENT_TIMEOUT_MS || '3000', 10)

    // Criar promise com timeout
    const classificationPromise = groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.3, // Baixa temperatura para respostas mais consistentes
      response_format: { type: 'json_object' },
    })

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeout)
    })

    const response = await Promise.race([classificationPromise, timeoutPromise])

    if (!response) {
      console.log('⏱️ LLM classification timeout:', { timeout })
      return null
    }

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.log('⚠️ Empty response from LLM')
      return null
    }

    // Parsear resposta JSON
    let cleanedContent = content.trim()
    
    // Remover markdown code blocks se houver
    if (cleanedContent.includes('```')) {
      const jsonMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        cleanedContent = jsonMatch[1].trim()
      }
    }

    const parsed = JSON.parse(cleanedContent) as {
      intent: string
      confidence: number
      items?: Array<{
        alimento?: string
        quantidade?: string | null
        exercicio?: string
        duracao?: string | null
      }>
      reasoning?: string
    }

    // Validar intent
    const validIntents: IntentType[] = [
      'greeting',
      'help',
      'register_meal',
      'register_exercise',
      'query_balance',
      'query_food_info',
      'daily_summary',
      'summary_week',
      'update_user_data',
      'view_user_data',
      'update_goal',
      'onboarding',
      'unknown',
    ]

    if (!validIntents.includes(parsed.intent as IntentType)) {
      console.error('❌ Invalid intent from LLM:', parsed.intent)
      return null
    }

    const result: IntentResult = {
      intent: parsed.intent as IntentType,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
      matchedPattern: 'llm_classification',
      items: parsed.items || [],
    }

    console.log('✅ LLM intent classified:', {
      intent: result.intent,
      confidence: result.confidence,
      itemsCount: result.items?.length || 0,
      items: result.items,
      reasoning: parsed.reasoning,
    })

    return result
  } catch (error: any) {
    console.error('❌ Error in LLM intent classification:', {
      error: error.message,
      stack: error.stack,
    })
    return null
  }
}

