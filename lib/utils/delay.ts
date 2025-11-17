/**
 * Simula delay humano antes de responder
 * Útil para tornar as respostas mais naturais e evitar cortar mensagens conectadas
 * @param minMs Tempo mínimo em milissegundos (padrão: 1500ms)
 * @param maxMs Tempo máximo em milissegundos (padrão: 3000ms)
 * @returns Promise que resolve após o delay
 */
export async function simulateHumanDelay(
  minMs: number = 1500,
  maxMs: number = 3000
): Promise<void> {
  // Permitir override via variáveis de ambiente
  const envMin = process.env.MIN_RESPONSE_DELAY_MS
  const envMax = process.env.MAX_RESPONSE_DELAY_MS

  const finalMin = envMin ? parseInt(envMin, 10) : minMs
  const finalMax = envMax ? parseInt(envMax, 10) : maxMs

  // Garantir que min <= max e valores razoáveis (não mais que 5 segundos)
  const actualMin = Math.min(finalMin, finalMax, 5000)
  const actualMax = Math.min(Math.max(finalMin, finalMax), 5000)

  // Se valores estão incorretos (ex: 19000ms), usar padrão
  if (actualMin > 5000 || actualMax > 5000 || isNaN(actualMin) || isNaN(actualMax)) {
    console.warn('⚠️ Invalid delay values detected, using defaults:', {
      envMin,
      envMax,
      actualMin,
      actualMax,
    })
    const defaultMin = 1500
    const defaultMax = 3000
    const delay = Math.floor(Math.random() * (defaultMax - defaultMin + 1)) + defaultMin
    console.log('⏳ Simulating human delay (default):', { delayMs: delay })
    await new Promise((resolve) => setTimeout(resolve, delay))
    return
  }

  // Gerar delay aleatório entre min e max
  const delay = Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin

  console.log('⏳ Simulating human delay:', {
    delayMs: delay,
    minMs: actualMin,
    maxMs: actualMax,
    usingEnv: !!(envMin || envMax),
  })

  await new Promise((resolve) => setTimeout(resolve, delay))
}

