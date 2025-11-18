import { IntentContext } from '@/lib/intent-handlers/types'
import { getOrCreateDailySummary } from '@/lib/services/daily-summaries'
import { formatNumber, DIVIDER } from '@/lib/utils/message-formatters'

export async function handleHelpIntent({
  user,
}: IntentContext): Promise<string> {
  let contextualTip = ''
  const hasProfile = !!user

  if (user) {
    const summary = await getOrCreateDailySummary(user.id)
    if (summary && summary.total_calories_consumed > 0) {
      contextualTip = `💡 Você já registrou ${formatNumber(summary.total_calories_consumed)} hoje. Continue atualizando!`
    } else {
      contextualTip = '💡 Registre sua primeira refeição hoje!'
    }
  } else {
    contextualTip = '💡 Complete seu cadastro para começar!'
  }

  return `📚 COMANDOS DISPONÍVEIS

🍽️ ALIMENTAÇÃO
• "Comi 2 ovos com pão integral"
• "Almocei arroz, feijão e frango"
• "Quantas calorias tem em 1 banana?"

💪 EXERCÍCIOS
• "Corri 30 minutos"
• "Fiz musculação 1 hora"
• "Treino funcional 45 min"

📊 CONSULTAS
• "Saldo" → Ver calorias restantes hoje
• "Resumo" → Balanço completo do dia
• "Semana" → Análise dos últimos 7 dias

⚙️ PERFIL
• "Meu peso é 75kg" → Atualizar dados
• "Minha meta é 1800 kcal" → Mudar objetivo
• "Meus dados" → Ver perfil completo

${DIVIDER}
${contextualTip}

Dúvidas? Me mande mensagem!`.trim()
}

