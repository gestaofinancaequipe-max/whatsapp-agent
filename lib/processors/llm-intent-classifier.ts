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
  extracted_data?: {
    food?: string
    quantity?: string
    unit?: string
    exercise?: string
    duration?: string
    [key: string]: any
  }
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

    // Formatar histórico recente para contexto
    const historyText = recentHistory
      ? recentHistory
          .slice(-5) // Últimas 5 mensagens
          .map((msg) => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
          .join('\n')
      : 'Nenhum histórico disponível'

    console.log('🤖 Classifying intent with LLM:', {
      messageCount: messages.length,
      totalLength: userMessagesText.length,
      hasHistory: !!recentHistory && recentHistory.length > 0,
    })

    const systemPrompt = `Você é um classificador de intenções para um bot nutricional no WhatsApp.

Analise TODAS as mensagens do usuário abaixo (desde a última resposta do bot) e identifique a intenção principal.

Intenções possíveis:
- greeting: cumprimentos (olá, oi, bom dia, etc.)
- help: pedido de ajuda ou comandos
- register_meal: registrar refeição/comida (comi, almocei, jantei, etc.)
- register_exercise: registrar exercício (corri, malhei, treino, etc.)
- query_balance: consultar saldo de calorias restantes
- query_food_info: consultar informações nutricionais de um alimento
- daily_summary: resumo do dia
- summary_week: resumo da semana
- update_user_data: atualizar dados pessoais (peso, altura, idade)
- update_goal: atualizar meta de calorias/proteínas
- onboarding: primeiro uso/cadastro
- unknown: não identificado (use apenas se realmente não conseguir identificar)

IMPORTANTE:
- Se o usuário enviou múltiplas mensagens, analise TODAS juntas
- Se mencionar alimento OU quantidade, provavelmente é register_meal ou query_food_info
- Se mencionar exercício OU duração, provavelmente é register_exercise
- Se for pergunta sobre calorias/proteínas de um alimento, é query_food_info
- Se for pergunta sobre quanto ainda pode comer, é query_balance

Responda APENAS com JSON válido, sem markdown, sem explicações adicionais:
{
  "intent": "nome_da_intencao",
  "confidence": 0.0-1.0,
  "extracted_data": {
    "food": "nome do alimento se houver",
    "quantity": "quantidade numérica se houver",
    "unit": "unidade (g, kg, unidade, etc.) se houver",
    "exercise": "nome do exercício se houver",
    "duration": "duração em minutos se houver"
  },
  "reasoning": "breve explicação em uma frase"
}`

    const userPrompt = `Mensagens do usuário (desde última resposta):
${userMessagesText}

Histórico recente (últimas 5 mensagens):
${historyText}

Classifique a intenção e extraia dados relevantes.`

    const timeout = parseInt(process.env.LLM_INTENT_TIMEOUT_MS || '3000', 10)

    // Criar promise com timeout
    const classificationPromise = groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
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
    let llmResult: LLMIntentResponse
    try {
      llmResult = JSON.parse(content)
    } catch (parseError) {
      // Tentar extrair JSON do texto (caso venha com markdown ou texto adicional)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        llmResult = JSON.parse(jsonMatch[0])
      } else {
        console.error('❌ Failed to parse LLM response as JSON:', {
          content: content.substring(0, 200),
        })
        return null
      }
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
      'update_goal',
      'onboarding',
      'unknown',
    ]

    if (!validIntents.includes(llmResult.intent)) {
      console.error('❌ Invalid intent from LLM:', llmResult.intent)
      return null
    }

    const result: IntentResult = {
      intent: llmResult.intent,
      confidence: Math.max(0, Math.min(1, llmResult.confidence || 0.8)),
      matchedPattern: 'llm_classification',
    }

    console.log('✅ LLM intent classified:', {
      intent: result.intent,
      confidence: result.confidence,
      reasoning: llmResult.reasoning,
      extractedData: llmResult.extracted_data,
    })

    // Armazenar extracted_data em uma propriedade customizada (se necessário no futuro)
    // Por enquanto, apenas logamos

    return result
  } catch (error: any) {
    console.error('❌ Error in LLM intent classification:', {
      error: error.message,
      stack: error.stack,
    })
    return null
  }
}

