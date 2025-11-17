import { IntentContext } from '@/lib/intent-handlers/types'

export async function handleViewUserDataIntent(
  context: IntentContext
): Promise<string> {
  const { user } = context

  if (!user) {
    return '⚠️ Não encontrei seu cadastro. Digite "ajuda" para começar.'
  }

  // Montar seções de dados
  const sections: string[] = ['👤 Seus Dados Cadastrados\n']

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

  // Status do cadastro
  sections.push('\n' + (user.onboarding_completed ? '✅ Cadastro completo' : '⚠️ Cadastro incompleto'))

  // Instruções para atualizar
  sections.push('\n💡 Para atualizar, envie:')
  sections.push('• "Peso 85kg" para atualizar peso')
  sections.push('• "Altura 180cm" para atualizar altura')
  sections.push('• "Idade 30 anos" para atualizar idade')
  sections.push('• "Minha meta é 2000" para atualizar meta de calorias')

  return sections.join('\n')
}

