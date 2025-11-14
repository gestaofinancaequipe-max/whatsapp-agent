import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData } from '@/lib/services/users'

const weightRegex = /(\d{2,3}(?:[.,]\d{1,2})?)\s?(kg|quilo?s?)/i
const heightRegex = /(\d{2,3})\s?(cm|cent[ií]metros?)/i
const ageRegex = /(\d{2})\s?(anos?|idade)/i
const genderRegex = /\b(homem|mulher|masculino|feminino)\b/i
const goalRegex = /(\d{3,4})\s?(kcal|calorias?)/i

function getMissingFields(user: any) {
  const missing: string[] = []
  if (!user?.weight_kg) missing.push('peso (kg)')
  if (!user?.height_cm) missing.push('altura (cm)')
  if (!user?.age) missing.push('idade')
  if (!user?.goal_calories) missing.push('meta calórica')
  return missing
}

export async function handleOnboardingIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Não encontrei seu telefone. Digite "ajuda" para criar seu perfil.'
  }

  const missing = getMissingFields(context.user)
  if (missing.length === 0 && context.user.onboarding_completed) {
    return '✅ Seu perfil já está configurado! Use "ajuda" para ver comandos.'
  }

  const updates: Record<string, any> = {}
  const message = context.messageText

  const weightMatch = message.match(weightRegex)
  if (weightMatch) {
    updates.weight_kg = parseFloat(weightMatch[1].replace(',', '.'))
  }

  const heightMatch = message.match(heightRegex)
  if (heightMatch) {
    updates.height_cm = parseInt(heightMatch[1], 10)
  }

  const ageMatch = message.match(ageRegex)
  if (ageMatch) {
    updates.age = parseInt(ageMatch[1], 10)
  }

  const genderMatch = message.match(genderRegex)
  if (genderMatch) {
    updates.gender = genderMatch[1].toLowerCase().startsWith('m')
      ? 'male'
      : 'female'
  }

  const goalMatch = message.match(goalRegex)
  if (goalMatch) {
    updates.goal_calories = parseInt(goalMatch[1], 10)
  }

  if (Object.keys(updates).length > 0) {
    await upsertUserData(context.user.id, updates)
  }

  const refreshedMissing = getMissingFields({
    ...context.user,
    ...updates,
  })

  if (refreshedMissing.length === 0) {
    await upsertUserData(context.user.id, { onboarding_completed: true })
    return (
      '✅ Perfil configurado!\n' +
      `Peso: ${updates.weight_kg || context.user.weight_kg} kg\n` +
      `Altura: ${updates.height_cm || context.user.height_cm} cm\n` +
      `Idade: ${updates.age || context.user.age} anos\n` +
      `Meta calórica: ${
        updates.goal_calories || context.user.goal_calories || 2000
      } kcal\n\n` +
      'Agora é só registrar suas refeições e exercícios. Digite "ajuda" quando quiser rever os comandos.'
    )
  }

  return (
    '📝 Vamos terminar seu cadastro.\n' +
    'Me envie (um por mensagem):\n' +
    refreshedMissing.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
  )
}

