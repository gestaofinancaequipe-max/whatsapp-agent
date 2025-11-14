import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData } from '@/lib/services/users'

const calorieRegex = /(\d{3,4})\s?(kcal|calorias?)/i
const proteinRegex = /(\d{2,3})\s?(g|gramas?)\s?(de )?(prote[ií]na|prot)/i

export async function handleUpdateGoalIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Não encontrei seu perfil ainda. Digite "ajuda" para começar.'
  }

  const message = context.messageText
  const payload: Record<string, number> = {}

  const calorieMatch = message.match(calorieRegex)
  if (calorieMatch) {
    payload.goal_calories = parseInt(calorieMatch[1], 10)
  }

  const proteinMatch = message.match(proteinRegex)
  if (proteinMatch) {
    payload.goal_protein_g = parseInt(proteinMatch[1], 10)
  }

  if (Object.keys(payload).length === 0) {
    return '🎯 Para atualizar sua meta, envie algo como "Meta 1800 kcal" ou "Proteína 150g".'
  }

  await upsertUserData(context.user.id, payload)

  return (
    '✅ Meta atualizada!\n' +
    (payload.goal_calories
      ? `Calorias diárias: ${payload.goal_calories} kcal\n`
      : '') +
    (payload.goal_protein_g
      ? `Proteína diária: ${payload.goal_protein_g} g\n`
      : '') +
    '\nVamos alcançar esse objetivo juntos! 🚀'
  )
}

