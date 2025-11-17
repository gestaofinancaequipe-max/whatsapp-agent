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

const FEATURE_LIST = [
  '🍽️ Registrar refeições com calorias e proteínas',
  '🏃 Registrar exercícios e calorias queimadas',
  '📊 Consultar saldo do dia e metas',
  '🍕 Ver informações nutricionais de alimentos',
  '📈 Receber resumo diário e semanal',
  '🎯 Atualizar metas, peso e preferências',
]

function getUserDisplayName(phone?: string) {
  if (!phone) return 'por aqui'
  const suffix = phone.slice(-4)
  return `+${phone} (…${suffix})`
}

function buildFeatureText() {
  return FEATURE_LIST.map((item) => `• ${item}`).join('\n')
}

function buildOnboardingPrompt() {
  return (
    '\n\n🚀 Ainda não configuramos seu perfil! Vamos começar?\n' +
    'Me envie estas infos (uma por vez):\n' +
    '1️⃣ Peso atual\n' +
    '2️⃣ Altura\n' +
    '3️⃣ Idade\n' +
    '4️⃣ Meta de calorias (ou posso sugerir)'
  )
}

export async function handleGreetingIntent({
  user,
}: IntentContext): Promise<string> {
  const displayName = getUserDisplayName(user?.phone_number)

  const baseGreeting = `👋 Olá! Estou aqui para cuidar do seu diário nutricional.`
  const features = `\n\nPosso te ajudar com:\n${buildFeatureText()}`
  
  // Mostrar prompt de onboarding se faltam campos obrigatórios
  const missing = getMissingFields(user)
  const onboarding = missing.length > 0 ? buildOnboardingPrompt() : ''

  return `${baseGreeting}${features}${onboarding}\n\nDigite "ajuda" para ver todos os comandos.`
}

