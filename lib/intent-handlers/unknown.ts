import { IntentContext } from '@/lib/intent-handlers/types'

export async function handleUnknownIntent(
  context: IntentContext
): Promise<string> {
  console.log('⚠️ Unknown intent handler invoked:', {
    message: context.messageText,
  })

  return (
    '🤔 Ainda não sei como responder isso.\n' +
    'Digite "ajuda" para ver os comandos disponíveis ou descreva novamente.'
  )
}

