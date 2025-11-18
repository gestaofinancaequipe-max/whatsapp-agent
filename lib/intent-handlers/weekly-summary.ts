import { IntentContext } from '@/lib/intent-handlers/types'
import { getSummariesInRange } from '@/lib/services/daily-summaries'
import { getTodayDateBR } from '@/lib/utils/date-br'
import { countExercisesForDate } from '@/lib/services/activity-metrics'
import {
  createProgressBar,
  formatNumber,
  formatPercent,
  DIVIDER,
} from '@/lib/utils/message-formatters'

function getDateRange() {
  // Usar data atual no horário do Brasil
  const todayBR = getTodayDateBR()
  const [year, month, day] = todayBR.split('-').map(Number)
  
  // Criar data de 6 dias atrás
  const endDate = new Date(year, month - 1, day)
  const startDate = new Date(year, month - 1, day - 6)
  
  const format = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  
  return {
    start: format(startDate),
    end: format(endDate),
    label: `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`,
  }
}

function calculateWeekGrade(data: {
  daysOnTarget: number
  totalDays: number
  totalWorkouts: number
}): { grade: string; emoji: string } {
  const { daysOnTarget, totalDays, totalWorkouts } = data
  const consistencyScore = (daysOnTarget / totalDays) * 70
  const workoutScore = (Math.min(totalWorkouts, 4) / 4) * 30
  const score = consistencyScore + workoutScore

  if (score >= 90) return { grade: 'A', emoji: '⭐' }
  if (score >= 75) return { grade: 'B', emoji: '✅' }
  if (score >= 60) return { grade: 'C', emoji: '💛' }
  return { grade: 'D', emoji: '⚠️' }
}

function getWeeklyInsights(data: {
  avgNet: number
  goal: number
  totalWorkouts: number
  avgProtein: number
  daysOnTarget: number
  totalDays: number
}): string {
  const { avgNet, goal, totalWorkouts, avgProtein, daysOnTarget, totalDays } = data
  const insights: string[] = []

  // Insight sobre calorias
  if (avgNet > goal * 1.1) {
    insights.push('📉 Você está comendo acima da meta. Reduza porções ou aumente exercícios.')
  } else if (avgNet < goal * 0.9) {
    insights.push('📈 Consumo abaixo da meta. Cuidado para não desacelerar metabolismo!')
  } else {
    insights.push('🎯 Calorias equilibradas! Continue assim.')
  }

  // Insight sobre treinos
  if (totalWorkouts < 3) {
    insights.push('💪 Meta: treinar pelo menos 3x por semana. Você consegue!')
  } else if (totalWorkouts >= 5) {
    insights.push('🔥 Frequência de treino excelente! Parabéns!')
  }

  // Insight sobre proteína
  if (avgProtein < 80) {
    insights.push('🥩 Proteína baixa. Adicione: ovos, frango, peixe ou whey.')
  }

  // Insight sobre consistência
  const consistencyRate = daysOnTarget / totalDays
  if (consistencyRate >= 0.85) {
    insights.push('🎉 Consistência impecável! Resultados virão!')
  } else if (consistencyRate < 0.5) {
    insights.push('💡 Foco na consistência. Pequenos passos todos os dias!')
  }

  if (insights.length === 0) return ''
  return `💡 INSIGHTS:\n${insights.map(i => `• ${i}`).join('\n')}`
}

export async function handleWeeklySummaryIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Não encontrei seu perfil. Digite "ajuda" para começar.'
  }

  const { start, end, label } = getDateRange()
  const summaries = await getSummariesInRange(context.user.id, start, end)

  if (summaries.length === 0) {
    return '📭 Não encontrei registros nos últimos dias. Experimente registrar suas refeições e exercícios!'
  }

  const totalCalories = summaries.reduce(
    (acc, day) => acc + (day.total_calories_consumed || 0) - (day.total_calories_burned || 0),
    0
  )
  const avgNet = totalCalories / summaries.length
  const goal = context.user.goal_calories || 2000
  const daysOnTarget = summaries.filter((day) => {
    const net =
      (day.total_calories_consumed || 0) - (day.total_calories_burned || 0)
    return net <= goal
  }).length

  const totalWorkouts = await Promise.all(
    summaries.map(s => countExercisesForDate(context.user!.id, s.date))
  ).then(counts => counts.reduce((a, b) => a + b, 0))

  const avgProtein = summaries.reduce(
    (acc, day) => acc + (day.total_protein_g || 0),
    0
  ) / summaries.length

  const deficit = goal * summaries.length - totalCalories
  const projectedWeightLoss = deficit / 7700 // kcal per kg

  const weekGrade = calculateWeekGrade({
    daysOnTarget,
    totalDays: summaries.length,
    totalWorkouts,
  })

  const percentOnTarget = formatPercent(daysOnTarget, summaries.length)
  const progressBar = createProgressBar(daysOnTarget, summaries.length, 7)

  const insights = getWeeklyInsights({
    avgNet,
    goal,
    totalWorkouts,
    avgProtein,
    daysOnTarget,
    totalDays: summaries.length,
  })

  return `📈 RESUMO SEMANAL
Últimos 7 dias

${weekGrade.emoji} Nota da semana: ${weekGrade.grade}

${DIVIDER}
📊 MÉDIAS DIÁRIAS
• Consumo líquido: ${Math.round(avgNet)} kcal
• Meta: ${formatNumber(goal)}
• Proteína: ${formatNumber(avgProtein, 'g')}

🎯 CONSISTÊNCIA
• ${daysOnTarget} de ${summaries.length} dias no target
• Taxa de acerto: ${percentOnTarget}%
${progressBar}

💪 TREINOS
• ${totalWorkouts} sessões na semana
${totalWorkouts >= 3 ? '✅ Frequência boa!' : '⚠️ Tente treinar 3x+'}

${deficit !== 0 ? `⚖️ BALANÇO ENERGÉTICO
• Déficit acumulado: ${Math.round(deficit)} kcal
• Projeção: ${projectedWeightLoss > 0 ? '-' : '+'}${Math.abs(projectedWeightLoss).toFixed(1)}kg

` : ''}${DIVIDER}
${insights}`.trim()
}

