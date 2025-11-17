export type IntentType =
  | 'greeting'
  | 'help'
  | 'register_meal'
  | 'register_exercise'
  | 'query_balance'
  | 'query_food_info'
  | 'daily_summary'
  | 'summary_week'
  | 'update_user_data'
  | 'update_goal'
  | 'onboarding'
  | 'unknown'

export interface IntentResult {
  intent: IntentType
  confidence: number
  matchedPattern?: string
  items?: Array<{
    alimento?: string // Para register_meal
    quantidade?: string | null
    exercicio?: string // Para register_exercise
    duracao?: string | null
  }>
}

