import { IntentContext } from '@/lib/intent-handlers/types'
import { findExerciseMet, resolveMetValue } from '@/lib/services/exercise-met'
import { createPendingExercise } from '@/lib/services/exercises'
import { logFoodFallback } from '@/lib/services/fallback-log'

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

  const parsed = parseExerciseMessage(context.messageText)

  const exercise = await findExerciseMet(parsed.exerciseQuery)
  if (!exercise) {
    await logFoodFallback({
      query: parsed.exerciseQuery,
      phoneNumber: context.user.phone_number,
    })
    return `🤔 Ainda não conheço "${parsed.exerciseQuery}". Vou pesquisar e te aviso quando puder registrar esse exercício.`
  }

  const metValue = resolveMetValue(exercise, parsed.intensity)
  const weightKg = context.user.weight_kg || DEFAULT_WEIGHT_KG

  const caloriesBurned =
    metValue * weightKg * (parsed.durationMinutes / 60)

  const description = `${exercise.exercise_name} (${parsed.intensity})`

  await createPendingExercise({
    userId: context.user.id,
    description,
    exerciseType: exercise.exercise_name,
    durationMinutes: parsed.durationMinutes,
    intensity: parsed.intensity,
    metValue,
    caloriesBurned,
  })

  return [
    `🏃 Estimativa para ${description}`,
    `Duração: ${parsed.durationMinutes} min`,
    `MET: ${metValue.toFixed(1)}`,
    `Peso considerado: ${weightKg} kg`,
    `Calorias queimadas: ~${formatCalories(caloriesBurned)}`,
    '',
    'Confirma? 1️⃣ Sim | 2️⃣ Corrigir',
  ].join('\n')
}

