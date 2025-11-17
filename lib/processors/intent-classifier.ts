import { IntentResult, IntentType } from '@/lib/types/intents'
import { classifyIntentWithLLM } from './llm-intent-classifier'

interface IntentPattern {
  intent: IntentType
  patterns: RegExp[]
}

interface ConversationMessage {
  role: string
  content: string
  created_at?: string
  intent?: IntentType | null
}

interface ConversationContext {
  lastIntent?: IntentType
  history?: ConversationMessage[]
}

const patternList: IntentPattern[] = [
  {
    intent: 'greeting',
    patterns: [
      /\b(o+i+|olá|ola|salve|bom dia|boa tarde|boa noite)\b/i,
    ],
  },
  {
    intent: 'help',
    patterns: [/(\/?ajuda|help|comandos?|como usar|socorro)/i],
  },
  {
    intent: 'register_meal',
    patterns: [
      /\b(comi|comemos|almoc(ei|ar)|jantei|lanchei|ingesti|bebi|cafe da manha)\b/i,
      /\b(refei[cç][aã]o|prato|pizza|hamb[uú]rguer|salada|macarr[aã]o)\b/i,
    ],
  },
  {
    intent: 'register_exercise',
    patterns: [
      /\b(corri|corr[ií]|caminhei|pedalei|malhei|academia|treino|exerc[ií]cio|yoga|nadei)\b/i,
      /\b(minutos?|km|quil[oô]metros?|series?)\b/i,
    ],
  },
  {
    intent: 'query_balance',
    patterns: [
      /\b(saldo|quanto posso comer|restante|falta consumir|ainda posso)\b/i,
    ],
  },
  {
    intent: 'query_food_info',
    patterns: [
      /\b(calorias?|prote[ií]nas?|macro[s]?|gordura)\b.*\b(tem|da|de)\b/i,
      /\b(quantas?|quanto)\b.*\b(calorias?|prote[ií]na|macro)\b/i,
    ],
  },
  {
    intent: 'daily_summary',
    patterns: [
      /\b(resumo|fechamento|como foi o dia|status do dia|relat[oó]rio)\b/i,
    ],
  },
  {
    intent: 'update_goal',
    patterns: [
      /\b(meta|objetivo)\b/i,
      /\b(\d{3,4})\s?(kcal|calorias?)\b/i,
    ],
  },
  {
    intent: 'view_user_data',
    patterns: [
      /\b(meus dados|dados cadastrados|meu cadastro|ver cadastro|meu perfil|minhas informa[cç][oõ]es|dados pessoais)\b/i,
      /\b(ver|mostrar|exibir)\s+(meus|meu)\s+(dados|cadastro|perfil)\b/i,
    ],
  },
]

const DEFAULT_RESULT: IntentResult = {
  intent: 'unknown',
  confidence: 0,
}

function normalizeMessage(message: string): string {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

/**
 * Classifica intent usando regex (fallback rápido)
 * @param message Última mensagem do usuário
 * @returns IntentResult ou null se não encontrar
 */
function classifyIntentWithRegex(message: string): IntentResult | null {
  try {
    const normalized = normalizeMessage(message)

    for (const { intent, patterns } of patternList) {
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          const result: IntentResult = {
            intent,
            confidence: 0.95,
            matchedPattern: pattern.toString(),
          }
          console.log('🎯 Intent detected (regex):', result)
          return result
        }
      }
    }

    return null
  } catch (error: any) {
    console.error('❌ Regex classification failed:', {
      error: error.message,
    })
    return null
  }
}

/**
 * Sistema híbrido de classificação de intenção
 * 1. Tenta LLM primeiro (usando todas as mensagens desde última resposta)
 * 2. Se LLM falhar → tenta regex na última mensagem
 * 3. Se regex não encontrar → usa intent da última mensagem do contexto
 * 4. Se nada funcionar → unknown
 * 
 * @param messagesSinceLastResponse Todas as mensagens do usuário desde a última resposta
 * @param context Contexto da conversa (última intent, histórico)
 * @returns IntentResult
 */
export async function classifyIntent(
  messagesSinceLastResponse: ConversationMessage[],
  context?: ConversationContext
): Promise<IntentResult> {
  try {
    if (!messagesSinceLastResponse || messagesSinceLastResponse.length === 0) {
      console.log('⚠️ No messages provided for classification')
      return DEFAULT_RESULT
    }

    // Pegar última mensagem para regex fallback
    const lastMessage = messagesSinceLastResponse[messagesSinceLastResponse.length - 1]
    const lastMessageText = lastMessage.content

    // 1. Tentar LLM primeiro (usando todas as mensagens)
    console.log('🤖 Attempting LLM classification...')
    const llmResult = await classifyIntentWithLLM(
      messagesSinceLastResponse,
      context?.history
    )

    if (llmResult) {
      console.log('✅ LLM classification successful:', llmResult)
      return llmResult
    }

    // 2. Se LLM falhar, tentar regex na última mensagem
    console.log('🔄 LLM failed, trying regex fallback...')
    const regexResult = classifyIntentWithRegex(lastMessageText)

    if (regexResult) {
      console.log('✅ Regex classification successful:', regexResult)
      return regexResult
    }

    // 3. Se regex não encontrar, usar intent da última mensagem do contexto
    if (context?.lastIntent && context.lastIntent !== 'unknown') {
      console.log('♻️ Using last intent from context:', {
        lastIntent: context.lastIntent,
      })
      return {
        intent: context.lastIntent,
        confidence: 0.7, // Menor confiança pois é inferência
        matchedPattern: 'context_fallback',
      }
    }

    // 4. Se nada funcionar, retornar unknown
    console.log('⚠️ Unknown intent for messages:', {
      messageCount: messagesSinceLastResponse.length,
      lastMessage: lastMessageText.substring(0, 50),
    })
    return DEFAULT_RESULT
  } catch (error: any) {
    console.error('❌ Intent classification failed:', {
      error: error.message,
      stack: error.stack,
    })
    return DEFAULT_RESULT
  }
}

/**
 * Função de compatibilidade: classifica apenas uma mensagem (usa regex)
 * Mantida para compatibilidade com código existente
 * @deprecated Use classifyIntent() com array de mensagens
 */
export function classifyIntentLegacy(message: string): IntentResult {
  const result = classifyIntentWithRegex(message)
  return result || DEFAULT_RESULT
}

