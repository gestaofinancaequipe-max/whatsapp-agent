import { IntentContext } from '@/lib/intent-handlers/types'

export async function handleUnknownIntent(
  context: IntentContext
): Promise<string> {
  console.log('⚠️ Unknown intent handler invoked:', {
    message: context.messageText,
  })

  const lastMessage = context.messageText.toLowerCase()
  let suggestion = ''

  // Tentar detectar o que usuário queria
  if (/\d/.test(lastMessage) && /kg|kilo|peso/i.test(lastMessage)) {
    suggestion = '\n\n💡 Você quis atualizar seu peso? Tente: "Meu peso é Xkg"'
  } else if (/caloria/i.test(lastMessage)) {
    suggestion = '\n\n💡 Para consultar: "Quantas calorias tem em X?"'
  } else if (/comi|comida|almoço|jantar/i.test(lastMessage)) {
    suggestion = '\n\n💡 Para registrar: "Comi X quantidade de Y"'
  }

  return `🤔 Não entendi sua mensagem.

${suggestion}

Digite "Ajuda" para ver comandos disponíveis.

Ou reformule sua mensagem que tento novamente!`.trim()
}

