import { IntentContext } from '@/lib/intent-handlers/types'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { encodeTempData, TemporaryExerciseData } from '@/lib/utils/temp-data'
import { processExerciseCascade } from '@/lib/processors/exercise-item-processor'

const DEFAULT_WEIGHT_KG = 70

export async function handleLogExerciseIntent(
  context: IntentContext
): Promise<string> {
  const { intentResult, user, conversationId, messageText } = context

  if (!user?.id) {
    return '⚠️ Preciso do seu cadastro para registrar exercícios. Digite "ajuda" para começar.'
  }

  if (!user.weight_kg) {
    return '⚖️ Para calcular calorias queimadas preciso do seu peso atual. Envie algo como "Peso 82kg" e depois tente registrar o exercício novamente.'
  }

  // Verificar se temos items extraídos do intent
  if (!intentResult.items || intentResult.items.length === 0) {
    return '🤔 Não consegui identificar o exercício. Pode descrever o que fez?'
  }

  console.log('💪 Processing exercise items:', intentResult.items)

  // Obter peso do usuário (necessário para cálculo de calorias)
  const userWeight = user.weight_kg || DEFAULT_WEIGHT_KG

  // Processar cada dupla (exercicio, duracao)
  const processedItems: Array<any> = []
  const failedItems: Array<string> = []
  const itemCache = new Map<string, any>() // Cache local para esta sessão

  for (const item of intentResult.items) {
    if (!item.exercicio) continue

    const processed = await processExerciseCascade(
      item.exercicio,
      item.duracao || null,
      user.id,
      userWeight,
      itemCache
    )

    if (processed) {
      processedItems.push(processed)

      console.log('✅ Exercise processed:', {
        exercise: processed.exercise.exercise_name,
        duration: `${processed.duration} min`,
        intensity: processed.intensity,
        caloriesBurned: processed.caloriesBurned.toFixed(0),
        method: processed.method,
      })

      // Log fallback para exercícios não encontrados (se necessário)
      if (processed.method === 'llm' && processed.exercise) {
        await logFoodFallback({
          query: item.exercicio,
          phoneNumber: user.phone_number || 'unknown',
        })
      }
    } else {
      failedItems.push(item.exercicio)
      await logFoodFallback({
        query: item.exercicio,
        phoneNumber: user.phone_number || 'unknown',
      })
    }
  }

  if (processedItems.length === 0) {
    return `🤔 Não consegui processar: ${failedItems.join(', ')}`
  }

  // Somar totais
  const totalDuration = processedItems.reduce((sum, i) => sum + i.duration, 0)
  const totalCalories = processedItems.reduce((sum, i) => sum + i.caloriesBurned, 0)

  // Montar mensagem
  const visibleMessage =
    processedItems.length === 1
      ? `💪 ${processedItems[0].duration} min de ${processedItems[0].exercise.exercise_name}
- Calorias queimadas: ~${processedItems[0].caloriesBurned.toFixed(0)} kcal
- Intensidade: ${processedItems[0].intensity}
- MET: ${processedItems[0].metValue.toFixed(1)}
- Peso considerado: ${userWeight} kg

Confirma? 1️⃣ Sim | 2️⃣ Corrigir`
      : `💪 Treino (${totalDuration} min)
${processedItems
  .map(
    (item) =>
      `• ${item.duration} min de ${item.exercise.exercise_name}: ~${item.caloriesBurned.toFixed(0)} kcal`
  )
  .join('\n')}

📊 TOTAL:
- Duração: ${totalDuration} min
- Calorias queimadas: ~${totalCalories.toFixed(0)} kcal
- Peso considerado: ${userWeight} kg

Confirma? 1️⃣ Sim | 2️⃣ Corrigir`

  // Encode tempData
  const tempData: TemporaryExerciseData = {
    type: 'exercise',
    timestamp: new Date().toISOString(),
    userId: user.id,
    data:
      processedItems.length === 1
        ? {
            description: `${processedItems[0].duration} min de ${processedItems[0].exercise.exercise_name}`,
            exerciseType: processedItems[0].exercise.exercise_name,
            durationMinutes: processedItems[0].duration,
            intensity: processedItems[0].intensity,
            metValue: processedItems[0].metValue,
            caloriesBurned: processedItems[0].caloriesBurned,
          }
        : {
            description: processedItems
              .map((i) => `${i.duration} min de ${i.exercise.exercise_name}`)
              .join(', '),
            exerciseType: 'múltiplos',
            durationMinutes: totalDuration,
            intensity: 'moderate',
            metValue:
              processedItems.reduce((sum, i) => sum + i.metValue, 0) / processedItems.length,
            caloriesBurned: totalCalories,
          },
  }

  return `${visibleMessage}${encodeTempData(tempData)}`
}

