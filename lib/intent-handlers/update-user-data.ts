import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData } from '@/lib/services/users'

const weightRegex = /(\d{2,3}(?:[.,]\d{1,2})?)\s?(kg|quilo?s?)/i
const heightRegex = /(\d{2,3})\s?(cm|cent[ií]metros?)/i
const ageRegex = /(\d{2})\s?(anos?|idade)/i

export async function handleUpdateUserDataIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Preciso do seu cadastro para atualizar dados. Digite "ajuda" para começar.'
  }

  const payload: Record<string, number> = {}
  const message = context.messageText

  const weightMatch = message.match(weightRegex)
  if (weightMatch) {
    payload.weight_kg = parseFloat(weightMatch[1].replace(',', '.'))
  }

  const heightMatch = message.match(heightRegex)
  if (heightMatch) {
    payload.height_cm = parseInt(heightMatch[1], 10)
  }

  const ageMatch = message.match(ageRegex)
  if (ageMatch) {
    payload.age = parseInt(ageMatch[1], 10)
  }

  if (Object.keys(payload).length === 0) {
    return '📝 Não entendi os novos dados. Envie mensagens como "Peso 82kg" ou "Altura 175cm".'
  }

  await upsertUserData(context.user.id, payload)

  return (
    '✅ Dados atualizados!\n' +
    (payload.weight_kg ? `Peso: ${payload.weight_kg} kg\n` : '') +
    (payload.height_cm ? `Altura: ${payload.height_cm} cm\n` : '') +
    (payload.age ? `Idade: ${payload.age} anos\n` : '') +
    '\nContinue registrando suas refeições e exercícios! 💪'
  )
}

