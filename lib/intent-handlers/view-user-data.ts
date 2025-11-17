import { IntentContext } from '@/lib/intent-handlers/types'
import { UserRecord } from '@/lib/services/users'

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

  // Montar seções de dados
  const sections: string[] = ['👤 Seus Dados Cadastrados\n']

  // Dados pessoais
  const personalData: string[] = []
  if (user.user_name) {
    personalData.push(`👋 Nome: ${user.user_name}`)
  }
  
  if (user.gender) {
    personalData.push(`⚧️ Gênero: ${user.gender}`)
  }

  if (personalData.length > 0) {
    sections.push(personalData.join('\n'))
    sections.push('') // Linha em branco
  }

  // Dados físicos
  const physicalData: string[] = []
  if (user.weight_kg) {
    physicalData.push(`📏 Peso: ${user.weight_kg} kg`)
  } else {
    physicalData.push('📏 Peso: Não informado')
  }

  if (user.height_cm) {
    physicalData.push(`📐 Altura: ${user.height_cm} cm`)
  } else {
    physicalData.push('📐 Altura: Não informado')
  }

  if (user.age) {
    physicalData.push(`🎂 Idade: ${user.age} anos`)
  } else {
    physicalData.push('🎂 Idade: Não informado')
  }

  if (physicalData.length > 0) {
    sections.push(physicalData.join('\n'))
  }

  // Metas
  sections.push('\n🎯 Metas:')
  const goals: string[] = []
  
  if (user.goal_calories) {
    goals.push(`• Calorias diárias: ${user.goal_calories} kcal`)
  } else {
    goals.push('• Calorias diárias: Não definida')
  }

  if (user.goal_protein_g) {
    goals.push(`• Proteína diária: ${user.goal_protein_g} g`)
  } else {
    goals.push('• Proteína diária: Não definida')
  }

  sections.push(goals.join('\n'))

  // Status do cadastro (baseado em campos faltantes)
  const missing = getMissingFields(user)
  sections.push('\n' + (missing.length === 0 ? '✅ Cadastro completo' : '⚠️ Cadastro incompleto'))

  // Instruções para atualizar
  sections.push('\n💡 Para atualizar, envie:')
  sections.push('• "Meu nome é João" para atualizar nome')
  sections.push('• "Gênero masculino" para atualizar gênero')
  sections.push('• "Peso 85kg" para atualizar peso')
  sections.push('• "Altura 180cm" ou "1,80m" para atualizar altura')
  sections.push('• "Idade 30 anos" para atualizar idade')
  sections.push('• "Meta 2000 kcal" para atualizar meta de calorias')
  sections.push('• "Proteína 150g" para atualizar meta de proteína')

  return sections.join('\n')
}

