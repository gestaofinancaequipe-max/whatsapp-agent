import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import {
  countExercisesForDate,
  countMealsForDate,
} from '@/lib/services/activity-metrics'
import {
  createProgressBar,
  formatNumber,
  formatDate,
  getBalanceEmoji,
  DIVIDER,
  pluralize,
} from '@/lib/utils/message-formatters'

function getEndOfDayMotivation(data: {
  saldo: number
  mealsCount: number
  exercisesCount: number
  net: number
  goal: number
}): string {
  const { saldo, mealsCount, exercisesCount, net, goal } = data

  // Bateu meta perfeitamente
  if (Math.abs(saldo) < 50) {
    return '🎉 Dia impecável! Disciplina é tudo!'
  }

  // Dentro da meta com folga
  if (saldo > 0 && saldo < goal * 0.2) {
    return '👏 Excelente controle! Continue assim!'
  }

  // Acima da meta mas treinou
  if (saldo < 0 && exercisesCount > 0) {
    return '💪 Treinou, isso já é um ganho! Amanhã compensa.'
  }

  // Acima da meta e não treinou
  if (saldo < 0 && exercisesCount === 0) {
    return '💡 Que tal um treino amanhã para ajudar?'
  }

  // Muito abaixo da meta (comeu pouco)
  if (saldo > goal * 0.4) {
    return '⚠️ Você comeu pouco hoje. Lembre-se: alimentação adequada é importante!'
  }

  return '✅ Mais um dia registrado. Consistência gera resultados!'
}

export async function handleDailySummaryIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Não encontrei seu perfil ainda. Digite "ajuda" para começar.'
  }

  const summary = await getOrCreateDailySummary(context.user.id)
  if (!summary) {
    return '❌ Não consegui acessar seus dados hoje. Tente novamente em instantes.'
  }

  const dateLabel = formatDate(summary.date)
  const mealsCount = await countMealsForDate(context.user.id, summary.date)
  const exercisesCount = await countExercisesForDate(
    context.user.id,
    summary.date
  )

  const goal = context.user.goal_calories || 2000
  const net = summary.net_calories || summary.total_calories_consumed || 0
  const saldo = goal - net
  const percentOfGoal = Math.round((net / goal) * 100)
  const progressBar = createProgressBar(net, goal, 10)

  // Determinar status do dia
  let statusMessage = ''
  let statusEmoji = ''

  if (saldo > 0 && percentOfGoal >= 85 && percentOfGoal <= 105) {
    statusMessage = 'Dia perfeito!'
    statusEmoji = '🎯'
  } else if (saldo > 0) {
    statusMessage = 'Dentro da meta'
    statusEmoji = '✅'
  } else {
    statusMessage = 'Acima da meta'
    statusEmoji = '⚠️'
  }

  const motivation = getEndOfDayMotivation({
    saldo,
    mealsCount,
    exercisesCount,
    net,
    goal,
  })

  return `📊 RESUMO DO DIA
${dateLabel}

${progressBar}
${statusEmoji} ${statusMessage} (${percentOfGoal}%)

${DIVIDER}
🍽️ Consumido: ${formatNumber(summary.total_calories_consumed)}
🔥 Queimado: ${formatNumber(summary.total_calories_burned)}
⚖️ Líquido: ${formatNumber(net)}

🎯 Meta: ${formatNumber(goal)}
${getBalanceEmoji(saldo)} Saldo: ${saldo > 0 ? '+' : ''}${formatNumber(saldo)}

🥩 Proteína: ${formatNumber(summary.total_protein_g, 'g')}

${DIVIDER}
📝 ${mealsCount} ${pluralize(mealsCount, 'refeição', 'refeições')}
💪 ${exercisesCount} ${pluralize(exercisesCount, 'treino', 'treinos')}

${motivation}`.trim()
}

