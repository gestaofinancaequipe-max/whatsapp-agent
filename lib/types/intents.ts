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
  | 'view_user_data'
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
  user_data?: {
    // Dados estruturados para update_user_data
    user_name?: string | null
    gender?: string | null // 'masculino' ou 'feminino'
    weight_kg?: number
    height_cm?: number // sempre em cm (LLM converte se necessário)
    age?: number
    goal_calories?: number
    goal_protein_g?: number
  }
}

