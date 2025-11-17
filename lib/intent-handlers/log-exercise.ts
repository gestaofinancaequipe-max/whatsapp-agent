import { IntentContext } from '@/lib/intent-handlers/types'
import { findExerciseMet, resolveMetValue } from '@/lib/services/exercise-met'
import { createPendingExercise } from '@/lib/services/exercises'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { extractExerciseWithLLM } from '@/lib/services/exercise-parser'

const INTENSITY_KEYWORDS: Record<string, 'light' | 'moderate' | 'intense'> = {
  leve: 'light',
  tranquilo: 'light',
  moderado: 'moderate',
  moderada: 'moderate',
  intenso: 'intense',
  intensa: 'intense',
  forte: 'intense',
  pesado: 'intense',
}

const DEFAULT_WEIGHT_KG = 70

interface ParsedExercise {
  durationMinutes: number
  intensity: 'light' | 'moderate' | 'intense'
  exerciseQuery: string
}

const durationRegex = /(\d{1,3})(?:\s*)(min|mins|minutos?)/i

function parseExerciseMessage(text: string): ParsedExercise {
  let durationMinutes = 30
  const durationMatch = text.match(durationRegex)
  if (durationMatch) {
    durationMinutes = parseInt(durationMatch[1], 10)
  }

  let intensity: 'light' | 'moderate' | 'intense' = 'moderate'
  for (const [keyword, value] of Object.entries(INTENSITY_KEYWORDS)) {
    if (text.toLowerCase().includes(keyword)) {
      intensity = value
      break
    }
  }

  const exerciseQuery = text.replace(durationRegex, '').trim()

  return {
    durationMinutes: Math.max(durationMinutes, 5),
    intensity,
    exerciseQuery: exerciseQuery.length > 0 ? exerciseQuery : text,
  }
}

function formatCalories(value: number) {
  return `${Math.round(value)} kcal`
}

export async function handleLogExerciseIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Preciso do seu cadastro para registrar exercícios. Digite "ajuda" para começar.'
  }

  if (!context.user.weight_kg) {
    return '⚖️ Para calcular calorias queimadas preciso do seu peso atual. Envie algo como "Peso 82kg" e depois tente registrar o exercício novamente.'
  }

  // Tentar extrair com LLM primeiro
  const llmResult = await extractExerciseWithLLM(context.messageText)
  
  // Fallback para parser regex se LLM não funcionar
  const regexParsed = parseExerciseMessage(context.messageText)
  
  // Usar resultado do LLM se disponível, senão usar regex
  const exerciseName = llmResult.exercise || regexParsed.exerciseQuery
  const durationMinutes = llmResult.duration_minutes || regexParsed.durationMinutes
  const intensity = llmResult.intensity || regexParsed.intensity

  console.log('🏃 Exercise extraction:', {
    original: context.messageText,
    llmResult,
    regexParsed,
    final: { exerciseName, durationMinutes, intensity },
  })

  if (!exerciseName || exerciseName.trim().length === 0) {
    return '🔍 Não consegui identificar o exercício. Pode descrever novamente? Ex: "corri 30 minutos"'
  }

  const exercise = await findExerciseMet(exerciseName)
  if (!exercise) {
    await logFoodFallback({
      query: exerciseName,
      phoneNumber: context.user.phone_number,
    })
    return `🤔 Ainda não conheço "${exerciseName}". Vou pesquisar e te aviso quando puder registrar esse exercício.`
  }

  const metValue = resolveMetValue(exercise, intensity)
  const weightKg = context.user.weight_kg || DEFAULT_WEIGHT_KG

  const caloriesBurned =
    metValue * weightKg * (durationMinutes / 60)

  const description = `${exercise.exercise_name} (${intensity})`

  await createPendingExercise({
    userId: context.user.id,
    description,
    exerciseType: exercise.exercise_name,
    durationMinutes,
    intensity,
    metValue,
    caloriesBurned,
  })

  console.log('🧮 Exercise calculation:', {
    exercise: exercise.exercise_name,
    exerciseId: exercise.id,
    duration: durationMinutes,
    intensity,
    metValue: metValue.toFixed(1),
    weightKg,
    caloriesBurned: caloriesBurned.toFixed(1),
    formula: `${metValue.toFixed(1)} MET × ${weightKg}kg × ${durationMinutes}min / 60 = ${caloriesBurned.toFixed(1)} kcal`,
  })

  return [
    `🏃 Estimativa para ${description}`,
    `Duração: ${durationMinutes} min`,
    `MET: ${metValue.toFixed(1)}`,
    `Peso considerado: ${weightKg} kg`,
    `Calorias queimadas: ~${formatCalories(caloriesBurned)}`,
    '',
    'Confirma? 1️⃣ Sim | 2️⃣ Corrigir',
  ].join('\n')
}

