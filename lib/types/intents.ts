export type IntentType =
  | 'greeting'
  | 'help'
  | 'register_meal'
  | 'register_exercise'
  | 'query_balance'
  | 'query_food_info'
  | 'daily_summary'
  | 'summary_week'
  | 'update_goal'
  | 'unknown'

export interface IntentResult {
  intent: IntentType
  confidence: number
  matchedPattern?: string
}

