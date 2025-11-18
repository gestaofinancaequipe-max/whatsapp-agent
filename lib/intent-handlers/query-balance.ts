import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import {
  createProgressBar,
  formatNumber,
  getBalanceEmoji,
  DIVIDER,
} from '@/lib/utils/message-formatters'
import { getHourBR } from '@/lib/utils/date-br'

function getContextualAdvice(data: {
  saldo: number
  consumed: number
  burned: number
  goal: number
}): string {
  const { saldo, consumed, burned, goal } = data
  
  // Obter hora no horário do Brasil (BRT/BRST)
  const hour = getHourBR()

  // Manhã (antes das 12h) - muito saldo
  if (hour < 12 && saldo > goal * 0.7) {
    return '💡 Você tem bastante espaço ainda. Café da manhã reforçado?'
  }

  // Período de almoço (12h-14h) - saldo ok
  if (hour >= 12 && hour < 14 && saldo > goal * 0.3) {
    return '✅ Ritmo bom! Continue assim no almoço.'
  }

  // Tarde (14h-18h) - saldo ok
  if (hour >= 14 && hour < 18 && saldo > goal * 0.3) {
    return '✅ Ritmo bom! Mantenha o foco no jantar.'
  }

  // Noite (18h+) - saldo apertado
  if (hour >= 18 && saldo < goal * 0.2 && saldo > 0) {
    return '⚠️ Saldo baixo. Jantar leve é a melhor opção!'
  }

  // Estourou a meta
  if (saldo < 0) {
    const deficit = Math.abs(saldo)
    if (burned < 200) {
      return `💪 Que tal um treino de ${Math.ceil(deficit / 8)} min para compensar?`
    }
    return '⚠️ Acima da meta hoje. Amanhã é um novo dia!'
  }

  // Quase na meta (últimas 200 kcal)
  if (saldo < 200) {
    return '🎯 Quase lá! Uma refeição leve fecha o dia perfeitamente.'
  }

  return ''
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

  const goal = context.user.goal_calories || 2000
  const consumed = summary.total_calories_consumed || 0
  const burned = summary.total_calories_burned || 0
  const net = consumed - burned
  const saldo = goal - net
  const percentOfGoal = Math.round((net / goal) * 100)
  const progressBar = createProgressBar(net, goal, 10)
  const statusEmoji = getBalanceEmoji(saldo)

  const advice = getContextualAdvice({ saldo, consumed, burned, goal })

  return `📊 SALDO DE HOJE

${progressBar}
${percentOfGoal}% da meta atingida

🍽️ Consumido: ${formatNumber(consumed)}
🔥 Queimado: ${formatNumber(burned)}
${DIVIDER}
⚖️ Líquido: ${formatNumber(net)}

🎯 Meta diária: ${formatNumber(goal)}
${statusEmoji} Saldo: ${saldo > 0 ? '+' : ''}${formatNumber(saldo)}

${advice}`.trim()
}

