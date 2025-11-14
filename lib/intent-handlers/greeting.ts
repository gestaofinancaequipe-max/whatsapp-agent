import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData } from '@/lib/services/users'

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

  if (user && !user.onboarding_completed) {
    await upsertUserData(user.id, {
      onboarding_completed: false,
    })
  }

  const baseGreeting = `👋 Olá, ${displayName}! Estou aqui para cuidar do seu diário nutricional.`
  const features = `\n\n✨ Posso te ajudar com:\n${buildFeatureText()}`
  const onboarding =
    user && !user.onboarding_completed ? buildOnboardingPrompt() : ''

  return `${baseGreeting}${features}${onboarding}\n\nDigite "ajuda" para ver todos os comandos.`
}

