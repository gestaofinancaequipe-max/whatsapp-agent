import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'

function formatNumber(value: number | null | undefined, suffix = 'kcal') {
  if (value === null || value === undefined) return `0 ${suffix}`
  return `${Math.round(value)} ${suffix}`
}

export async function handleQueryBalanceIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Não encontrei seu perfil ainda. Digite "ajuda" para criar sua conta.'
  }

  const summary = await getOrCreateDailySummary(context.user.id)
  if (!summary) {
    return '❌ Não consegui acessar seus dados hoje. Tente novamente em instantes.'
  }

  const goalCalories = context.user.goal_calories || 2000
  const consumed = summary.total_calories_consumed || 0
  const burned = summary.total_calories_burned || 0
  const net = consumed - burned
  const balance = goalCalories - net

  return [
    '📊 Saldo de hoje:',
    `Meta: ${formatNumber(goalCalories)}`,
    `Consumido: ${formatNumber(consumed)}`,
    `Queimado: ${formatNumber(burned)}`,
    '',
    `➡️ NET: ${formatNumber(net)}`,
    `✅ SALDO: ${formatNumber(balance)}`,
    balance > 0
      ? 'Ainda dá para comer com tranquilidade! 😋'
      : 'Você já bateu a meta hoje. Excelente controle! 💪',
  ].join('\n')
}

