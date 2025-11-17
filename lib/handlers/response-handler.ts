import { IntentType } from '@/lib/types/intents'

const FALLBACK_RESPONSE =
  '🤖 [MODO TESTE] Ainda não entendi esse pedido. Pode reformular?'

export function generateMockResponse(intent: IntentType, originalMessage: string): string {
  switch (intent) {
    case 'greeting':
      return '👋 [MODO TESTE] Olá! Estou em fase de testes, mas já consigo registrar suas mensagens.'
    case 'help':
      return '🆘 [MODO TESTE] Comandos disponíveis: registrar refeição, exercício, saldo, info de alimentos, resumo, atualizar meta.'
    case 'register_meal':
      return '🍽️ [MODO TESTE] Registrando refeição...\n\nEstou validando a comunicação. Em breve vou calcular calorias automaticamente.'
    case 'register_exercise':
      return '🏃 [MODO TESTE] Registrando exercício...\n\nLogo vou contabilizar calorias gastas. Obrigado por testar!'
    case 'query_balance':
      return '⚖️ [MODO TESTE] Consulta de saldo em desenvolvimento. Assim que estiver pronto, te aviso quanto ainda pode consumir.'
    case 'query_food_info':
      return `🥑 [MODO TESTE] Informações nutricionais para "${originalMessage}" ainda estão em construção, mas já recebi seu pedido.`
    case 'daily_summary':
      return '📊 [MODO TESTE] Gerando resumo diário...\n\nEm breve vou consolidar suas refeições e exercícios automaticamente.'
    case 'update_user_data':
      return '✅ [MODO TESTE] Dados atualizados! Em breve vou ajustar seus cálculos com base nesses dados.'
    case 'unknown':
    default:
      return FALLBACK_RESPONSE
  }
}

