import { generateMockResponse } from '@/lib/handlers/response-handler'
import { handleGreetingIntent } from '@/lib/intent-handlers/greeting'
import { handleHelpIntent } from '@/lib/intent-handlers/help'
import { handleLogFoodIntent } from '@/lib/intent-handlers/log-food'
import { handleLogExerciseIntent } from '@/lib/intent-handlers/log-exercise'
import { handleQueryBalanceIntent } from '@/lib/intent-handlers/query-balance'
import { handleQueryFoodIntent } from '@/lib/intent-handlers/query-food'
import { handleDailySummaryIntent } from '@/lib/intent-handlers/daily-summary'
import { handleWeeklySummaryIntent } from '@/lib/intent-handlers/weekly-summary'
import { handleUpdateUserDataIntent } from '@/lib/intent-handlers/update-user-data'
import { handleViewUserDataIntent } from '@/lib/intent-handlers/view-user-data'
import { handleUnknownIntent } from '@/lib/intent-handlers/unknown'
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
    case 'register_exercise':
      return handleLogExerciseIntent(context)
    case 'query_balance':
      return handleQueryBalanceIntent(context)
    case 'query_food_info':
      return handleQueryFoodIntent(context)
    case 'daily_summary':
      return handleDailySummaryIntent(context)
    case 'summary_week':
      return handleWeeklySummaryIntent(context)
    case 'update_user_data':
      return handleUpdateUserDataIntent(context)
    case 'view_user_data':
      return handleViewUserDataIntent(context)
    default:
      return handleUnknownIntent(context)
  }
}

