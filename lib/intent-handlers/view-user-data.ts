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

  // Status do cadastro
  sections.push('\n' + (user.onboarding_completed ? '✅ Cadastro completo' : '⚠️ Cadastro incompleto'))

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

