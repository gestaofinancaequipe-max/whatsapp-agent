/**
 * Utilitários para trabalhar com datas no fuso horário do Brasil (America/Sao_Paulo)
 * 
 * O Supabase armazena timestamps em UTC, mas os usuários estão no Brasil (UTC-3).
 * Precisamos converter para o horário do Brasil ao fazer queries por data.
 */

/**
 * Retorna a data de hoje no formato YYYY-MM-DD no horário do Brasil
 * 
 * O Brasil está em UTC-3 (horário de Brasília, sem horário de verão desde 2019)
 */
export function getTodayDateBR(): string {
  const now = new Date()
  
  // Obter componentes da data no horário do Brasil
  // Usar Intl.DateTimeFormat para garantir conversão correta
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  
  return `${year}-${month}-${day}`
}

/**
 * Retorna a data de ontem no formato YYYY-MM-DD no horário do Brasil
 */
export function getYesterdayDateBR(): string {
  const now = new Date()
  // Subtrair 1 dia
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  // Obter componentes da data no horário do Brasil
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  
  const parts = formatter.formatToParts(yesterday)
  const year = parts.find(p => p.type === 'year')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  
  return `${year}-${month}-${day}`
}

/**
 * Converte uma data (YYYY-MM-DD) no horário do Brasil para o range UTC
 * para usar em queries do Supabase
 * 
 * O Brasil está em UTC-3 (horário de Brasília, sem horário de verão desde 2019)
 * 
 * @param date Data no formato YYYY-MM-DD (assumida como horário do Brasil)
 * @returns Objeto com start e end em UTC (ISO strings)
 */
export function getDateRangeUTC(date: string): { start: string; end: string } {
  const [year, month, day] = date.split('-').map(Number)
  
  // Criar data no início do dia no horário do Brasil (00:00:00 BR)
  // Brasil está em UTC-3, então 00:00:00 BR = 03:00:00 UTC (do mesmo dia)
  const startUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
  
  // Criar data no fim do dia no horário do Brasil (23:59:59.999 BR)
  // 23:59:59.999 BR = 02:59:59.999 UTC (do dia seguinte)
  const endUTC = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999))
  
  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  }
}

/**
 * Retorna a hora atual no horário do Brasil (0-23)
 * 
 * @returns Hora no formato 0-23 no horário de Brasília (BRT/BRST)
 */
export function getHourBR(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  })
  return parseInt(formatter.format(new Date()), 10)
}

/**
 * Retorna o timestamp atual no horário do Brasil formatado
 * 
 * @returns Timestamp ISO string convertido para horário do Brasil
 */
export function getNowBR(): Date {
  // Criar uma data que representa "agora" no horário do Brasil
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  
  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10)
  
  return new Date(year, month, day, hour, minute, second)
}

