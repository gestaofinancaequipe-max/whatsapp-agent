/**
 * Funções auxiliares de formatação de mensagens
 * Usar em todos os handlers para manter consistência
 */

// Separador visual
export const DIVIDER = '━━━━━━━━━━━━━━━━━━'

/**
 * Cria uma barra de progresso visual
 */
export function createProgressBar(
  current: number,
  goal: number,
  length: number = 10
): string {
  const percent = Math.min(current / goal, 1)
  const filled = Math.round(percent * length)
  const empty = length - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Formatação de data amigável (usa horário do Brasil)
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Usar formatação no timezone do Brasil
  const formatterBR = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  // Obter data de hoje e ontem no horário do Brasil
  const todayBR = formatterBR.formatToParts(new Date())
  const yesterdayBR = formatterBR.formatToParts(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const dateBR = formatterBR.formatToParts(dateObj)
  
  const getDateString = (parts: Intl.DateTimeFormatPart[]) => {
    const year = parts.find(p => p.type === 'year')?.value || ''
    const month = parts.find(p => p.type === 'month')?.value || ''
    const day = parts.find(p => p.type === 'day')?.value || ''
    return `${year}-${month}-${day}`
  }
  
  const todayStr = getDateString(todayBR)
  const yesterdayStr = getDateString(yesterdayBR)
  const dateStr = getDateString(dateBR)

  if (dateStr === todayStr) {
    return 'Hoje'
  }
  if (dateStr === yesterdayStr) {
    return 'Ontem'
  }

  // Formatar data no estilo brasileiro (dd/mm)
  const day = dateBR.find(p => p.type === 'day')?.value || ''
  const month = dateBR.find(p => p.type === 'month')?.value || ''
  return `${day}/${month}`
}

/**
 * Emoji baseado em valor (positivo/negativo)
 */
export function getBalanceEmoji(value: number): string {
  if (value > 300) return '💚'
  if (value > 0) return '💛'
  return '🔴'
}

/**
 * Truncar texto longo
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Pluralização automática
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural
}

/**
 * Formata número com sufixo
 */
export function formatNumber(
  value: number | null | undefined,
  suffix: string = 'kcal'
): string {
  if (value === null || value === undefined) return `0 ${suffix}`
  return `${Math.round(value)} ${suffix}`
}

/**
 * Formata porcentagem
 */
export function formatPercent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

/**
 * Calcula categoria de IMC
 */
export function getIMCCategory(imc: number): string {
  if (imc < 18.5) return 'Abaixo do peso'
  if (imc < 25) return 'Peso normal'
  if (imc < 30) return 'Sobrepeso'
  return 'Obesidade'
}

