import { IntentResult, IntentType } from '@/lib/types/intents'

interface IntentPattern {
  intent: IntentType
  patterns: RegExp[]
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
]

const DEFAULT_RESULT: IntentResult = {
  intent: 'unknown',
  confidence: 0,
}

function normalizeMessage(message: string): string {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function classifyIntent(message: string): IntentResult {
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
          console.log('🎯 Intent detected:', result)
          return result
        }
      }
    }

    console.log('⚠️ Unknown intent for message:', message)
    return DEFAULT_RESULT
  } catch (error: any) {
    console.error('❌ Intent classification failed:', {
      error: error.message,
      stack: error.stack,
    })
    return DEFAULT_RESULT
  }
}

