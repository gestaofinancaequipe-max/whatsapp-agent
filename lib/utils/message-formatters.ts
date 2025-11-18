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
 * Formatação de data amigável
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateObj.toDateString() === today.toDateString()) {
    return 'Hoje'
  }
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return 'Ontem'
  }

  return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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

