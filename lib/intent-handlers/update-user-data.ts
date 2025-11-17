import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData, UserRecord } from '@/lib/services/users'

// Regex melhorado para capturar mais variações:
// - "Peso 82kg" ou "82kg"
// - "mudar peso para 70 quilos" ou "peso para 70 quilos"
// - "70 quilos" ou "70kg"
const weightRegex = /(?:peso|quilo)\s*(?:para|é|esta|está|de)?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s?(?:kg|quilo?s?)|(\d{2,3}(?:[.,]\d{1,2})?)\s?(?:kg|quilo?s?)/i
const heightRegex = /(?:altura|cent[ií]metro)\s*(?:para|é|esta|está|de)?\s*(\d{2,3})\s?(?:cm|cent[ií]metros?)|(\d{2,3})\s?(?:cm|cent[ií]metros?)/i
const ageRegex = /(?:idade|ano)\s*(?:para|é|esta|está|de)?\s*(\d{2})\s?(?:anos?|idade)|(\d{2})\s?(?:anos?)/i
const goalCaloriesRegex = /(?:meta|objetivo|calorias?)\s*(?:de|é|para|esta|está)?\s*(\d{3,4})\s?(?:kcal|calorias?)|(\d{3,4})\s?(?:kcal|calorias?)(?:\s+(?:de\s+)?(?:meta|objetivo))?/i
const goalProteinRegex = /(?:prote[ií]na|prot)\s*(?:de|é|para|esta|está)?\s*(\d{2,3})\s?(?:g|gramas?)|(\d{2,3})\s?(?:g|gramas?)\s+(?:de\s+)?(?:prote[ií]na|prot)/i

/**
 * Identifica quais campos estão faltando no perfil do usuário
 */
function getMissingFields(user: UserRecord | null | undefined): string[] {
  if (!user) return []
  
  const missing: string[] = []
  if (!user.weight_kg) missing.push('peso (kg)')
  if (!user.height_cm) missing.push('altura (cm)')
  if (!user.age) missing.push('idade')
  if (!user.goal_calories) missing.push('meta calórica (kcal)')
  return missing
}

/**
 * Handler unificado para atualizar dados do usuário e onboarding
 * Detecta automaticamente qual variável será alterada e atualiza no Supabase
 */
export async function handleUpdateUserDataIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Preciso do seu cadastro para atualizar dados. Digite "ajuda" para começar.'
  }

  const payload: Record<string, any> = {}
  const message = context.messageText

  // Detectar peso
  const weightMatch = message.match(weightRegex)
  if (weightMatch) {
    const weightValue = weightMatch[1] || weightMatch[2]
    if (weightValue) {
      payload.weight_kg = parseFloat(weightValue.replace(',', '.'))
    }
  }

  // Detectar altura
  const heightMatch = message.match(heightRegex)
  if (heightMatch) {
    const heightValue = heightMatch[1] || heightMatch[2]
    if (heightValue) {
      payload.height_cm = parseInt(heightValue, 10)
    }
  }

  // Detectar idade
  const ageMatch = message.match(ageRegex)
  if (ageMatch) {
    const ageValue = ageMatch[1] || ageMatch[2]
    if (ageValue) {
      payload.age = parseInt(ageValue, 10)
    }
  }

  // Detectar meta calórica
  const goalMatch = message.match(goalCaloriesRegex)
  if (goalMatch) {
    const goalValue = goalMatch[1] || goalMatch[2]
    if (goalValue) {
      payload.goal_calories = parseInt(goalValue, 10)
    }
  }

  // Detectar meta de proteína
  const proteinMatch = message.match(goalProteinRegex)
  if (proteinMatch) {
    const proteinValue = proteinMatch[1] || proteinMatch[2]
    if (proteinValue) {
      payload.goal_protein_g = parseInt(proteinValue, 10)
    }
  }

  // Se não detectou nada, retornar mensagem de ajuda
  if (Object.keys(payload).length === 0) {
    const missing = getMissingFields(context.user)
    
    // Se está em onboarding, mostrar campos faltantes
    if (missing.length > 0 && !context.user.onboarding_completed) {
      return (
        '📝 Vamos terminar seu cadastro.\n' +
        'Me envie (um por mensagem):\n' +
        missing.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
      )
    }
    
    return '📝 Não entendi os novos dados. Envie mensagens como "Peso 82kg", "Altura 175cm", "Idade 30 anos", "Meta 2000 kcal" ou "Proteína 150g".'
  }

  // Atualizar dados no Supabase
  await upsertUserData(context.user.id, payload)

  // Verificar se completou o onboarding
  const updatedUser = {
    ...context.user,
    ...payload,
  }
  const refreshedMissing = getMissingFields(updatedUser)

  // Se completou todos os campos, marcar onboarding como completo
  if (refreshedMissing.length === 0 && !context.user.onboarding_completed) {
    await upsertUserData(context.user.id, { onboarding_completed: true })
    
    return (
      '✅ Perfil configurado!\n' +
      (payload.weight_kg || context.user.weight_kg
        ? `Peso: ${payload.weight_kg || context.user.weight_kg} kg\n`
        : '') +
      (payload.height_cm || context.user.height_cm
        ? `Altura: ${payload.height_cm || context.user.height_cm} cm\n`
        : '') +
      (payload.age || context.user.age
        ? `Idade: ${payload.age || context.user.age} anos\n`
        : '') +
      (payload.goal_calories || context.user.goal_calories
        ? `Meta calórica: ${payload.goal_calories || context.user.goal_calories} kcal\n`
        : '') +
      (payload.goal_protein_g || context.user.goal_protein_g
        ? `Meta de proteína: ${payload.goal_protein_g || context.user.goal_protein_g} g\n`
        : '') +
      '\nAgora é só registrar suas refeições e exercícios. Digite "ajuda" quando quiser rever os comandos.'
    )
  }

  // Se ainda faltam campos (onboarding incompleto)
  if (refreshedMissing.length > 0) {
    return (
      '✅ Dados atualizados!\n' +
      (payload.weight_kg ? `Peso: ${payload.weight_kg} kg\n` : '') +
      (payload.height_cm ? `Altura: ${payload.height_cm} cm\n` : '') +
      (payload.age ? `Idade: ${payload.age} anos\n` : '') +
      (payload.goal_calories ? `Meta calórica: ${payload.goal_calories} kcal\n` : '') +
      (payload.goal_protein_g ? `Meta de proteína: ${payload.goal_protein_g} g\n` : '') +
      '\n📝 Ainda faltam:\n' +
      refreshedMissing.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
    )
  }

  // Atualização normal (onboarding já completo)
  return (
    '✅ Dados atualizados!\n' +
    (payload.weight_kg ? `Peso: ${payload.weight_kg} kg\n` : '') +
    (payload.height_cm ? `Altura: ${payload.height_cm} cm\n` : '') +
    (payload.age ? `Idade: ${payload.age} anos\n` : '') +
    (payload.goal_calories ? `Meta calórica: ${payload.goal_calories} kcal\n` : '') +
    (payload.goal_protein_g ? `Meta de proteína: ${payload.goal_protein_g} g\n` : '') +
    '\nContinue registrando suas refeições e exercícios! 💪'
  )
}

