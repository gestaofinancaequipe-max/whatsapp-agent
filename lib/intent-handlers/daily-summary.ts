import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import {
  countExercisesForDate,
  countMealsForDate,
} from '@/lib/services/activity-metrics'

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(date))
}

function formatKcal(value: number | null | undefined) {
  return `${Math.round(value || 0)} kcal`
}

function formatProtein(value: number | null | undefined) {
  return `${Math.round(value || 0)} g prot`
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

  const goalCalories = context.user.goal_calories || 2000
  const net = summary.net_calories || summary.total_calories_consumed || 0
  const balance = goalCalories - net
  const status =
    balance >= 0
      ? '✅ Dentro da meta!'
      : '⚠️ Acima da meta, mas ainda dá tempo de ajustar.'

  return [
    `📊 Resumo de hoje (${dateLabel}):`,
    '',
    `🍽️ Consumido: ${formatKcal(summary.total_calories_consumed)} | ${formatProtein(summary.total_protein_g)}`,
    `🏃 Queimado: ${formatKcal(summary.total_calories_burned)}`,
    `⚖️ Líquido: ${formatKcal(net)}`,
    '',
    `Meta: ${formatKcal(goalCalories)}`,
    `Saldo: ${formatKcal(balance)}`,
    `Status: ${status}`,
    '',
    `Refeições confirmadas: ${mealsCount}`,
    `Exercícios registrados: ${exercisesCount}`,
  ].join('\n')
}

