import { IntentContext } from '@/lib/intent-handlers/types'
import { UserRecord } from '@/lib/services/users'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import { formatNumber } from '@/lib/utils/message-formatters'

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

function getUserDisplayName(user: UserRecord | null | undefined): string {
  if (user?.user_name) return user.user_name
  if (user?.phone_number) {
    const suffix = user.phone_number.slice(-4)
    return `…${suffix}`
  }
  return 'por aqui'
}

export async function handleGreetingIntent({
  user,
}: IntentContext): Promise<string> {
  // Usuário novo (sem perfil)
  if (!user) {
    return `Olá! 👋

Sou seu assistente pessoal de nutrição.

Vou te ajudar a controlar suas calorias de forma simples, direto aqui no WhatsApp.

Para começar, como posso te chamar?`.trim()
  }

  const displayName = getUserDisplayName(user)
  const missing = getMissingFields(user)
  const isOnboardingComplete = missing.length === 0

  // Usuário retornando com perfil completo
  if (isOnboardingComplete) {
    const summary = await getOrCreateDailySummary(user.id)
    const consumed = summary?.total_calories_consumed || 0
    const burned = summary?.total_calories_burned || 0
    const goal = user.goal_calories || 2000
    const net = consumed - burned
    const saldo = goal - net

    return `Olá novamente, ${displayName}! 👋

📊 Status de hoje:
• Consumido: ${formatNumber(consumed)}
• Queimado: ${formatNumber(burned)}
• Saldo: ${formatNumber(saldo)} restantes

O que você gostaria de fazer?`.trim()
  }

  // Usuário retornando com perfil incompleto
  const missingList = missing.map((f, idx) => `${idx + 1}. ${f}`).join('\n')
  
  return `Olá, ${displayName}! 👋

Notei que faltam alguns dados no seu perfil:

${missingList}

Quer completar agora para eu calcular suas calorias com precisão?

1️⃣ Sim, vamos completar
2️⃣ Depois (vou usar valores estimados)`.trim()
}

