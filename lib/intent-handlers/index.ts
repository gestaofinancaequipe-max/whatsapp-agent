import { generateMockResponse } from '@/lib/handlers/response-handler'
import { handleGreetingIntent } from '@/lib/intent-handlers/greeting'
import { handleHelpIntent } from '@/lib/intent-handlers/help'
import { handleLogFoodIntent } from '@/lib/intent-handlers/log-food'
import { IntentContext } from '@/lib/intent-handlers/types'

export async function handleIntent(
  context: IntentContext
): Promise<string> {
  console.log('🧭 Routing intent to handler:', {
    intent: context.intentResult.intent,
    userId: context.user?.id,
  })

  switch (context.intentResult.intent) {
    case 'greeting':
      return handleGreetingIntent(context)
    case 'help':
      return handleHelpIntent(context)
    case 'register_meal':
      return handleLogFoodIntent(context)
    default:
      return generateMockResponse(
        context.intentResult.intent,
        context.messageText
      )
  }
}

