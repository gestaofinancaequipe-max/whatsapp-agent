import { IntentContext } from '@/lib/intent-handlers/types'
import { UserRecord } from '@/lib/services/users'
import { getIMCCategory, DIVIDER } from '@/lib/utils/message-formatters'

/**
 * Identifica quais campos estão faltando no perfil do usuário
 */
function getMissingFields(user: UserRecord | null | undefined): string[] {
  if (!user) return []
  
  const missing: string[] = []
  if (!user.weight_kg) missing.push('peso (kg)')
  if (!user.height_cm) missing.push('altura (cm)')
  if (!user.age) missing.push('idade')
  if (!user.gender) missing.push('gênero')
  if (!user.goal_calories) missing.push('meta calórica (kcal)')
  // user_name é opcional, não incluir em missing
  return missing
}

export async function handleViewUserDataIntent(
  context: IntentContext
): Promise<string> {
  const { user } = context

  if (!user) {
    return '⚠️ Não encontrei seu cadastro. Digite "ajuda" para começar.'
  }

  // Calcular IMC se tiver peso e altura
  let imcInfo = ''
  if (user.weight_kg && user.height_cm) {
    const imc = (user.weight_kg / ((user.height_cm / 100) ** 2)).toFixed(1)
    const imcCategory = getIMCCategory(parseFloat(imc))
    imcInfo = `\n💚 IMC: ${imc} (${imcCategory})`
  }

  const missing = getMissingFields(user)
  const onboardingComplete = missing.length === 0

  return `👤 SEU PERFIL

${DIVIDER}
📋 DADOS PESSOAIS
• Nome: ${user.user_name || '—'}
• Gênero: ${user.gender || '—'}

📏 DADOS FÍSICOS
• Peso: ${user.weight_kg ? `${user.weight_kg}kg` : '—'}
• Altura: ${user.height_cm ? `${user.height_cm}cm` : '—'}
• Idade: ${user.age ? `${user.age} anos` : '—'}${imcInfo}

🎯 METAS
• Calorias: ${user.goal_calories ? `${user.goal_calories} kcal/dia` : '—'}
• Proteína: ${user.goal_protein_g ? `${user.goal_protein_g}g/dia` : '—'}

${DIVIDER}
${onboardingComplete 
  ? '✅ Cadastro completo!' 
  : '⚠️ Complete seu cadastro para melhor precisão'}

Para atualizar: "Meu peso é Xkg"`.trim()
}
