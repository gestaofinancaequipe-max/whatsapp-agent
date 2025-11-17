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

    // Obter última mensagem do assistente para contexto
    const lastAssistantMessage = recentHistory
      ? recentHistory
          .filter((msg) => msg.role === 'assistant')
          .slice(-1)[0] // Última mensagem do assistente
      : null

    console.log('🤖 Classifying intent with LLM:', {
      messageCount: messages.length,
      totalLength: userMessagesText.length,
      hasHistory: !!recentHistory && recentHistory.length > 0,
      userHistoryCount: recentHistory
        ? recentHistory.filter((msg) => msg.role === 'user').length
        : 0,
      hasLastAssistantMessage: !!lastAssistantMessage,
    })

    const systemPrompt = `Você é um classificador de intenções para um bot nutricional no WhatsApp.

CONTEXTO GEOGRÁFICO:
- Estamos no Brasil, onde vírgula (,) é usada como separador decimal
- Exemplos: "1,75m" = 1.75 metros, "82,5kg" = 82.5 kg
- Aceite ambos os formatos (vírgula e ponto), mas prefira vírgula quando ambíguo
- Números como "1,7" ou "1.7" podem ser altura em metros (converter para cm)

Classifique a intenção e extraia dados estruturados.

Intents disponíveis:
- register_meal: registrar refeição
- register_exercise: registrar exercício
- query_balance: consultar calorias restantes
- query_food_info: informação nutricional
- view_user_data: ver dados cadastrados do usuário
- update_user_data: atualizar dados pessoais (peso, altura, idade) e metas nutricionais (calorias diárias, proteína diária) - também usado para onboarding/cadastro inicial
- help, greeting, daily_summary, summary_week, unknown

IMPORTANTE - update_user_data:
- Use para atualizar DADOS PESSOAIS (nome, gênero, peso em kg, altura em cm, idade em anos)
- Use para atualizar METAS NUTRICIONAIS (calorias diárias, proteína diária)
- Também usado para onboarding/cadastro inicial quando o usuário está preenchendo seus dados pela primeira vez
- Exemplos: "Peso 82kg", "Altura 175cm", "mudar peso para 70 quilos", "idade 30 anos", "Meta 1800 kcal", "Proteína 150g"

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

Para update_user_data:
- EXTRAIA dados estruturados: nome (opcional), gênero (masculino/feminino), peso (kg), altura (cm), idade (anos), meta calórica (kcal), meta de proteína (g)
- CONVERTA altura para cm se estiver em metros (ex: 1.7m → 170cm, 1,75m → 175cm)
- Números entre 1.0-2.5 são altura em metros (converter para cm multiplicando por 100)
- INFIRA valores de números soltos quando em contexto:
  * "tenho 32, 170" → idade: 32, altura: 170cm
  * "32, 1.7" → idade: 32, altura: 170cm (1.7m convertido)
  * "1,75" → altura: 175cm (se entre 1.0-2.5, é metros)
- Números entre 15-100 são idade
- Números entre 100-250 são altura em cm
- Gênero: detecte "masculino", "feminino", "m", "f", "homem", "mulher"
- Nome: extraia quando mencionado explicitamente (ex: "meu nome é João", "sou a Maria")
- IMPORTANTE: Quando o usuário está atualizando apenas 1 campo, inclua APENAS esse campo no JSON
- NÃO inclua campos null ou undefined - omita completamente campos que não foram mencionados
- Exemplos de extração:
  * "tenho 32, 170" → {"age": 32, "height_cm": 170}
  * "1,7m" ou "1.7m" → {"height_cm": 170}
  * "Peso 82kg" → {"weight_kg": 82} (APENAS peso, não inclua outros campos)
  * "Meta 1800 kcal" → {"goal_calories": 1800} (APENAS meta calórica)
  * "Proteína 150g" → {"goal_protein_g": 150} (APENAS proteína)
  * "sou masculino" → {"gender": "masculino"} (APENAS gênero)
  * "meu nome é João" → {"user_name": "João"} (APENAS nome)

Retorne JSON:
- Para register_meal: {"intent": "register_meal", "confidence": 0.95, "items": [{"alimento":"...","quantidade":"..."}]}
- Para update_user_data: {"intent": "update_user_data", "confidence": 0.95, "user_data": {"weight_kg": 82}} (exemplo com apenas 1 campo)
- Para update_user_data com múltiplos campos: {"intent": "update_user_data", "confidence": 0.95, "user_data": {"age": 32, "height_cm": 170}} (exemplo com 2 campos)
- Inclua apenas os campos que foram mencionados ou inferidos pelo usuário
- Se não conseguir extrair um campo, não inclua no JSON (não use null)`

    const userPrompt = `Mensagens do usuário:
${userMessagesText}

${lastAssistantMessage 
  ? `Última mensagem do assistente (contexto importante):\n${lastAssistantMessage.content}\n\n`
  : ''}Contexto (mensagens anteriores do usuário):
${userMessages}

Classifique e extraia dados.`

    const timeout = parseInt(process.env.LLM_INTENT_TIMEOUT_MS || '2000', 10) // Reduzido de 3000ms para 2000ms

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
      user_data?: {
        user_name?: string | null
        gender?: string | null
        weight_kg?: number
        height_cm?: number
        age?: number
        goal_calories?: number
        goal_protein_g?: number
      }
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
      user_data: parsed.user_data,
    }

    console.log('✅ LLM intent classified:', {
      intent: result.intent,
      confidence: result.confidence,
      itemsCount: result.items?.length || 0,
      items: result.items,
      user_data: result.user_data,
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

