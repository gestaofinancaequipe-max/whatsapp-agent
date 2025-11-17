/**
 * Utilitários para armazenar dados temporários de refeições/exercícios
 * nas mensagens do assistente antes da confirmação
 */

export interface TemporaryMealData {
  type: 'meal'
  timestamp: string
  userId: string
  data: {
    description: string
    calories: number
    protein_g: number
    carbs_g: number | null
    fat_g: number | null
    fiber_g: number | null
    grams?: number | null
    originalEstimate: any
  }
}

export interface TemporaryExerciseData {
  type: 'exercise'
  timestamp: string
  userId: string
  data: {
    description: string
    exerciseType: string
    durationMinutes: number
    intensity: string
    metValue: number
    caloriesBurned: number
  }
}

export type TemporaryData = TemporaryMealData | TemporaryExerciseData

const TEMP_DATA_DELIMITER = '__TEMP_DATA_JSON__'
const TEMP_DATA_EXPIRY_MINUTES = 5

/**
 * Codifica dados temporários em uma string para anexar à mensagem
 */
export function encodeTempData(tempData: TemporaryData): string {
  return `${TEMP_DATA_DELIMITER}${JSON.stringify(tempData)}`
}

/**
 * Extrai dados temporários do content da mensagem
 */
export function extractTempData(content: string): TemporaryData | null {
  const match = content.match(new RegExp(`${TEMP_DATA_DELIMITER}(.+)`, 's'))
  if (!match) return null

  try {
    const tempData = JSON.parse(match[1]) as TemporaryData
    
    // Verificar se expirou
    const age = Date.now() - new Date(tempData.timestamp).getTime()
    const isExpired = age > TEMP_DATA_EXPIRY_MINUTES * 60 * 1000
    
    if (isExpired) {
      console.log('⏰ Temporary data expired:', {
        ageMinutes: Math.round(age / 60000),
        maxMinutes: TEMP_DATA_EXPIRY_MINUTES,
      })
      return null
    }

    return tempData
  } catch (error) {
    console.error('❌ Error parsing temp data:', error)
    return null
  }
}

/**
 * Remove dados temporários do content, retornando apenas a parte visível
 */
export function removeTempData(content: string): string {
  return content.split(TEMP_DATA_DELIMITER)[0].trim()
}

/**
 * Verifica se uma mensagem contém dados temporários
 */
export function hasTempData(content: string): boolean {
  return content.includes(TEMP_DATA_DELIMITER)
}

