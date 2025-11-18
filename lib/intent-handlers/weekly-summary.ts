import { IntentContext } from '@/lib/intent-handlers/types'
import { getSummariesInRange } from '@/lib/services/daily-summaries'
import { getTodayDateBR } from '@/lib/utils/date-br'

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
  const averageCalories = totalCalories / summaries.length
  const goal = context.user.goal_calories || 2000
  const daysOnTarget = summaries.filter((day) => {
    const net =
      (day.total_calories_consumed || 0) - (day.total_calories_burned || 0)
    return net <= goal
  }).length

  const deficit = goal * summaries.length - totalCalories
  const projectedWeightLoss = deficit / 7700 // kcal per kg

  return [
    `📈 Semana ${label}:`,
    '',
    `Média consumo líquido: ${Math.round(averageCalories)} kcal/dia`,
    `Meta: ${goal} kcal`,
    `Dias no target: ${daysOnTarget}/${summaries.length} 🎯`,
    '',
    `Déficit acumulado: ${Math.round(deficit)} kcal`,
    `Projeção de perda: ~${projectedWeightLoss.toFixed(2)} kg`,
    '',
    'Continue registrando para manter esse ritmo! 💪',
  ].join('\n')
}

