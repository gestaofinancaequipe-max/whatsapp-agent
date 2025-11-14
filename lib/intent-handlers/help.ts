import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'

const COMMANDS = [
  { label: '🍽️ Registrar refeição', example: '"Comi 2 fatias de pizza"' },
  { label: '🏃 Registrar exercício', example: '"Corri 30 minutos"' },
  { label: '📊 Ver saldo do dia', example: '"Saldo" ou "Quanto posso comer?"' },
  { label: '🥑 Info nutricional', example: '"Calorias do abacate"' },
  { label: '📈 Resumo do dia/semana', example: '"Resumo do dia" ou "Resumo da semana"' },
  { label: '🎯 Atualizar metas/peso', example: '"Minha meta é 1800" ou "Peso 82kg"' },
]

function buildCommandsText() {
  return COMMANDS.map((cmd) => `${cmd.label}\n   Ex: ${cmd.example}`).join('\n\n')
}

export async function handleHelpIntent({
  user,
}: IntentContext): Promise<string> {
  let contextualTip = ''

  if (user) {
    const summary = await getOrCreateDailySummary(user.id)
    if (summary && summary.total_calories_consumed > 0) {
      contextualTip = `\n\n📌 Dica: hoje você já registrou ${summary.total_calories_consumed} kcal. Continue atualizando para manter o saldo em dia!`
    } else {
      contextualTip =
        '\n\n📌 Dica: ainda não vi refeições hoje. Experimente mandar "Comi arroz e feijão" para registrar.'
    }
  }

  return (
    '🆘 Estou aqui para ajudar! Veja o que posso fazer:\n\n' +
    buildCommandsText() +
    contextualTip +
    '\n\nSempre que quiser, digite "ajuda" novamente.'
  )
}

